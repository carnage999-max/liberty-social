"use client";

import Spinner from "@/components/Spinner";
import { useAuth } from "@/lib/auth-context";
import { apiPost, apiGet } from "@/lib/api";
import type { Conversation, Friend } from "@/lib/types";
import type { PaginatedResponse } from "@/lib/api";
import { useConversations } from "@/hooks/useConversations";
import { usePaginatedResource } from "@/hooks/usePaginatedResource";
import { useCallback, useState, useEffect, useMemo } from "react";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { resolveRemoteUrl } from "@/lib/api";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import CallHistoryModal from "@/components/calls/CallHistoryModal";

export default function MessagesPage() {
  const { accessToken, user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const {
    conversations,
    loading,
    error,
    next,
    loadMore,
    loadingMore,
    refresh,
  } = useConversations();
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [showCallHistoryModal, setShowCallHistoryModal] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedArchivedConversations, setSelectedArchivedConversations] = useState<Set<number>>(new Set());
  const [isArchivedSelectionMode, setIsArchivedSelectionMode] = useState(false);
  const { items: friends, loading: loadingFriends } = usePaginatedResource<Friend>(
    "/auth/friends/",
    {
      enabled: !!accessToken && showNewConversation,
    }
  );

  // Load archived conversations
  const loadArchivedConversations = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await apiGet<PaginatedResponse<Conversation>>("/conversations/?include_archived=true", {
        token: accessToken,
        cache: "no-store",
      });
      const archived = response.results.filter((conv) => {
        const participant = conv.participants.find((p) => p.user.id === user?.id);
        return participant?.is_archived;
      });
      setArchivedConversations(archived.sort((a, b) => {
        const aTime = new Date(a.last_message_at || a.created_at).getTime();
        const bTime = new Date(b.last_message_at || b.created_at).getTime();
        return bTime - aTime;
      }));
    } catch (error) {
      console.error("Failed to load archived conversations:", error);
    }
  }, [accessToken, user?.id]);

  useEffect(() => {
    loadArchivedConversations();
  }, [loadArchivedConversations]);

  const handleArchiveChats = async () => {
    if (selectedConversations.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedConversations).map((convId) =>
          apiPost(`/conversations/${convId}/archive/`, undefined, {
            token: accessToken,
            cache: "no-store",
          })
        )
      );
      toast.show(`${selectedConversations.size} conversation(s) archived`, "success");
      setSelectedConversations(new Set());
      setIsSelectionMode(false);
      refresh();
      loadArchivedConversations();
    } catch (error) {
      toast.show("Failed to archive conversations", "error");
    }
  };

  const handleUnarchiveChats = async () => {
    if (selectedArchivedConversations.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedArchivedConversations).map((convId) =>
          apiPost(`/conversations/${convId}/unarchive/`, undefined, {
            token: accessToken,
            cache: "no-store",
          })
        )
      );
      toast.show(`${selectedArchivedConversations.size} conversation(s) unarchived`, "success");
      setSelectedArchivedConversations(new Set());
      setIsArchivedSelectionMode(false);
      loadArchivedConversations();
      refresh();
    } catch (error) {
      toast.show("Failed to unarchive conversations", "error");
    }
  };

  const handleConversationLongPress = (conversationId: number) => {
    setIsSelectionMode(true);
    setSelectedConversations(new Set([conversationId]));
  };

  const handleConversationPress = (conversationId: number) => {
    if (isSelectionMode) {
      setSelectedConversations((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(conversationId)) {
          newSet.delete(conversationId);
        } else {
          newSet.add(conversationId);
        }
        if (newSet.size === 0) {
          setIsSelectionMode(false);
        }
        return newSet;
      });
    } else {
      router.push(`/app/messages/${conversationId}`);
    }
  };

  const handleArchivedConversationLongPress = (conversationId: number) => {
    setIsArchivedSelectionMode(true);
    setSelectedArchivedConversations(new Set([conversationId]));
  };

  const handleArchivedConversationPress = (conversationId: number) => {
    if (isArchivedSelectionMode) {
      setSelectedArchivedConversations((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(conversationId)) {
          newSet.delete(conversationId);
        } else {
          newSet.add(conversationId);
        }
        if (newSet.size === 0) {
          setIsArchivedSelectionMode(false);
        }
        return newSet;
      });
    } else {
      router.push(`/app/messages/${conversationId}`);
    }
  };

  const handleStartConversation = useCallback(
    async (friendId: string) => {
      if (!accessToken) return;
      try {
        setCreatingConversation(true);
        // Check if conversation already exists
        const existingConversations = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/conversations/`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        ).then((res) => res.json());

        const existing = existingConversations.results?.find((conv: Conversation) => {
          if (conv.is_group) return false;
          return conv.participants.some((p) => p.user.id === friendId);
        });

        if (existing) {
          setShowNewConversation(false);
          router.push(`/app/messages/${existing.id}`);
          return;
        }

        // Create new conversation
        const conversation = await apiPost<Conversation>(
          "/conversations/",
          {
            is_group: false,
            participant_ids: [friendId],
          },
          {
            token: accessToken,
            cache: "no-store",
          }
        );

        setShowNewConversation(false);
        toast.show("Conversation started", "success");
        router.push(`/app/messages/${conversation.id}`);
        refresh();
      } catch (err) {
        console.error(err);
        toast.show("Failed to start conversation", "error");
      } finally {
        setCreatingConversation(false);
      }
    },
    [accessToken, router, toast, refresh]
  );

  const getConversationTitle = (conversation: Conversation): string => {
    if (conversation.title) return conversation.title;
    if (conversation.is_group) return "Group Chat";
    // Find the other participant (not the current user)
    const otherParticipant = conversation.participants.find(
      (p) => p.user.id !== user?.id
    );
    if (otherParticipant) {
      const u = otherParticipant.user;
      if (u.first_name && u.last_name) return `${u.first_name} ${u.last_name}`;
      if (u.username) return u.username;
      return u.email.split("@")[0];
    }
    return "Unknown User";
  };

  const getConversationAvatar = (conversation: Conversation): string | null => {
    if (conversation.is_group) return null;
    // Find the other participant (not the current user)
    const otherParticipant = conversation.participants.find(
      (p) => p.user.id !== user?.id
    );
    if (otherParticipant?.user.profile_image_url) {
      return resolveRemoteUrl(otherParticipant.user.profile_image_url);
    }
    return null;
  };

  const formatTime = (dateString: string | null | undefined): string => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = now.getTime() - date.getTime();
    const daysDiff = Math.floor((today.getTime() - messageDate.getTime()) / 86400000);

    // Today: show time (e.g., "2:30 PM")
    if (daysDiff === 0) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    }
    
    // Yesterday
    if (daysDiff === 1) {
      return 'Yesterday';
    }
    
    // This week: show day name (e.g., "Monday")
    if (daysDiff < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    }
    
    // Older: show date (e.g., "12/25/2024")
    return date.toLocaleDateString('en-US', { 
      month: 'numeric', 
      day: 'numeric',
      year: daysDiff > 365 ? 'numeric' : undefined
    });
  };

  // Helper to format last message preview with media indicators
  const formatLastMessage = (conversation: Conversation): string => {
    const lastMessage = conversation.last_message;
    if (!lastMessage) return "No messages yet";
    
    if (lastMessage.is_deleted) {
      return "🚫 This message was deleted";
    }
    
    if (lastMessage.media_url) {
      const mediaUrl = resolveRemoteUrl(lastMessage.media_url);
      const isVideo = /\.(mp4|mov|m4v|webm|mkv|avi|3gp)(\?.*)?$/i.test(mediaUrl || "");
      const isAudio = /\.(m4a|mp3|wav|aac|ogg|flac|wma|webm)(\?.*)?$/i.test(mediaUrl || "");
      
      if (isAudio) {
        // Extract duration from content if available (format: "[duration:MM:SS]")
        let durationText = "";
        if (lastMessage.content && lastMessage.content.includes("[duration:")) {
          const durationMatch = lastMessage.content.match(/\[duration:(\d+:\d+)\]/);
          if (durationMatch) {
            durationText = ` (${durationMatch[1]})`;
          }
        }
        const contentText = lastMessage.content && !lastMessage.content.includes("[duration:")
          ? lastMessage.content.replace(/\[duration:\d+:\d+\]/g, "").trim()
          : "";
        return contentText 
          ? `🎤 ${contentText}${durationText}` 
          : `🎤 Voice message${durationText}`;
      } else if (isVideo) {
        return lastMessage.content 
          ? `🎥 ${lastMessage.content}` 
          : "🎥 Video";
      } else {
        return lastMessage.content 
          ? `📷 ${lastMessage.content}` 
          : "📷 Photo";
      }
    }
    
    let messageText = lastMessage.content || "No messages yet";
    
    // Add sender name for group chats
    if (conversation.is_group && lastMessage.sender) {
      const senderName = lastMessage.sender.id === user?.id 
        ? "You" 
        : (lastMessage.sender.first_name || lastMessage.sender.username || "Someone");
      messageText = `${senderName}: ${messageText}`;
    } else if (lastMessage.sender?.id === user?.id && !conversation.is_group) {
      // Add "You: " prefix for your own messages in DMs
      messageText = `You: ${messageText}`;
    }
    
    return messageText;
  };

  // Determine read/unread status of selected conversations
  const selectedConversationsStatus = useMemo(() => {
    if (selectedConversations.size === 0) {
      return { allRead: false, allUnread: false, mixed: false };
    }

    let readCount = 0;
    let unreadCount = 0;

    selectedConversations.forEach((convId) => {
      const conversation = conversations.find((c) => c.id === convId);
      if (!conversation) return;

      const userParticipant = conversation.participants.find(
        (p) => String(p.user.id) === String(user?.id)
      );
      const lastReadTs = userParticipant?.last_read_at
        ? new Date(userParticipant.last_read_at).getTime()
        : null;
      const lastMessage = conversation.last_message;
      const lastMessageTs = lastMessage?.created_at
        ? new Date(lastMessage.created_at).getTime()
        : null;
      const lastMessageAtTs = conversation.last_message_at
        ? new Date(conversation.last_message_at).getTime()
        : null;
      const latestActivityTs = lastMessageTs ?? lastMessageAtTs;
      const hasUnread = Boolean(
        latestActivityTs && (!lastReadTs || lastReadTs < latestActivityTs)
      );

      if (hasUnread) {
        unreadCount++;
      } else {
        readCount++;
      }
    });

    const total = readCount + unreadCount;
    if (total === 0) {
      return { allRead: false, allUnread: false, mixed: false };
    }

    return {
      allRead: readCount > 0 && unreadCount === 0,
      allUnread: unreadCount > 0 && readCount === 0,
      mixed: readCount > 0 && unreadCount > 0,
    };
  }, [selectedConversations, conversations, user]);

  // Handle mark read/unread
  const handleMarkRead = async () => {
    try {
      const promises = Array.from(selectedConversations).map((convId) =>
        apiPost(`/conversations/${convId}/mark-read/`, undefined, {
          token: accessToken,
          cache: "no-store",
        })
      );
      await Promise.all(promises);
      toast.show(`${selectedConversations.size} conversation(s) marked as read`, "success");
      setSelectedConversations(new Set());
      setIsSelectionMode(false);
      refresh();
    } catch (error) {
      toast.show("Failed to mark conversations as read", "error");
    }
  };

  const handleMarkUnread = async () => {
    try {
      const promises = Array.from(selectedConversations).map((convId) =>
        apiPost(`/conversations/${convId}/mark-unread/`, undefined, {
          token: accessToken,
          cache: "no-store",
        })
      );
      await Promise.all(promises);
      toast.show(`${selectedConversations.size} conversation(s) marked as unread`, "success");
      setSelectedConversations(new Set());
      setIsSelectionMode(false);
      refresh();
    } catch (error) {
      toast.show("Failed to mark conversations as unread", "error");
    }
  };

  const handleClearArchivedChats = async () => {
    try {
      // Clear messages in selected archived conversations
      const promises = Array.from(selectedArchivedConversations).map(async (convId) => {
        let allMessages: any[] = [];
        let nextUrl: string | null = `/conversations/${convId}/messages/?include_archived=true`;
        
        // Fetch all messages (handle pagination)
        while (nextUrl) {
          const response: PaginatedResponse<any> = await apiGet<PaginatedResponse<any>>(nextUrl, {
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
          const deletePromises = allMessages.map((msg: any) =>
            apiPost(`/conversations/${convId}/messages/${msg.id}/delete/?include_archived=true`, undefined, {
              token: accessToken,
              cache: "no-store",
            }).catch(() => {
              // Fallback without query param
              return apiPost(`/conversations/${convId}/messages/${msg.id}/delete/`, undefined, {
                token: accessToken,
                cache: "no-store",
              });
            })
          );
          await Promise.all(deletePromises);
        }
      });
      await Promise.all(promises);
      toast.show(`${selectedArchivedConversations.size} chat(s) cleared`, "success");
      setSelectedArchivedConversations(new Set());
      setIsArchivedSelectionMode(false);
      loadArchivedConversations();
    } catch (error) {
      toast.show("Failed to clear chats", "error");
    }
  };

  const handleClearChats = async () => {
    try {
      // Clear messages in selected conversations by deleting all messages
      const promises = Array.from(selectedConversations).map(async (convId) => {
        let allMessages: any[] = [];
        let nextUrl: string | null = `/conversations/${convId}/messages/`;
        
        // Fetch all messages (handle pagination)
        while (nextUrl) {
          const response: PaginatedResponse<any> = await apiGet<PaginatedResponse<any>>(nextUrl, {
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
          const deletePromises = allMessages.map((msg: any) =>
            apiPost(`/conversations/${convId}/messages/${msg.id}/delete/`, undefined, {
              token: accessToken,
              cache: "no-store",
            })
          );
          await Promise.all(deletePromises);
        }
      });
      await Promise.all(promises);
      toast.show(`${selectedConversations.size} chat(s) cleared`, "success");
      setSelectedConversations(new Set());
      setIsSelectionMode(false);
      refresh();
    } catch (error) {
      toast.show("Failed to clear chats", "error");
    }
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showClearArchivedConfirm, setShowClearArchivedConfirm] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => refresh()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Archived Chats Row - Show at top if there are archived chats */}
      {archivedConversations.length > 0 && !isSelectionMode && (
        <button
          onClick={() => setShowArchivedModal(true)}
          className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-gold)]">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span className="text-gray-300 font-medium">Archived Chats</span>
          <span className="ml-auto px-2 py-1 bg-[var(--color-gold)] text-[var(--color-deep-navy)] rounded-full text-xs font-bold">
            {archivedConversations.length}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      {/* Call History Row */}
      {!isSelectionMode && (
        <button
          onClick={() => setShowCallHistoryModal(true)}
          className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span className="text-gray-300 font-medium">Call History</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-auto text-gray-400">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Messages</h1>
        <div className="flex items-center gap-2">
          {isSelectionMode && selectedConversations.size > 0 && (
            <>
              {/* Show Mark Read only if all are unread OR mixed */}
              {(selectedConversationsStatus.allUnread || selectedConversationsStatus.mixed) && (
                <button
                  onClick={handleMarkRead}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Mark Read
                </button>
              )}
              {/* Show Mark Unread only if all are read OR mixed */}
              {(selectedConversationsStatus.allRead || selectedConversationsStatus.mixed) && (
                <button
                  onClick={handleMarkUnread}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                  </svg>
                  Mark Unread
                </button>
              )}
              <button
                onClick={() => setShowArchiveConfirm(true)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Archive
              </button>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Clear
              </button>
            </>
          )}
          {isSelectionMode && (
            <button
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedConversations(new Set());
              }}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
          )}
          {!isSelectionMode && (
        <button
          onClick={() => setShowNewConversation(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <span>+</span>
          <span>New Conversation</span>
        </button>
          )}
        </div>
      </header>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <p className="text-gray-400">No conversations yet</p>
          <p className="text-sm text-gray-500">Start a conversation with a friend</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-700 bg-gray-900 overflow-hidden shadow-xl">
          <div className="space-y-0">
            {conversations.map((conversation, idx) => {
              const title = getConversationTitle(conversation);
              const avatarUrl = getConversationAvatar(conversation);
              const lastMessage = conversation.last_message;
              const lastMessageText = formatLastMessage(conversation);
              const lastMessageTime = formatTime(conversation.last_message_at);
              
              // Check unread status
              const userParticipant = conversation.participants.find(
                (p) => String(p.user.id) === String(user?.id)
              );
              const lastReadTs = userParticipant?.last_read_at
                ? new Date(userParticipant.last_read_at).getTime()
                : null;
              const lastMessageTs = lastMessage?.created_at
                ? new Date(lastMessage.created_at).getTime()
                : null;
              const lastMessageAtTs = conversation.last_message_at
                ? new Date(conversation.last_message_at).getTime()
                : null;
              const latestActivityTs = lastMessageTs ?? lastMessageAtTs;
              const hasUnread = Boolean(
                latestActivityTs && (!lastReadTs || lastReadTs < latestActivityTs)
              );
              const isSelected = selectedConversations.has(conversation.id);

              return (
                <button
                  key={conversation.id}
                  onClick={() => handleConversationPress(conversation.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleConversationLongPress(conversation.id);
                  }}
                  className={`w-full flex items-center gap-4 p-4 hover:bg-gray-800 transition-colors text-left ${
                    idx !== conversations.length - 1 ? "border-b border-gray-700" : ""
                  } ${isSelected ? "bg-blue-900/30" : ""} ${hasUnread ? "bg-gray-800/50" : ""}`}
                >
                  {isSelectionMode && (
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "bg-blue-600 border-blue-600" : "border-gray-600"
                    }`}>
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      )}
                    </div>
                  )}
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-gray-400">
                          {conversation.is_group ? "👥" : "👤"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`font-semibold truncate ${hasUnread ? "text-white font-bold" : "text-white"}`}>{title}</h3>
                      {lastMessageTime && (
                        <span className={`text-xs flex-shrink-0 ${hasUnread ? "text-[var(--color-gold)] font-semibold" : "text-gray-400"}`}>
                          {lastMessageTime}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${hasUnread ? "text-white font-medium" : "text-gray-400"}`}>{lastMessageText}</p>
                      {hasUnread && !isSelectionMode && (
                        <div className="w-2 h-2 rounded-full bg-[var(--color-gold)] flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            {next && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-4 text-blue-400 hover:text-blue-300 disabled:opacity-50 text-center border-t border-gray-700 transition"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Archived Conversations Modal */}
      {showArchivedModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => {
          if (!isArchivedSelectionMode) {
            setShowArchivedModal(false);
            setIsArchivedSelectionMode(false);
            setSelectedArchivedConversations(new Set());
          }
        }}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">
                {isArchivedSelectionMode ? `${selectedArchivedConversations.size} selected` : "Archived Chats"}
              </h2>
              <div className="flex items-center gap-2">
                {isArchivedSelectionMode && (
                  <button
                    onClick={() => {
                      setIsArchivedSelectionMode(false);
                      setSelectedArchivedConversations(new Set());
                    }}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowArchivedModal(false);
                    setIsArchivedSelectionMode(false);
                    setSelectedArchivedConversations(new Set());
                  }}
                  className="text-gray-400 hover:text-white transition"
                >
                  ✕
                </button>
              </div>
            </div>
            {/* Action Bar for Archived Conversations */}
            {isArchivedSelectionMode && selectedArchivedConversations.size > 0 && (
              <div className="mb-4 pb-4 border-b border-gray-700 flex items-center gap-2 overflow-x-auto">
                {/* Show Mark Read only if all are unread OR mixed */}
                {(() => {
                  let readCount = 0;
                  let unreadCount = 0;
                  selectedArchivedConversations.forEach((convId) => {
                    const conversation = archivedConversations.find((c) => c.id === convId);
                    if (!conversation) return;
                    const userParticipant = conversation.participants.find(
                      (p) => String(p.user.id) === String(user?.id)
                    );
                    const lastReadTs = userParticipant?.last_read_at
                      ? new Date(userParticipant.last_read_at).getTime()
                      : null;
                    const lastMessage = conversation.last_message;
                    const lastMessageTs = lastMessage?.created_at
                      ? new Date(lastMessage.created_at).getTime()
                      : null;
                    const lastMessageAtTs = conversation.last_message_at
                      ? new Date(conversation.last_message_at).getTime()
                      : null;
                    const latestActivityTs = lastMessageTs ?? lastMessageAtTs;
                    const hasUnread = Boolean(
                      latestActivityTs && (!lastReadTs || lastReadTs < latestActivityTs)
                    );
                    if (hasUnread) unreadCount++;
                    else readCount++;
                  });
                  const allUnread = unreadCount > 0 && readCount === 0;
                  const allRead = readCount > 0 && unreadCount === 0;
                  const mixed = readCount > 0 && unreadCount > 0;
                  
                  return (
                    <>
                      {(allUnread || mixed) && (
                        <button
                          onClick={async () => {
                            try {
                              const promises = Array.from(selectedArchivedConversations).map((convId) =>
                                apiPost(`/conversations/${convId}/mark-read/?include_archived=true`, undefined, {
                                  token: accessToken,
                                  cache: "no-store",
                                }).catch(() => {
                                  // Fallback without query param
                                  return apiPost(`/conversations/${convId}/mark-read/`, undefined, {
                                    token: accessToken,
                                    cache: "no-store",
                                  });
                                })
                              );
                              await Promise.all(promises);
                              toast.show(`${selectedArchivedConversations.size} conversation(s) marked as read`, "success");
                              setSelectedArchivedConversations(new Set());
                              setIsArchivedSelectionMode(false);
                              loadArchivedConversations();
                            } catch (error) {
                              toast.show("Failed to mark conversations as read", "error");
                            }
                          }}
                          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2 text-sm whitespace-nowrap"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          Mark Read
                        </button>
                      )}
                      {(allRead || mixed) && (
                        <button
                          onClick={async () => {
                            try {
                              const promises = Array.from(selectedArchivedConversations).map((convId) =>
                                apiPost(`/conversations/${convId}/mark-unread/?include_archived=true`, undefined, {
                                  token: accessToken,
                                  cache: "no-store",
                                }).catch(() => {
                                  return apiPost(`/conversations/${convId}/mark-unread/`, undefined, {
                                    token: accessToken,
                                    cache: "no-store",
                                  });
                                })
                              );
                              await Promise.all(promises);
                              toast.show(`${selectedArchivedConversations.size} conversation(s) marked as unread`, "success");
                              setSelectedArchivedConversations(new Set());
                              setIsArchivedSelectionMode(false);
                              loadArchivedConversations();
                            } catch (error) {
                              toast.show("Failed to mark conversations as unread", "error");
                            }
                          }}
                          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2 text-sm whitespace-nowrap"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                          </svg>
                          Mark Unread
                        </button>
                      )}
                      <button
                        onClick={handleUnarchiveChats}
                        className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2 text-sm whitespace-nowrap"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Unarchive
                      </button>
                      <button
                        onClick={() => {
                          setShowClearArchivedConfirm(true);
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm whitespace-nowrap"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Clear
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
            {archivedConversations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">No archived conversations</p>
              </div>
            ) : (
              <div className="space-y-0">
                {archivedConversations.map((conversation) => {
                  const title = getConversationTitle(conversation);
                  const avatarUrl = getConversationAvatar(conversation);
                  const lastMessage = conversation.last_message;
                  const lastMessageText = formatLastMessage(conversation);
                  const lastMessageTime = formatTime(conversation.last_message_at);
                  const isSelected = selectedArchivedConversations.has(conversation.id);

                  return (
                    <button
                      key={conversation.id}
                      onClick={() => handleArchivedConversationPress(conversation.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleArchivedConversationLongPress(conversation.id);
                      }}
                      className="w-full flex items-center gap-4 p-4 hover:bg-gray-800 transition-colors text-left border-b border-gray-700 last:border-b-0"
                    >
                      {isArchivedSelectionMode && (
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? "bg-blue-600 border-blue-600" : "border-gray-600"
                        }`}>
                          {isSelected && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                          )}
                        </div>
                      )}
                      <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                        {avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt={title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-gray-400">
                              {conversation.is_group ? "👥" : "👤"}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold truncate text-white">{title}</h3>
                          {lastMessageTime && (
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {lastMessageTime}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 truncate">{lastMessageText}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Conversation Modal */}
      {showNewConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">New Conversation</h2>
              <button
                onClick={() => setShowNewConversation(false)}
                className="text-gray-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>
            {loadingFriends ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : friends.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">No friends yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Add friends to start conversations
                </p>
              </div>
            ) : (
              <>
                {friends.filter((friend) => friend.friend.id !== user?.id).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No other friends to message</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Add more friends to start conversations
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friends
                      .filter((friend) => friend.friend.id !== user?.id)
                      .map((friend) => {
                        const friendUser = friend.friend;
                        const displayName =
                          friendUser.first_name && friendUser.last_name
                            ? `${friendUser.first_name} ${friendUser.last_name}`
                            : friendUser.username || friendUser.email.split("@")[0];
                        const avatarUrl = friendUser.profile_image_url
                          ? resolveRemoteUrl(friendUser.profile_image_url)
                          : null;

                        return (
                          <button
                            key={friend.id}
                            onClick={() => handleStartConversation(friendUser.id)}
                            disabled={creatingConversation}
                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors text-left disabled:opacity-50 border border-gray-700"
                          >
                            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-700 shrink-0">
                              {avatarUrl ? (
                                <Image
                                  src={avatarUrl}
                                  alt={displayName}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-gray-400">👤</span>
                                </div>
                              )}
                            </div>
                            <span className="font-medium text-white">{displayName}</span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={showClearConfirm}
        title="Clear Chats"
        message={`Are you sure you want to clear all messages in ${selectedConversations.size} selected chat(s)? This action cannot be undone.`}
        confirmText="Clear"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={() => {
          setShowClearConfirm(false);
          handleClearChats();
        }}
        onCancel={() => setShowClearConfirm(false)}
      />

      <ConfirmationDialog
        isOpen={showArchiveConfirm}
        title="Archive Conversations"
        message={`Are you sure you want to archive ${selectedConversations.size} conversation(s)?`}
        confirmText="Archive"
        cancelText="Cancel"
        confirmVariant="default"
        onConfirm={() => {
          setShowArchiveConfirm(false);
          handleArchiveChats();
        }}
        onCancel={() => setShowArchiveConfirm(false)}
      />

      <ConfirmationDialog
        isOpen={showClearArchivedConfirm}
        title="Clear Archived Chats"
        message={`Are you sure you want to clear all messages in ${selectedArchivedConversations.size} selected archived chat(s)? This action cannot be undone.`}
        confirmText="Clear"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={() => {
          setShowClearArchivedConfirm(false);
          handleClearArchivedChats();
        }}
        onCancel={() => setShowClearArchivedConfirm(false)}
      />

      {/* Call History Modal */}
      <CallHistoryModal
        isOpen={showCallHistoryModal}
        onClose={() => setShowCallHistoryModal(false)}
      />
    </div>
  );
}

