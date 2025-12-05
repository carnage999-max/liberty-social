"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost, apiPatch, apiDelete, API_BASE, resolveRemoteUrl } from "@/lib/api";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import { useToast } from "@/components/Toast";
import { TypingIndicator } from "@/components/TypingIndicator";
import type { Conversation, Message } from "@/lib/types";
import type { PaginatedResponse } from "@/lib/api";
import Image from "next/image";
import Spinner from "@/components/Spinner";
import { EmojiPicker } from "@/components/EmojiPicker";
import { EmojiPickerPopper } from "@/components/EmojiPickerPopper";
import { ReactionPicker } from "@/components/feed/ReactionPicker";
import { ReactionsModal } from "@/components/feed/ReactionsModal";
import ImageGallery from "@/components/ImageGallery";

// Map old text reaction types to emojis for backward compatibility
const REACTION_TYPE_TO_EMOJI: Record<string, string> = {
  "like": "👍",
  "love": "❤️",
  "haha": "😂",
  "sad": "😢",
  "angry": "😠",
};

// Convert reaction type to emoji (handles both old text types and new emoji types)
function getReactionEmoji(reactionType: string): string {
  // If it's in the mapping, return the emoji
  if (REACTION_TYPE_TO_EMOJI[reactionType]) {
    return REACTION_TYPE_TO_EMOJI[reactionType];
  }
  // Otherwise it's already an emoji, return it
  return reactionType;
}

// File restrictions
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

