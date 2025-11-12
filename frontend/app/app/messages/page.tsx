"use client";

import Spinner from "@/components/Spinner";
import { useAuth } from "@/lib/auth-context";
import { apiPost } from "@/lib/api";
import type { Conversation, Friend } from "@/lib/types";
import { useConversations } from "@/hooks/useConversations";
import { usePaginatedResource } from "@/hooks/usePaginatedResource";
import { useCallback, useState } from "react";
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
  const { items: friends, loading: loadingFriends } = usePaginatedResource<Friend>(
    "/auth/friends/",
    {
      enabled: !!accessToken && showNewConversation,
    }
  );

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
        <h1 className="text-2xl font-bold">Messages</h1>
        <button
          onClick={() => setShowNewConversation(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <span>+</span>
          <span>New Conversation</span>
        </button>
      </header>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <p className="text-gray-500">No conversations yet</p>
          <p className="text-sm text-gray-400">Start a conversation with a friend</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conversation) => {
            const title = getConversationTitle(conversation);
            const avatarUrl = getConversationAvatar(conversation);
            const lastMessage = conversation.last_message;
            // Show "Attachment" if last message has media but no content
            const lastMessageText = lastMessage?.content 
              ? lastMessage.content 
              : lastMessage?.media_url 
                ? "Attachment" 
                : "No messages yet";
            const lastMessageTime = formatTime(conversation.last_message_at);

            return (
              <button
                key={conversation.id}
                onClick={() => router.push(`/app/messages/${conversation.id}`)}
                className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
              >
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-gray-500">
                        {conversation.is_group ? "👥" : "👤"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold truncate">{title}</h3>
                    {lastMessageTime && (
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {lastMessageTime}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{lastMessageText}</p>
                </div>
              </button>
            );
          })}
          {next && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-2 text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      )}

      {/* New Conversation Modal */}
      {showNewConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">New Conversation</h2>
              <button
                onClick={() => setShowNewConversation(false)}
                className="text-gray-500 hover:text-gray-700"
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
                <p className="text-gray-500">No friends yet</p>
                <p className="text-sm text-gray-400 mt-2">
                  Add friends to start conversations
                </p>
              </div>
            ) : (
              <>
                {friends.filter((friend) => friend.friend.id !== user?.id).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No other friends to message</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Add more friends to start conversations
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friends
                      .filter((friend) => friend.friend.id !== user?.id) // Filter out current user
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
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left disabled:opacity-50"
                      >
                        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                          {avatarUrl ? (
                            <Image
                              src={avatarUrl}
                              alt={displayName}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-gray-500">👤</span>
                            </div>
                          )}
                        </div>
                        <span className="font-medium">{displayName}</span>
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

