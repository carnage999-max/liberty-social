"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { useFeedBackground } from "@/hooks/useFeedBackground";
import FeedBackgroundModal from "@/components/modals/FeedBackgroundModal";
import ConfirmationDialog from "@/components/ConfirmationDialog";

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

// Helper functions
const isVideoUrl = (url?: string | null): boolean => {
  if (!url) return false;
  return /\.(mp4|webm|quicktime|mov)(\?.*)?$/i.test(url);
};

const isAudioUrl = (url?: string | null): boolean => {
  if (!url) return false;
  return /\.(m4a|mp3|wav|aac|ogg|flac|wma|webm)(\?.*)?$/i.test(url);
};

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
  const { theme: chatBackgroundTheme, changeTheme, mounted: backgroundMounted } = useFeedBackground();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
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
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  
  // Collect all images from messages for gallery
  const galleryMedia = useMemo(() => {
    return messages
      .map((message) => {
        if (!message.media_url) return null;
        const mediaUrl = resolveRemoteUrl(message.media_url);
        if (!mediaUrl || isVideoUrl(mediaUrl) || isAudioUrl(mediaUrl)) return null;
        return { messageId: message.id, url: mediaUrl };
      })
      .filter((entry): entry is { messageId: number; url: string } => !!entry);
  }, [messages]);
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
  
  // Voice notes state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingDurationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  
  // Video thumbnails state
  const [videoThumbnails, setVideoThumbnails] = useState<Record<number, string>>({});
  
  // Audio player state
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
  const [audioPosition, setAudioPosition] = useState(0);
  const [audioPlayerDuration, setAudioPlayerDuration] = useState(0);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const waveformIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [waveformHeights, setWaveformHeights] = useState<number[]>(Array(12).fill(8));
  
  // Chat background state
  const [backgroundModalOpen, setBackgroundModalOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  
  // Confirmation dialogs
  const [showDeleteMessageConfirm, setShowDeleteMessageConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<number | null>(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [userToBlock, setUserToBlock] = useState<{ id: string; name: string } | null>(null);
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);

  const loadConversation = async () => {
    if (!accessToken || !conversationId) return;
    try {
      // Include archived conversations in the request
      const data = await apiGet<Conversation>(`/conversations/${conversationId}/?include_archived=true`, {
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
      // Include archived conversations in the request
      const response = await apiGet<PaginatedResponse<Message>>(
        `/conversations/${conversationId}/messages/?include_archived=true`,
        {
          token: accessToken,
          cache: "no-store",
        }
      );
      const newMessages = response.results.reverse();
      setMessages(newMessages);
      setNextUrl(response.next || null);
      
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

  const loadOlderMessages = useCallback(async () => {
    if (!accessToken || !conversationId || !nextUrl || loadingMore) return;
    
    try {
      setLoadingMore(true);
      
      // Save current scroll position and height
      const container = messagesContainerRef.current;
      if (!container) return;
      
      const previousScrollHeight = container.scrollHeight;
      const previousScrollTop = container.scrollTop;
      
      // Extract the path from the URL (handle both full URLs and relative paths)
      let path: string;
      try {
        if (nextUrl.startsWith("http://") || nextUrl.startsWith("https://")) {
          // Full URL - extract path and query
          const url = new URL(nextUrl);
          path = url.pathname + url.search;
          // Remove /api prefix if present since API_BASE already includes it
          if (path.startsWith("/api/")) {
            path = path.substring(4); // Remove "/api"
          }
        } else if (nextUrl.startsWith("/api/")) {
          // Relative path starting with /api/ - remove /api prefix
          path = nextUrl.substring(4);
        } else if (nextUrl.startsWith("/")) {
          // Relative path starting with / - use as is
          path = nextUrl;
        } else {
          // Relative path without / - use as is
          path = nextUrl;
        }
      } catch (error) {
        console.error("Error parsing nextUrl:", nextUrl, error);
        // If URL parsing fails, try to use it as a relative path
        path = nextUrl.startsWith("/api/") ? nextUrl.substring(4) : (nextUrl.startsWith("/") ? nextUrl : nextUrl);
      }
      
      console.log("Loading older messages from:", path);
      const response = await apiGet<PaginatedResponse<Message>>(path, {
        token: accessToken,
        cache: "no-store",
      });
      
      const olderMessages = response.results.reverse();
      
      // Prepend older messages to the existing messages
      setMessages((prev) => [...olderMessages, ...prev]);
      setNextUrl(response.next || null);
      
      // Restore scroll position after new messages are added
      setTimeout(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          const scrollDifference = newScrollHeight - previousScrollHeight;
          container.scrollTop = previousScrollTop + scrollDifference;
        }
      }, 50);
    } catch (error: any) {
      console.error("Failed to load older messages:", error);
      console.error("nextUrl was:", nextUrl);
      const errorMessage = error?.response?.data?.detail || error?.message || "Failed to load older messages";
      toast.show(errorMessage, "error");
    } finally {
      setLoadingMore(false);
    }
  }, [accessToken, conversationId, nextUrl, loadingMore, toast]);

  const markAsRead = async () => {
    if (!accessToken || !conversationId) return;
    try {
      // Include archived conversations - the backend should handle this via get_object()
      // but we'll try with query param first, fallback to without if needed
      try {
        await apiPost(
          `/conversations/${conversationId}/mark-read/?include_archived=true`,
          undefined,
          {
            token: accessToken,
            cache: "no-store",
          }
        );
      } catch (error: any) {
        // If that fails, try without the query param (for backwards compatibility)
        if (error?.status === 404) {
          await apiPost(
            `/conversations/${conversationId}/mark-read/`,
            undefined,
            {
              token: accessToken,
              cache: "no-store",
            }
          );
        } else {
          throw error;
        }
      }
    } catch (error) {
      // Silently fail - mark as read is not critical
      console.error("Failed to mark as read:", error);
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

  // Handle scroll to top for loading older messages
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Load older messages when user scrolls near the top (within 100px)
      if (container.scrollTop < 100 && nextUrl && !loadingMore) {
        loadOlderMessages();
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [nextUrl, loadingMore, loadOlderMessages]);

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
    if ((!messageText.trim() && !mediaAttachment && !audioBlob) || sending || !accessToken || !conversationId) return;

    try {
      setSending(true);
      let mediaUrl: string | null = null;

      // Upload audio if present
      if (audioBlob && editingMessageId === null) {
        const formData = new FormData();
        const filename = `voice-note-${Date.now()}.${audioBlob.type.includes("webm") ? "webm" : "m4a"}`;
        formData.append("file", audioBlob, filename);
        try {
          const uploadRes = await fetch(`${API_BASE}/uploads/images/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: formData,
          });
          if (!uploadRes.ok) {
            throw new Error("Failed to upload audio");
          }
          const uploadData = await uploadRes.json();
          mediaUrl = uploadData.url;
        } catch (error) {
          toast.show("Failed to upload audio", "error");
          setSending(false);
          return;
        }
      }

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

      // Include duration in content for audio messages
      let content = messageText.trim() || null;
      if (audioBlob && recordingDuration > 0) {
        const durationStr = formatDuration(recordingDuration);
        content = content ? `${content} [duration:${durationStr}]` : `[duration:${durationStr}]`;
      }

      const response = await apiPost<Message>(
        `/conversations/${conversationId}/messages/`,
        {
          content,
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
      cancelRecording();
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
    setMessageToDelete(messageId);
    setShowDeleteMessageConfirm(true);
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

  // Voice notes functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
      });
      
      recordingChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl(url);
        
        // Get audio duration
        const audio = new Audio(url);
        audio.onloadedmetadata = () => {
          setAudioDuration(Math.floor(audio.duration));
        };
        
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };
      
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Start duration timer
      recordingDurationIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast.show("Failed to start recording. Please allow microphone access.", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recordingDurationIntervalRef.current) {
      clearInterval(recordingDurationIntervalRef.current);
      recordingDurationIntervalRef.current = null;
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recordingDurationIntervalRef.current) {
      clearInterval(recordingDurationIntervalRef.current);
      recordingDurationIntervalRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
    setAudioBlob(null);
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
    setAudioDuration(0);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Generate video thumbnail
  const generateVideoThumbnail = async (videoUrl: string, messageId: number) => {
    if (videoThumbnails[messageId]) return;
    
    try {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = videoUrl;
      video.currentTime = 1; // 1 second into video
      
      await new Promise((resolve, reject) => {
        video.onloadeddata = resolve;
        video.onerror = reject;
      });
      
      await new Promise((resolve) => {
        video.onseeked = resolve;
        video.currentTime = 1;
      });
      
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const thumbnailUrl = canvas.toDataURL("image/jpeg");
        setVideoThumbnails((prev) => ({ ...prev, [messageId]: thumbnailUrl }));
      }
    } catch (error) {
      console.error("Error generating video thumbnail:", error);
    }
  };

  // Audio player functions
  const playMessageAudio = async (audioUrl: string, messageId: number) => {
    try {
      // Stop any currently playing audio
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
        setPlayingAudioId(null);
        setWaveformHeights(Array(12).fill(8));
      }

      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      setPlayingAudioId(messageId);

      // Start waveform animation
      if (waveformIntervalRef.current) {
        clearInterval(waveformIntervalRef.current);
      }
      waveformIntervalRef.current = setInterval(() => {
        setWaveformHeights(Array(12).fill(0).map(() => Math.random() * 30 + 10));
      }, 150);

      audio.addEventListener("loadedmetadata", () => {
        setAudioPlayerDuration(Math.floor(audio.duration));
      });

      audio.addEventListener("timeupdate", () => {
        setAudioPosition(Math.floor(audio.currentTime));
      });

      audio.addEventListener("ended", () => {
        if (waveformIntervalRef.current) {
          clearInterval(waveformIntervalRef.current);
          waveformIntervalRef.current = null;
        }
        setPlayingAudioId(null);
        setWaveformHeights(Array(12).fill(8));
        setAudioPosition(0);
        setAudioPlayerDuration(0);
        audioPlayerRef.current = null;
      });

      await audio.play();
    } catch (error) {
      console.error("Error playing audio:", error);
      toast.show("Failed to play audio", "error");
    }
  };

  const stopMessageAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
      setPlayingAudioId(null);
      if (waveformIntervalRef.current) {
        clearInterval(waveformIntervalRef.current);
        waveformIntervalRef.current = null;
      }
      setWaveformHeights(Array(12).fill(8));
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingDurationIntervalRef.current) {
        clearInterval(recordingDurationIntervalRef.current);
      }
      if (waveformIntervalRef.current) {
        clearInterval(waveformIntervalRef.current);
      }
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, [audioPreviewUrl]);

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

  // Get background colors for themed backgrounds
  const getBackgroundColors = (): [string, string, string] => {
    switch (chatBackgroundTheme) {
      case "clouds":
        return ["#E3F2FD", "#BBDEFB", "#90CAF9"];
      case "nature":
        return ["#F1F8E9", "#DCEDC8", "#C5E1A5"];
      case "space":
        return ["#1A237E", "#283593", "#3949AB"];
      case "ocean":
        return ["#E1F5FE", "#B3E5FC", "#81D4FA"];
      case "forest":
        return ["#E8F5E9", "#C8E6C9", "#A5D6A7"];
      case "sunset":
        return ["#FFF3E0", "#FFCCBC", "#FFAB91"];
      case "stars":
        return ["#0D1B2A", "#1B263B", "#415A77"];
      case "american":
        return ["#B22234", "#FFFFFF", "#3C3B6E"];
      case "christmas":
        return ["#165B33", "#BB2528", "#F8F8F8"];
      case "halloween":
        return ["#FF6600", "#1A1A1A", "#FFA500"];
      case "butterflies":
        return ["#FFF0F5", "#FFE4E1", "#FFB6C1"];
      case "dragons":
        return ["#2C1810", "#8B4513", "#CD853F"];
      case "christmas-trees":
        return ["#0B6623", "#228B22", "#32CD32"];
      case "music-notes":
        return ["#663399", "#9370DB", "#BA55D3"];
      case "pixel-hearts":
        return ["#FF1744", "#F50057", "#C51162"];
      default:
        return ["#111827", "#111827", "#111827"];
    }
  };

  const hasAnimatedBackground = [
    "american",
    "christmas",
    "halloween",
    "clouds",
    "nature",
    "space",
    "ocean",
    "forest",
    "sunset",
    "stars",
    "butterflies",
    "dragons",
    "christmas-trees",
    "music-notes",
    "pixel-hearts",
  ].includes(chatBackgroundTheme);

  // Check if theme is an image URL
  const isImageBackground = typeof chatBackgroundTheme === "string" && 
    (chatBackgroundTheme.startsWith("/backgrounds/") || chatBackgroundTheme.startsWith("http"));

  // Get CSS class for animated backgrounds
  const getBackgroundClass = (): string => {
    if (isImageBackground) return "";
    if (chatBackgroundTheme === "default") return "";
    const themeMap: Record<string, string> = {
      american: "feed-bg-american",
      christmas: "feed-bg-christmas",
      halloween: "feed-bg-halloween",
      clouds: "feed-bg-clouds",
      nature: "feed-bg-nature",
      space: "feed-bg-space",
      ocean: "feed-bg-ocean",
      forest: "feed-bg-forest",
      sunset: "feed-bg-sunset",
      stars: "feed-bg-stars",
      butterflies: "feed-bg-butterflies",
      dragons: "feed-bg-dragons",
      "christmas-trees": "feed-bg-christmas-trees",
      "music-notes": "feed-bg-music-notes",
      "pixel-hearts": "feed-bg-pixel-hearts",
    };
    return themeMap[chatBackgroundTheme] || "";
  };

  return (
    <>
      <div 
        className={`flex flex-col h-[calc(100vh-200px)] sm:h-[calc(100vh-120px)] rounded-2xl border border-gray-700 overflow-hidden shadow-2xl mx-auto w-full relative ${getBackgroundClass()}`}
        style={{
          backgroundColor: backgroundMounted && chatBackgroundTheme !== "default" && !hasAnimatedBackground && !isImageBackground ? "transparent" : "#111827",
          backgroundImage: isImageBackground && backgroundMounted ? `url(${chatBackgroundTheme})` : undefined,
          backgroundSize: isImageBackground && backgroundMounted ? "cover" : undefined,
          backgroundPosition: isImageBackground && backgroundMounted ? "center" : undefined,
          backgroundRepeat: isImageBackground && backgroundMounted ? "no-repeat" : undefined,
        }}
      >
        {/* Background gradient layer for non-animated themes */}
        {backgroundMounted && !hasAnimatedBackground && !isImageBackground && chatBackgroundTheme !== "default" && (
          <div
            className="absolute inset-0 -z-10"
            style={{
              background: `linear-gradient(135deg, ${getBackgroundColors().join(", ")})`,
            }}
          />
        )}
        
        {/* Dark overlay for text visibility */}
        {backgroundMounted && chatBackgroundTheme !== "default" && (
          <div
            className="absolute inset-0 -z-10"
            style={{
              background: "linear-gradient(to bottom, rgba(0, 0, 0, 0.3) 0%, transparent 20%, transparent 100%)",
            }}
          />
        )}
        
        <header className="flex items-center gap-4 p-4 border-b border-gray-700 bg-gray-800/80 backdrop-blur-sm shadow-sm sticky z-20 flex-shrink-0" style={{ top: '0' }}>
          <button
            onClick={() => router.back()}
            className="text-gray-300 hover:text-white p-2 font-medium transition"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold flex-1 text-white">{getConversationTitle()}</h1>
          <div className="relative">
            <button
              onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
              className="text-gray-300 hover:text-white p-2 transition"
              title="Options"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M2 12h20" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            {headerMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setHeaderMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-gray-600 bg-gray-800 shadow-xl z-40">
                  {conversation && !conversation.is_group && (() => {
                    const otherParticipant = conversation.participants.find((p) => p.user.id !== user?.id);
                    if (!otherParticipant) return null;
                    return (
                      <>
                        <button
                          onClick={() => {
                            setHeaderMenuOpen(false);
                            router.push(`/app/users/${otherParticipant.user.id}`);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-gray-200 hover:bg-gray-700 rounded-t-lg flex items-center gap-3"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          View Profile
                        </button>
                        <button
                          onClick={() => {
                            setHeaderMenuOpen(false);
                            setUserToBlock({
                              id: otherParticipant.user.id,
                              name: otherParticipant.user.first_name || otherParticipant.user.username || 'this user'
                            });
                            setShowBlockConfirm(true);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-900/20 flex items-center gap-3"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                          Block User
                        </button>
                      </>
                    );
                  })()}
                  <button
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      setBackgroundModalOpen(true);
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-3"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v20M2 12h20" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Change Background
                  </button>
                  {conversation && (() => {
                    const userParticipant = conversation.participants.find((p) => p.user.id === user?.id);
                    const isArchived = userParticipant?.is_archived || false;
                    return (
                      <button
                        onClick={async () => {
                          setHeaderMenuOpen(false);
                          try {
                            if (isArchived) {
                              await apiPost(`/conversations/${conversationId}/unarchive/`, undefined, {
                                token: accessToken,
                                cache: "no-store",
                              });
                              toast.show("Conversation unarchived", "success");
                              // Reload conversation to update archived status
                              loadConversation();
                            } else {
                              await apiPost(`/conversations/${conversationId}/archive/`, undefined, {
                                token: accessToken,
                                cache: "no-store",
                              });
                              toast.show("Conversation archived", "success");
                              router.push("/app/messages");
                            }
                          } catch (error: any) {
                            const errorMessage = error?.response?.data?.message || error?.response?.data?.detail || `Failed to ${isArchived ? 'unarchive' : 'archive'} conversation`;
                            toast.show(errorMessage, "error");
                          }
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-3"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        {isArchived ? "Unarchive" : "Archive"}
                      </button>
                    );
                  })()}
                  <div className="border-t border-gray-700 my-1" />
                  <button
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      setShowClearChatConfirm(true);
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-900/20 rounded-b-lg flex items-center gap-3"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Clear Chat
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4"
          style={{
            backgroundColor: backgroundMounted && chatBackgroundTheme !== "default" && !hasAnimatedBackground && !isImageBackground ? "transparent" : (backgroundMounted && chatBackgroundTheme !== "default" ? "transparent" : "#111827"),
          }}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <p className="text-gray-500">No messages yet</p>
              <p className="text-sm text-gray-600">Start the conversation</p>
            </div>
          ) : (
            <>
              {loadingMore && (
                <div className="flex justify-center py-2">
                  <Spinner />
                </div>
              )}
              {messages.map((message, index) => {
                // Check if we need to show a date separator
                const showDateSeparator = (() => {
                  if (index === 0) return true; // Always show for first message
                  
                  const currentDate = new Date(message.created_at);
                  const previousMessage = messages[index - 1];
                  if (!previousMessage) return false;
                  
                  const previousDate = new Date(previousMessage.created_at);
                  
                  // Check if dates are different
                  return (
                    currentDate.getDate() !== previousDate.getDate() ||
                    currentDate.getMonth() !== previousDate.getMonth() ||
                    currentDate.getFullYear() !== previousDate.getFullYear()
                  );
                })();

                const formatDateSeparator = (date: Date): string => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  
                  const yesterday = new Date(today);
                  yesterday.setDate(yesterday.getDate() - 1);
                  
                  const messageDate = new Date(date);
                  messageDate.setHours(0, 0, 0, 0);
                  
                  if (messageDate.getTime() === today.getTime()) {
                    return "Today";
                  } else if (messageDate.getTime() === yesterday.getTime()) {
                    return "Yesterday";
                  } else {
                    // Format as DD/MM/YYYY
                    const day = String(messageDate.getDate()).padStart(2, "0");
                    const month = String(messageDate.getMonth() + 1).padStart(2, "0");
                    const year = messageDate.getFullYear();
                    return `${day}/${month}/${year}`;
                  }
                };

                if (message.is_deleted) {
                  return (
                    <div key={message.id}>
                      {showDateSeparator && (
                        <div className="flex justify-center my-4">
                          <span className="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-800 rounded-full">
                            {formatDateSeparator(new Date(message.created_at))}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-end">
                        <p className="text-sm text-gray-600 italic">
                          This message was deleted
                        </p>
                      </div>
                    </div>
                  );
                }

                const isOwn = message.sender.id === user?.id;
                const avatarUrl = message.sender.profile_image_url
                  ? resolveRemoteUrl(message.sender.profile_image_url)
                  : null;
                const userReaction = message.reactions?.find((r) => r.user?.id === user?.id);
                const isEditing = editingMessageId === message.id;

                if (message.is_deleted) {
                  return (
                    <div key={message.id}>
                      {showDateSeparator && (
                        <div className="flex justify-center my-4">
                          <span className="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-800 rounded-full">
                            {formatDateSeparator(new Date(message.created_at))}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-end">
                        <p className="text-sm text-gray-600 italic">
                          This message was deleted
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={message.id}>
                    {showDateSeparator && (
                      <div className="flex justify-center my-4">
                        <span className="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-800 rounded-full">
                          {formatDateSeparator(new Date(message.created_at))}
                        </span>
                      </div>
                    )}
                    <div
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
                              {message.media_url && (() => {
                                const mediaUrl = message.media_url;
                                const isVideo = isVideoUrl(mediaUrl);
                                const isAudio = isAudioUrl(mediaUrl);
                                
                                // Generate video thumbnail if needed
                                if (isVideo && !videoThumbnails[message.id]) {
                                  generateVideoThumbnail(mediaUrl, message.id);
                                }
                                
                                if (isAudio) {
                                  return (
                                    <div className="mb-2 p-3 rounded-lg bg-black/20 flex items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (playingAudioId === message.id) {
                                            stopMessageAudio();
                                          } else {
                                            playMessageAudio(mediaUrl, message.id);
                                          }
                                        }}
                                        className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition flex-shrink-0"
                                      >
                                        {playingAudioId === message.id ? (
                                          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                          </svg>
                                        ) : (
                                          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                            <path d="M8 5v14l11-7z" />
                                          </svg>
                                        )}
                                      </button>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1 mb-1" style={{ height: "24px" }}>
                                          {waveformHeights.map((height, i) => (
                                            <div
                                              key={i}
                                              className="bg-blue-400 rounded-full transition-all"
                                              style={{
                                                width: "3px",
                                                height: playingAudioId === message.id ? `${height}px` : "8px",
                                                minHeight: "8px",
                                                transition: "height 0.15s ease",
                                              }}
                                            />
                                          ))}
                                        </div>
                                        {playingAudioId === message.id && audioPlayerDuration > 0 && (
                                          <div className="flex items-center gap-2 text-xs text-gray-300">
                                            <span>{formatDuration(audioPosition)}</span>
                                            <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                                              <div
                                                className="h-full bg-blue-500 transition-all"
                                                style={{ width: `${(audioPosition / audioPlayerDuration) * 100}%` }}
                                              />
                                            </div>
                                            <span>{formatDuration(audioPlayerDuration)}</span>
                                          </div>
                                        )}
                                        {playingAudioId !== message.id && (
                                          <p className="text-xs text-gray-400">
                                            Voice note{(() => {
                                              if (message.content && message.content.includes("[duration:")) {
                                                const match = message.content.match(/\[duration:(\d+:\d+)\]/);
                                                if (match) return ` • ${match[1]}`;
                                              }
                                              return "";
                                            })()}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }
                                
                                if (isVideo) {
                                  return (
                                    <div className="mb-2 relative">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const index = galleryMedia.findIndex((m) => m.url === mediaUrl);
                                          if (index >= 0) {
                                            setGalleryIndex(index);
                                            setGalleryVisible(true);
                                          }
                                        }}
                                        className="block relative w-full"
                                        onMouseEnter={() => {
                                          if (!videoThumbnails[message.id]) {
                                            generateVideoThumbnail(mediaUrl, message.id);
                                          }
                                        }}
                                      >
                                        {videoThumbnails[message.id] ? (
                                          <div className="relative">
                                            <Image
                                              src={videoThumbnails[message.id]}
                                              alt="Video thumbnail"
                                              width={300}
                                              height={300}
                                              className="rounded-lg object-cover max-h-[300px] w-full"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                                              <svg width="64" height="64" viewBox="0 0 24 24" fill="white">
                                                <path d="M8 5v14l11-7z" />
                                              </svg>
                                            </div>
                                          </div>
                                        ) : (
                                          <video
                                            src={mediaUrl}
                                            className="max-w-full h-auto rounded-lg"
                                            style={{ maxHeight: "300px" }}
                                            preload="metadata"
                                          />
                                        )}
                                      </button>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <div className="mb-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const index = galleryMedia.findIndex((m) => m.url === mediaUrl);
                                        if (index >= 0) {
                                          setGalleryIndex(index);
                                          setGalleryVisible(true);
                                        }
                                      }}
                                      className="block"
                                    >
                                      <Image
                                        src={mediaUrl}
                                        alt="Message media"
                                        width={300}
                                        height={300}
                                        className="rounded-lg object-cover max-h-[300px]"
                                      />
                                    </button>
                                  </div>
                                );
                              })()}
                              {message.content && (() => {
                                // Filter out [duration:...] from content display
                                let displayContent = message.content;
                                if (displayContent.includes("[duration:")) {
                                  displayContent = displayContent.replace(/\[duration:\d+:\d+\]/g, "").trim();
                                }
                                return displayContent ? (
                                  <p 
                                    className="text-sm whitespace-pre-wrap break-words"
                                    style={{
                                      textShadow: chatBackgroundTheme !== "default" ? "0 1px 2px rgba(0, 0, 0, 0.5)" : "none",
                                    }}
                                  >
                                    {displayContent}
                                  </p>
                                ) : null;
                              })()}
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
                                    {message.content && (
                                      <button
                                        onClick={async () => {
                                          try {
                                            await navigator.clipboard.writeText(message.content || "");
                                            toast.show("Message copied to clipboard", "success");
                                            setOpenMessageMenuId(null);
                                          } catch (error) {
                                            toast.show("Failed to copy message", "error");
                                          }
                                        }}
                                        className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 rounded-t-lg"
                                      >
                                        Copy
                                      </button>
                                    )}
                                    {isOwn && (
                                      <>
                                        <button
                                          onClick={() => {
                                            setEditText(message.content || "");
                                            setEditingMessageId(message.id);
                                            setOpenMessageMenuId(null);
                                          }}
                                          className={`w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 ${message.content ? "" : "rounded-t-lg"}`}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => handleDeleteMessage(message.id)}
                                          className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-900/20 rounded-b-lg"
                                        >
                                          Delete
                                        </button>
                                      </>
                                    )}
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
                </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-gray-700 bg-gray-800/80 backdrop-blur-sm p-3 sm:p-4">
          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <TypingIndicator typingUsers={typingUsers} className="mb-3" />
          )}
          {/* Audio preview */}
          {audioPreviewUrl && !isRecording && (
            <div className="mb-2 p-3 rounded-lg bg-gray-700 flex items-center gap-3">
              <audio ref={audioElementRef} src={audioPreviewUrl} className="hidden" />
              <button
                type="button"
                onClick={async () => {
                  if (audioElementRef.current) {
                    try {
                      if (audioElementRef.current.paused) {
                        await audioElementRef.current.play();
                      } else {
                        audioElementRef.current.pause();
                      }
                    } catch (error) {
                      console.error("Error playing preview audio:", error);
                    }
                  }
                }}
                className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition flex-shrink-0"
              >
                {audioElementRef.current && !audioElementRef.current.paused ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <div className="flex-1">
                <p className="text-sm text-white">Voice note</p>
                <p className="text-xs text-gray-400">{formatDuration(audioDuration || recordingDuration)}</p>
              </div>
              <button
                type="button"
                onClick={cancelRecording}
                className="text-red-400 hover:text-red-300 p-2"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
          {/* Recording indicator */}
          {isRecording && (
            <div className="mb-2 p-3 rounded-lg bg-red-900/30 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <div className="flex-1">
                <p className="text-sm text-white">Recording...</p>
                <p className="text-xs text-gray-400">{formatDuration(recordingDuration)}</p>
              </div>
              <button
                type="button"
                onClick={stopRecording}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
              >
                Stop
              </button>
            </div>
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
            {!isRecording && !audioPreviewUrl && (
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
            )}
            {!isRecording && !audioPreviewUrl && (
              <button
                type="button"
                onClick={startRecording}
                className="p-2.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition flex-shrink-0"
                title="Record voice note"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19 10v2a7 7 0 0 1-14 0v-2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
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
                      title="Add emoji"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <line x1="9" y1="9" x2="9.01" y2="9" />
                        <line x1="15" y1="9" x2="15.01" y2="9" />
                      </svg>
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
              disabled={(!messageText.trim() && !mediaAttachment && !audioBlob) || sending || isRecording}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition flex-shrink-0"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
      </div>

      {/* Image Gallery */}
      {galleryVisible && galleryMedia.length > 0 && (
        <ImageGallery
          open={galleryVisible}
          onClose={() => setGalleryVisible(false)}
          images={galleryMedia.map((m) => m.url)}
          currentIndex={galleryIndex}
          onNavigate={(direction) => {
            if (direction === "prev" && galleryIndex > 0) {
              setGalleryIndex(galleryIndex - 1);
            } else if (direction === "next" && galleryIndex < galleryMedia.length - 1) {
              setGalleryIndex(galleryIndex + 1);
            }
          }}
          onSelect={(index) => setGalleryIndex(index)}
        />
      )}
      <ReactionsModal
        reactions={reactionsModalData}
        isOpen={reactionsModalOpen}
        onClose={() => setReactionsModalOpen(false)}
        postOrCommentTitle="Message"
      />
      <FeedBackgroundModal
        open={backgroundModalOpen}
        onClose={() => setBackgroundModalOpen(false)}
        currentTheme={chatBackgroundTheme}
        onThemeChange={changeTheme}
      />

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={showDeleteMessageConfirm}
        title="Delete Message"
        message="Are you sure you want to delete this message?"
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={async () => {
          if (!accessToken || !conversationId || !messageToDelete) return;
          try {
            await apiDelete(`/conversations/${conversationId}/messages/${messageToDelete}/`, {
              token: accessToken,
              cache: "no-store",
            });
            setMessages((prev) =>
              prev.map((m) => (m.id === messageToDelete ? { ...m, is_deleted: true } : m))
            );
            setOpenMessageMenuId(null);
            toast.show("Message deleted", "success");
          } catch (error) {
            toast.show("Failed to delete message", "error");
          } finally {
            setShowDeleteMessageConfirm(false);
            setMessageToDelete(null);
          }
        }}
        onCancel={() => {
          setShowDeleteMessageConfirm(false);
          setMessageToDelete(null);
        }}
      />

      <ConfirmationDialog
        isOpen={showBlockConfirm}
        title="Block User"
        message={`Are you sure you want to block ${userToBlock?.name}? You won't be able to see their posts or interact with them.`}
        confirmText="Block"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={async () => {
          if (!accessToken || !userToBlock) return;
          try {
            await apiPost("/auth/blocks/", { blocked_user_id: userToBlock.id }, {
              token: accessToken,
              cache: "no-store",
            });
            toast.show(`${userToBlock.name} has been blocked`, "success");
            router.push("/app/messages");
          } catch (error: any) {
            const errorMessage = error?.response?.data?.message || error?.response?.data?.detail || "Failed to block user";
            toast.show(errorMessage, "error");
          } finally {
            setShowBlockConfirm(false);
            setUserToBlock(null);
          }
        }}
        onCancel={() => {
          setShowBlockConfirm(false);
          setUserToBlock(null);
        }}
      />

      <ConfirmationDialog
        isOpen={showClearChatConfirm}
        title="Clear Chat"
        message="Are you sure you want to clear all messages in this chat? This action cannot be undone."
        confirmText="Clear"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={async () => {
          if (!accessToken || !conversationId) return;
          try {
            // Fetch all messages and delete them
            let allMessages: Message[] = [];
            let nextUrl: string | null = `/conversations/${conversationId}/messages/`;
            
            while (nextUrl) {
              const response: PaginatedResponse<Message> = await apiGet<PaginatedResponse<Message>>(nextUrl, {
                token: accessToken,
                cache: "no-store",
              });
              if (response.results) {
                allMessages = [...allMessages, ...response.results];
              }
              nextUrl = response.next || null;
            }
            
            // Delete all messages
            if (allMessages.length > 0) {
              await Promise.all(
                allMessages.map((msg) =>
                  apiDelete(`/conversations/${conversationId}/messages/${msg.id}/`, {
                    token: accessToken,
                    cache: "no-store",
                  })
                )
              );
            }
            
            setMessages([]);
            toast.show("Chat cleared", "success");
          } catch (error: any) {
            toast.show("Failed to clear chat", "error");
          } finally {
            setShowClearChatConfirm(false);
          }
        }}
        onCancel={() => setShowClearChatConfirm(false)}
      />
    </>
  );
}
