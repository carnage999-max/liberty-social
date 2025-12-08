"use client";

import Spinner from "@/components/Spinner";
import { useAuth } from "@/lib/auth-context";
import { apiPost, apiGet } from "@/lib/api";
import type { Conversation, Friend } from "@/lib/types";
import type { PaginatedResponse } from "@/lib/api";
import { useConversations } from "@/hooks/useConversations";
import { usePaginatedResource } from "@/hooks/usePaginatedResource";
import { useCallback, useState, useEffect } from "react";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { resolveRemoteUrl } from "@/lib/api";

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
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

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
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Messages</h1>
        <div className="flex items-center gap-2">
          {isSelectionMode && selectedConversations.size > 0 && (
            <button
              onClick={handleArchiveChats}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Archive ({selectedConversations.size})
            </button>
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
              const lastMessageText = lastMessage?.content 
                ? lastMessage.content 
                : lastMessage?.media_url 
                  ? "Attachment" 
                  : "No messages yet";
              const lastMessageTime = formatTime(conversation.last_message_at);
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
                  } ${isSelected ? "bg-blue-900/30" : ""}`}
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
            {next && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-4 text-blue-400 hover:text-blue-300 disabled:opacity-50 text-center border-t border-gray-700 transition"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            )}
            {archivedConversations.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <button
                  onClick={() => setShowArchivedModal(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors text-left"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <span className="text-gray-300 font-medium">Archived Chats</span>
                  <span className="ml-auto px-2 py-1 bg-gray-700 rounded-full text-xs text-gray-300">
                    {archivedConversations.length}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Archived Conversations Modal */}
      {showArchivedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">
                {isArchivedSelectionMode ? `${selectedArchivedConversations.size} selected` : "Archived Chats"}
              </h2>
              <div className="flex items-center gap-2">
                {isArchivedSelectionMode && selectedArchivedConversations.size > 0 && (
                  <button
                    onClick={handleUnarchiveChats}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Unarchive ({selectedArchivedConversations.size})
                  </button>
                )}
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
                  const lastMessageText = lastMessage?.content 
                    ? lastMessage.content 
                    : lastMessage?.media_url 
                      ? "Attachment" 
                      : "No messages yet";
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
    </div>
  );
}

