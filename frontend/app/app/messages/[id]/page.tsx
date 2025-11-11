"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost, apiPatch, apiDelete, API_BASE, resolveRemoteUrl } from "@/lib/api";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import { useToast } from "@/components/Toast";
import type { Conversation, Message, ReactionType } from "@/lib/types";
import type { PaginatedResponse } from "@/lib/api";
import Image from "next/image";
import Spinner from "@/components/Spinner";
import { EmojiPicker } from "@/components/EmojiPicker";
import { ReactionPicker } from "@/components/feed/ReactionPicker";
import ImageGallery from "@/components/ImageGallery";

const REACTION_EMOJIS: Record<ReactionType, string> = {
  like: "👍",
  love: "❤️",
  haha: "😂",
  sad: "😢",
  angry: "😠",
};

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
        // Check if user is near bottom (within 200px)
        const container = messagesContainerRef.current;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
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
  const { isConnected } = useChatWebSocket({
    conversationId: conversationId || "",
    enabled: !!conversationId && !!accessToken,
    onMessage: (message: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }
        const updated = [...prev, message];
        lastMessageIdRef.current = message.id;
        
        // Only auto-scroll if user is near bottom
        if (shouldAutoScrollRef.current) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      // Auto-scroll to bottom on initial load only
      shouldAutoScrollRef.current = true;
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
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

  // Track scroll position to determine if we should auto-scroll
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
      shouldAutoScrollRef.current = isNearBottom;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to bottom when messages change, but only if user is near bottom
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages]);

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

  const handleToggleReaction = async (messageId: number, reactionType: ReactionType) => {
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
      <div className="flex flex-col h-[calc(100vh-200px)] sm:h-[calc(100vh-120px)]">
        <header className="flex items-center gap-4 p-4 border-b bg-white shadow-sm sticky top-0 z-30 flex-shrink-0">
          <button
            onClick={() => router.back()}
            className="text-gray-700 hover:text-gray-900 p-2 font-medium"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold flex-1 text-gray-900">{getConversationTitle()}</h1>
        </header>

        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 bg-gray-50"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <p className="text-gray-500">No messages yet</p>
              <p className="text-sm text-gray-400">Start the conversation</p>
            </div>
          ) : (
            <>
              {messages.map((message) => {
                if (message.is_deleted) {
                  return (
                    <div key={message.id} className="flex justify-end">
                      <p className="text-sm text-gray-500 italic">
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
                      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                        {avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt={message.sender.first_name || "User"}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-gray-500 text-sm">👤</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`max-w-[75%] sm:max-w-[60%] min-w-0 ${isOwn ? "flex flex-col items-end" : ""}`}>
                      {!isOwn && (
                        <p className="text-xs font-semibold mb-1 text-gray-600 px-1">
                          {message.sender.first_name || message.sender.username || "User"}
                        </p>
                      )}
                      <div className="relative w-full min-w-0">
                        <div
                          className={`rounded-lg p-3 w-full min-w-0 ${
                            isOwn
                              ? "bg-blue-600 text-white"
                              : "bg-white text-gray-900 border border-gray-200"
                          }`}
                          style={{ overflow: 'visible', position: 'relative', zIndex: 1 }}
                          onTouchStart={(e) => {
                            // Mobile long-press to show reaction picker
                            if (window.innerWidth <= 768) {
                              longPressMessageIdRef.current = message.id;
                              longPressTimerRef.current = window.setTimeout(() => {
                                if (longPressMessageIdRef.current === message.id) {
                                  setOpenReactionPickerId(message.id);
                                  // Prevent default context menu
                                  e.preventDefault();
                                }
                              }, 500); // 500ms long press
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
                            // Cancel long press if user moves finger
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
                                className="w-full px-2 py-1 rounded border text-gray-900 text-sm resize-none"
                                rows={3}
                                autoFocus
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => {
                                    setEditingMessageId(null);
                                    setEditText("");
                                  }}
                                  className="text-xs px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
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
                                <p className={`text-xs mt-1 ${isOwn ? "text-blue-200" : "text-gray-400"}`}>
                                  (edited)
                                </p>
                              )}
                              {/* Reactions display inside message bubble - starting from inner edge */}
                              {(() => {
                                // Get reactions from either reaction_summary or reactions array
                                let reactionCounts: Record<ReactionType, number> = {
                                  like: 0,
                                  love: 0,
                                  haha: 0,
                                  sad: 0,
                                  angry: 0,
                                };
                                
                                if (message.reaction_summary && message.reaction_summary.total > 0) {
                                  // Use reaction_summary if available
                                  reactionCounts = { ...message.reaction_summary.by_type };
                                } else if (message.reactions && message.reactions.length > 0) {
                                  // Fallback to reactions array
                                  message.reactions.forEach((r) => {
                                    if (r.reaction_type && reactionCounts[r.reaction_type] !== undefined) {
                                      reactionCounts[r.reaction_type] = (reactionCounts[r.reaction_type] || 0) + 1;
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
                                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold flex-shrink-0"
                                          style={isOwn ? { 
                                            backgroundColor: '#ffffff',
                                            color: '#1e40af',
                                            border: '2px solid rgba(255, 255, 255, 0.9)',
                                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                                            zIndex: 10,
                                            position: 'relative'
                                          } : {
                                            backgroundColor: '#f3f4f6',
                                            color: '#1f2937',
                                            border: '1px solid #d1d5db'
                                          }}
                                        >
                                          <span className="text-base leading-none">{REACTION_EMOJIS[type as ReactionType]}</span>
                                          <span className="leading-none font-bold">{count}</span>
                                        </span>
                                      ))}
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </div>

                        {/* Message actions (hover menu) */}
                        {!isEditing && (
                          <div
                            className={`absolute ${isOwn ? "right-0" : "left-0"} top-full mt-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10`}
                          >
                            {isOwn && (
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setOpenMessageMenuId(openMessageMenuId === message.id ? null : message.id)}
                                  className="p-1.5 rounded-full bg-gray-800 border border-gray-700 shadow-lg hover:bg-gray-700 transition"
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
                                  <div className="absolute right-0 mt-1 w-32 rounded-lg border border-gray-300 bg-white shadow-xl z-20">
                                    <button
                                      onClick={() => {
                                        setEditText(message.content || "");
                                        setEditingMessageId(message.id);
                                        setOpenMessageMenuId(null);
                                      }}
                                      className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMessage(message.id)}
                                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 rounded-b-lg"
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
                                onClick={() => setOpenReactionPickerId(openReactionPickerId === message.id ? null : message.id)}
                                className={`p-1.5 rounded-full border shadow-lg transition ${
                                  userReaction
                                    ? "bg-blue-100 border-blue-400"
                                    : "bg-gray-800 border-gray-700 hover:bg-gray-700"
                                }`}
                                title="Add reaction"
                              >
                                {userReaction ? (
                                  <span className="text-base">
                                    {REACTION_EMOJIS[userReaction.reaction_type]}
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
                        className={`text-xs mt-1 px-1 ${
                          isOwn ? "text-gray-500 text-right" : "text-gray-400"
                        }`}
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
        <div className="border-t bg-white p-3 sm:p-4">
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
              className="p-2.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
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
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="w-full px-4 py-3 pr-16 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-gray-900 text-base bg-white"
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
                      className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition"
                    >
                      <span className="text-xl">😀</span>
                    </button>
                    {emojiPickerOpen && (
                      <div className="absolute bottom-full right-0 mb-2">
                        <EmojiPicker
                          onSelect={handleEmojiSelect}
                          onClose={() => setEmojiPickerOpen(false)}
                        />
                      </div>
                    )}
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
    </>
  );
}