type MediaAttachment = {
  file: File;
  preview: string;
  type: "image" | "video";
};

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const toast = useToast();
  const conversationId = params.id as string;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [mediaAttachment, setMediaAttachment] = useState<MediaAttachment | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [openMessageMenuId, setOpenMessageMenuId] = useState<number | null>(null);
  const [openReactionPickerId, setOpenReactionPickerId] = useState<number | null>(null);
  const [reactionPendingId, setReactionPendingId] = useState<number | null>(null);
  const [galleryImage, setGalleryImage] = useState<string | null>(null);
  const [reactionsModalOpen, setReactionsModalOpen] = useState(false);
  const [reactionsModalData, setReactionsModalData] = useState<any[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; username: string; timestamp: number }>>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressMessageIdRef = useRef<number | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const scrollPositionRef = useRef<number | null>(null);

  const loadConversation = async () => {
    if (!accessToken || !conversationId) return;
    try {
      const data = await apiGet<Conversation>(`/conversations/${conversationId}/`, {
        token: accessToken,
        cache: "no-store",
      });
      setConversation(data);
    } catch (error) {
      toast.show("Failed to load conversation", "error");
      router.back();
    }
  };

  const loadMessages = async (silent = false) => {
    if (!accessToken || !conversationId) return;
    try {
      // Save scroll position before reload if silent
      if (silent && messagesContainerRef.current) {
        scrollPositionRef.current = messagesContainerRef.current.scrollTop;
        // Check if user is near bottom (within 50px - stricter threshold)
        const container = messagesContainerRef.current;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
        shouldAutoScrollRef.current = isNearBottom;
      }
      
      if (!silent) setLoading(true);
      const response = await apiGet<PaginatedResponse<Message>>(
        `/conversations/${conversationId}/messages/`,
        {
          token: accessToken,
          cache: "no-store",
        }
      );
      const newMessages = response.results.reverse();
      setMessages(newMessages);
      
      if (newMessages.length > 0) {
        lastMessageIdRef.current = newMessages[newMessages.length - 1].id;
      }
      
      // Restore scroll position if silent reload and user was scrolled up
      if (silent && scrollPositionRef.current !== null && !shouldAutoScrollRef.current) {
        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = scrollPositionRef.current!;
          }
        }, 50);
      }
    } catch (error) {
      if (!silent) toast.show("Failed to load messages", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const markAsRead = async () => {
    if (!accessToken || !conversationId) return;
    try {
      await apiPost(
        `/conversations/${conversationId}/mark-read/`,
        undefined,
        {
          token: accessToken,
          cache: "no-store",
        }
      );
    } catch (error) {
      // Silently fail
    }
  };

  // WebSocket connection
  const { isConnected, startTyping, stopTyping } = useChatWebSocket({
    conversationId: conversationId || "",
    enabled: !!conversationId && !!accessToken,
    onMessage: (message: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }
        const updated = [...prev, message];
        lastMessageIdRef.current = message.id;
        
        // Only auto-scroll if user is near bottom (smooth scroll)
        if (shouldAutoScrollRef.current) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
          }, 100);
        }
        return updated;
      });
      markAsRead();
    },
    onError: (error) => {
      console.error("[WebSocket] Error:", error);
      setPollingEnabled(true);
    },
    onConnect: () => {
      setPollingEnabled(false);
    },
    onDisconnect: () => {
      setPollingEnabled(true);
    },
    onTypingStart: (userId: string, username: string) => {
      setTypingUsers((prev) => {
        // Remove if already exists
        const filtered = prev.filter((u) => u.userId !== userId);
        return [...filtered, { userId, username, timestamp: Date.now() }];
      });
    },
    onTypingStop: (userId: string) => {
      setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
    },
  });

  // Listen for message update/delete events
  useEffect(() => {
    const handleMessageUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<Message>;
      const updatedMessage = customEvent.detail;
      setMessages((prev) =>
        prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
      );
    };

    const handleMessageDelete = (event: Event) => {
      const customEvent = event as CustomEvent<Message>;
      const deletedMessage = customEvent.detail;
      setMessages((prev) =>
        prev.map((m) => (m.id === deletedMessage.id ? deletedMessage : m))
      );
    };

    window.addEventListener("message.updated", handleMessageUpdate);
    window.addEventListener("message.deleted", handleMessageDelete);

    return () => {
      window.removeEventListener("message.updated", handleMessageUpdate);
      window.removeEventListener("message.deleted", handleMessageDelete);
    };
  }, []);

  // Polling fallback
  useEffect(() => {
    if (pollingEnabled && conversationId && accessToken) {
      pollingIntervalRef.current = setInterval(() => {
        // Only poll if user is near bottom (don't interrupt if reading old messages)
        if (shouldAutoScrollRef.current) {
          loadMessages(true);
        }
      }, 5000);
    } else {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [pollingEnabled, conversationId, accessToken]);

  // Load conversation and messages on mount
  useEffect(() => {
    if (conversationId && accessToken) {
      loadConversation();
      loadMessages();
      markAsRead();
      // Auto-scroll to bottom on initial load only (smooth)
      shouldAutoScrollRef.current = true;
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 200);
    }
  }, [conversationId, accessToken]);

  // Mark as read when page is visible
  useEffect(() => {
    if (!conversationId || !accessToken) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        markAsRead();
        // Only reload messages if user is near bottom (don't interrupt if reading old messages)
        if (shouldAutoScrollRef.current) {
          loadMessages(true);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [conversationId, accessToken]);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Track scroll position to determine if we should auto-scroll
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Stricter threshold - only auto-scroll if user is very close to bottom (50px)
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
      shouldAutoScrollRef.current = isNearBottom;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Don't auto-scroll on every messages array change - only for new messages via WebSocket
  // This prevents aggressive scrolling when messages are updated/edited/deleted

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      toast.show(`File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`, "error");
      e.target.value = "";
      return;
    }

    // Check file type
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      toast.show("Only images and videos are allowed", "error");
      e.target.value = "";
      return;
    }

    const preview = URL.createObjectURL(file);
    setMediaAttachment({
      file,
      preview,
      type: isImage ? "image" : "video",
    });
    e.target.value = "";
  };

  const removeMediaAttachment = () => {
    if (mediaAttachment) {
      URL.revokeObjectURL(mediaAttachment.preview);
    }
    setMediaAttachment(null);
  };

  const sendMessage = async () => {
    if ((!messageText.trim() && !mediaAttachment) || sending || !accessToken || !conversationId) return;

    try {
      setSending(true);
      let mediaUrl: string | null = null;

      // Upload media if present
      if (mediaAttachment) {
        const formData = new FormData();
        formData.append("file", mediaAttachment.file);
        try {
          const uploadRes = await fetch(`${API_BASE}/uploads/images/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: formData,
          });
          if (!uploadRes.ok) {
            throw new Error("Failed to upload media");
          }
          const uploadData = await uploadRes.json();
          mediaUrl = uploadData.url;
        } catch (error) {
          toast.show("Failed to upload media", "error");
          setSending(false);
          return;
        }
      }

      const response = await apiPost<Message>(
        `/conversations/${conversationId}/messages/`,
        {
          content: messageText.trim() || null,
          media_url: mediaUrl,
        },
        {
          token: accessToken,
          cache: "no-store",
        }
      );

      setMessages((prev) => {
        if (prev.some((m) => m.id === response.id)) {
          return prev;
        }
        return [...prev, response];
      });
      setMessageText("");
      removeMediaAttachment();
      lastMessageIdRef.current = response.id;
      markAsRead();
    } catch (error) {
      toast.show("Failed to send message", "error");
    } finally {
      setSending(false);
    }
  };

  const handleEditMessage = async (messageId: number) => {
    if (!editText.trim() || !accessToken || !conversationId) return;

    try {
      const updated = await apiPatch<Message>(
        `/conversations/${conversationId}/messages/${messageId}/`,
        { content: editText.trim() },
        {
          token: accessToken,
          cache: "no-store",
        }
      );
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
      setEditingMessageId(null);
      setEditText("");
      toast.show("Message updated", "success");
    } catch (error) {
      toast.show("Failed to update message", "error");
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!accessToken || !conversationId) return;

    // Confirmation dialog
    if (!window.confirm("Are you sure you want to delete this message?")) {
      return;
    }

    try {
      await apiDelete(`/conversations/${conversationId}/messages/${messageId}/`, {
        token: accessToken,
        cache: "no-store",
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, is_deleted: true } : m))
      );
      setOpenMessageMenuId(null);
      toast.show("Message deleted", "success");
    } catch (error) {
      toast.show("Failed to delete message", "error");
    }
  };

  const handleToggleReaction = async (messageId: number, reactionType: string) => {
    if (!accessToken || reactionPendingId === messageId) return;

    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    const existingReaction = message.reactions?.find((r) => r.user?.id === user?.id);

    setReactionPendingId(messageId);
    try {
      if (existingReaction && existingReaction.reaction_type === reactionType) {
        // Remove reaction
        await apiDelete(`/reactions/${existingReaction.id}/`, {
          token: accessToken,
          cache: "no-store",
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  reactions: m.reactions?.filter((r) => r.id !== existingReaction.id) || [],
                }
              : m
          )
        );
      } else {
        // Add or update reaction
        if (existingReaction) {
          await apiDelete(`/reactions/${existingReaction.id}/`, {
            token: accessToken,
            cache: "no-store",
          });
        }
        const created = await apiPost(
          "/reactions/",
          {
            message: messageId,
            reaction_type: reactionType,
          },
          {
            token: accessToken,
            cache: "no-store",
          }
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  reactions: [
                    ...(m.reactions?.filter((r) => r.user?.id !== user?.id) || []),
                    { ...created, user: user! },
                  ],
                }
              : m
          )
        );
      }
    } catch (error) {
      toast.show("Failed to update reaction", "error");
    } finally {
      setReactionPendingId(null);
      setOpenReactionPickerId(null);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageText((prev) => prev + emoji);
    setEmojiPickerOpen(false);
  };

  const getConversationTitle = (): string => {
    if (!conversation) return "Messages";
    if (conversation.title) return conversation.title;
    if (conversation.is_group) return "Group Chat";
    const otherParticipant = conversation.participants.find(
      (p) => p.user.id !== user?.id
    );
    if (otherParticipant) {
      const u = otherParticipant.user;
      if (u.first_name && u.last_name) return `${u.first_name} ${u.last_name}`;
      if (u.username) return u.username;
      return u.email.split("@")[0];
    }
    return "Messages";
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-200px)] sm:h-[calc(100vh-120px)] rounded-2xl border border-gray-700 bg-gray-900 overflow-hidden shadow-2xl mx-auto w-full">
        <header className="flex items-center gap-4 p-4 border-b border-gray-700 bg-gray-800 shadow-sm sticky z-20 flex-shrink-0" style={{ top: '0' }}>
          <button
            onClick={() => router.back()}
            className="text-gray-300 hover:text-white p-2 font-medium transition"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold flex-1 text-white">{getConversationTitle()}</h1>
        </header>

        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 bg-gray-900"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <p className="text-gray-500">No messages yet</p>
              <p className="text-sm text-gray-600">Start the conversation</p>
            </div>
          ) : (
            <>
              {messages.map((message) => {
                if (message.is_deleted) {
                  return (
                    <div key={message.id} className="flex justify-end">
                      <p className="text-sm text-gray-600 italic">
                        This message was deleted
                      </p>
                    </div>
                  );
                }

                const isOwn = message.sender.id === user?.id;
                const avatarUrl = message.sender.profile_image_url
                  ? resolveRemoteUrl(message.sender.profile_image_url)
                  : null;
                const userReaction = message.reactions?.find((r) => r.user?.id === user?.id);
                const isEditing = editingMessageId === message.id;

                return (
                  <div
                    key={message.id}
                    className={`flex gap-2 group ${isOwn ? "justify-end" : "justify-start"} w-full min-w-0`}
                  >
                    {!isOwn && (
                      <button
                        type="button"
                        onClick={() => router.push(`/app/users/${message.sender.id}`)}
                        className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-700 shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
                        title={`View ${message.sender.first_name || message.sender.username || "User"}'s profile`}
                      >
                        {avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt={message.sender.first_name || "User"}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-gray-400 text-sm">👤</span>
                          </div>
                        )}
                      </button>
                    )}
                    <div className={`max-w-[75%] sm:max-w-[60%] min-w-0 ${isOwn ? "flex flex-col items-end" : ""}`}>
                      {!isOwn && (
                        <p className="text-xs font-semibold mb-1 text-gray-400 px-1">
                          {message.sender.first_name || message.sender.username || "User"}
                        </p>
                      )}
                      <div className="relative w-full min-w-0">
                        <div
                          className={`rounded-lg p-3 w-full min-w-0 ${
                            isOwn
                              ? "bg-blue-600 text-white"
                              : "bg-gray-800 text-gray-100 border border-gray-700"
                          }`}
                          style={{ overflow: 'visible', position: 'relative', zIndex: 1 }}
                          onTouchStart={(e) => {
                            if (window.innerWidth <= 768) {
                              longPressMessageIdRef.current = message.id;
                              longPressTimerRef.current = window.setTimeout(() => {
                                if (longPressMessageIdRef.current === message.id) {
                                  setOpenReactionPickerId(message.id);
                                  e.preventDefault();
                                }
                              }, 500);
                            }
                          }}
                          onTouchEnd={() => {
                            if (longPressTimerRef.current) {
                              clearTimeout(longPressTimerRef.current);
                              longPressTimerRef.current = null;
                            }
                            longPressMessageIdRef.current = null;
                          }}
                          onTouchMove={() => {
                            if (longPressTimerRef.current) {
                              clearTimeout(longPressTimerRef.current);
                              longPressTimerRef.current = null;
                            }
                            longPressMessageIdRef.current = null;
                          }}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="w-full px-2 py-1 rounded border border-gray-600 bg-gray-700 text-white text-sm resize-none"
                                rows={3}
                                autoFocus
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => {
                                    setEditingMessageId(null);
                                    setEditText("");
                                  }}
                                  className="text-xs px-3 py-1 rounded bg-gray-600 text-gray-100 hover:bg-gray-500"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleEditMessage(message.id)}
                                  className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {message.media_url && (
                                <div className="mb-2">
                                  <button
                                    type="button"
                                    onClick={() => setGalleryImage(message.media_url!)}
                                    className="block"
                                  >
                                    {message.media_url.match(/\.(mp4|webm|quicktime)$/i) ? (
                                      <video
                                        src={message.media_url}
                                        controls
                                        className="max-w-full h-auto rounded-lg"
                                        style={{ maxHeight: "300px" }}
                                      />
                                    ) : (
                                      <Image
                                        src={message.media_url}
                                        alt="Message media"
                                        width={300}
                                        height={300}
                                        className="rounded-lg object-cover max-h-[300px]"
                                      />
                                    )}
                                  </button>
                                </div>
                              )}
                              {message.content && (
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {message.content}
                                </p>
                              )}
                              {message.edited_at && (
                                <p className={`text-xs mt-1 ${isOwn ? "text-blue-200" : "text-gray-500"}`}>
                                  (edited)
                                </p>
                              )}
                              {(() => {
                                let reactionCounts: Record<string, number> = {};
                                
                                if (message.reaction_summary && message.reaction_summary.total > 0) {
                                  // Convert old text types to emojis for consistency
                                  Object.entries(message.reaction_summary.by_type).forEach(([type, count]) => {
                                    const emoji = getReactionEmoji(type);
                                    reactionCounts[emoji] = (reactionCounts[emoji] || 0) + count;
                                  });
                                } else if (message.reactions && message.reactions.length > 0) {
                                  message.reactions.forEach((r) => {
                                    if (r.reaction_type) {
                                      const emoji = getReactionEmoji(r.reaction_type);
                                      reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1;
                                    }
                                  });
                                }
                                
                                const hasReactions = Object.values(reactionCounts).some(count => count > 0);
                                
                                if (!hasReactions) return null;
                                
                                return (
                                  <div className={`mt-2 flex items-center gap-1.5 flex-wrap w-full ${isOwn ? "justify-start" : "justify-start"}`}>
                                    {Object.entries(reactionCounts)
                                      .filter(([_, count]) => count > 0)
                                      .map(([type, count]) => (
                                        <span
                                          key={type}
                                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0"
                                          style={isOwn ? { 
                                            backgroundColor: '#ffffff',
                                            color: '#1e40af',
                                            border: '2px solid rgba(255, 255, 255, 0.9)',
                                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                                            zIndex: 10,
                                            position: 'relative'
                                          } : {
                                            backgroundColor: '#374151',
                                            color: '#e5e7eb',
                                            border: '1px solid #4b5563'
                                          }}
                                        >
                                          <span className="text-base leading-none">{type}</span>
                                          <span className="leading-none font-bold">{count}</span>
                                        </span>
                                      ))}
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </div>

                        {!isEditing && (
                          <div
                            className={`absolute ${isOwn ? "right-0" : "left-0"} top-full mt-1 flex gap-1 z-10 ${
                              isMobile 
                                ? "opacity-100 mb-6" 
                                : "opacity-0 group-hover:opacity-100"
                            } transition-opacity`}
                          >
                            {isOwn && (
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setOpenMessageMenuId(openMessageMenuId === message.id ? null : message.id)}
                                  className="p-1.5 rounded-full bg-gray-700 border border-gray-600 shadow-lg hover:bg-gray-600 transition"
                                  title="Message options"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path
                                      d="M12 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
                                      fill="white"
                                    />
                                  </svg>
                                </button>
                                {openMessageMenuId === message.id && (
                                  <div className="absolute right-0 mt-1 w-32 rounded-lg border border-gray-600 bg-gray-800 shadow-xl z-20">
                                    <button
                                      onClick={() => {
                                        setEditText(message.content || "");
                                        setEditingMessageId(message.id);
                                        setOpenMessageMenuId(null);
                                      }}
                                      className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 rounded-t-lg"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMessage(message.id)}
                                      className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-900/20 rounded-b-lg"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => {
                                  const totalReactions = (message.reaction_summary?.total ?? 0) + (message.reactions?.length ?? 0);
                                  if (totalReactions > 0) {
                                    setReactionsModalData(message.reactions || []);
                                    setReactionsModalOpen(true);
                                  } else {
                                    setOpenReactionPickerId(openReactionPickerId === message.id ? null : message.id);
                                  }
                                }}
                                className={`p-1.5 rounded-full border shadow-lg transition ${
                                  userReaction
                                    ? "bg-blue-100 border-blue-400"
                                    : "bg-gray-700 border-gray-600 hover:bg-gray-600"
                                }`}
                                title="Add reaction"
                              >
                                {userReaction ? (
                                  <span className="text-base">
                                    {getReactionEmoji(userReaction.reaction_type)}
                                  </span>
                                ) : (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path
                                      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.54L12 21.35z"
                                      stroke="white"
                                      strokeWidth="1.5"
                                      fill="none"
                                    />
                                  </svg>
                                )}
                              </button>
                              {openReactionPickerId === message.id && (
                                <div 
                                  className="absolute bottom-full mb-2 z-20"
                                  style={isOwn ? {
                                    right: 0,
                                    transform: 'translateX(0)',
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    width: 'max-content',
                                    maxWidth: "min(100vw - 2rem, 300px)"
                                  } : {
                                    left: 0,
                                    maxWidth: "min(100vw - 2rem, 300px)"
                                  }}
                                >
                                  <ReactionPicker
                                    onSelect={(reactionType) => handleToggleReaction(message.id, reactionType)}
                                    onClose={() => setOpenReactionPickerId(null)}
                                    currentReaction={userReaction?.reaction_type || null}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <p
                        className={`text-xs px-1 ${
                          isOwn ? "text-gray-500 text-right" : "text-gray-600"
                        } ${isMobile ? "mt-8" : "mt-1"}`}
                      >
                        {formatTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-gray-700 bg-gray-800 p-3 sm:p-4">
          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <TypingIndicator typingUsers={typingUsers} className="mb-3" />
          )}
          {mediaAttachment && (
            <div className="mb-2 relative inline-block">
              <button
                type="button"
                onClick={removeMediaAttachment}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
              >
                ×
              </button>
              {mediaAttachment.type === "image" ? (
                <Image
                  src={mediaAttachment.preview}
                  alt="Preview"
                  width={100}
                  height={100}
                  className="rounded-lg object-cover"
                />
              ) : (
                <video
                  src={mediaAttachment.preview}
                  className="rounded-lg"
                  style={{ width: "100px", height: "100px", objectFit: "cover" }}
                />
              )}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2 items-end"
          >
            <button
              type="button"
              onClick={handleFileSelect}
              className="p-2.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition flex-shrink-0"
              title="Attach image or video"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex-1 relative">
              <div className="relative">
                <textarea
                  value={messageText}
                  onChange={(e) => {
                    setMessageText(e.target.value);
                    // Call startTyping when user types
                    if (startTyping) startTyping();
                  }}
                  placeholder="Type a message..."
                  className="w-full px-4 py-3 pr-16 border-2 border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-white text-base bg-gray-700 placeholder-gray-500"
                  rows={1}
                  maxLength={1000}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  style={{ minHeight: "48px", maxHeight: "120px" }}
                />
                <div className="absolute right-2 bottom-2 flex gap-1">
                  <div className="relative">
                    <button
                      ref={emojiButtonRef}
                      type="button"
                      onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                      className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition"
                    >
                      <span className="text-xl">😀</span>
                    </button>
                    <EmojiPickerPopper
                      open={emojiPickerOpen}
                      onSelect={handleEmojiSelect}
                      onClose={() => setEmojiPickerOpen(false)}
                      triggerRef={emojiButtonRef}
                    />
                  </div>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={(!messageText.trim() && !mediaAttachment) || sending}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition flex-shrink-0"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
      </div>

      {/* Image Gallery */}
      {galleryImage && (
        <ImageGallery
          open={true}
          onClose={() => setGalleryImage(null)}
          images={[galleryImage]}
          currentIndex={0}
        />
      )}
      <ReactionsModal
        reactions={reactionsModalData}
        isOpen={reactionsModalOpen}
        onClose={() => setReactionsModalOpen(false)}
        postOrCommentTitle="Message"
      />
    </>
  );
}
