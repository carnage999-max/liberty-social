"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost } from "@/lib/api";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import { useToast } from "@/components/Toast";
import type { Conversation, Message } from "@/lib/types";
import type { PaginatedResponse } from "@/lib/api";
import Image from "next/image";
import { resolveRemoteUrl } from "@/lib/api";
import Spinner from "@/components/Spinner";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageIdRef = useRef<number | null>(null);

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
      if (!silent) setLoading(true);
      const response = await apiGet<PaginatedResponse<Message>>(
        `/conversations/${conversationId}/messages/`,
        {
          token: accessToken,
          cache: "no-store",
        }
      );
      const newMessages = response.results.reverse(); // Reverse to show oldest first
      setMessages(newMessages);
      
      // Update last message ID for polling
      if (newMessages.length > 0) {
        lastMessageIdRef.current = newMessages[newMessages.length - 1].id;
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
      // Silently fail - not critical
    }
  };

  // WebSocket connection
  const { isConnected } = useChatWebSocket({
    conversationId: conversationId || "",
    enabled: !!conversationId && !!accessToken,
    onMessage: (message: Message) => {
      setMessages((prev) => {
        // Check if message already exists (avoid duplicates)
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }
        const updated = [...prev, message];
        lastMessageIdRef.current = message.id;
        // Scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
        return updated;
      });
      markAsRead();
    },
    onError: (error) => {
      console.error("[WebSocket] Error:", error);
      // Enable polling as fallback
      setPollingEnabled(true);
    },
    onConnect: () => {
      setPollingEnabled(false);
    },
    onDisconnect: () => {
      // Enable polling as fallback when WebSocket disconnects
      setPollingEnabled(true);
    },
  });

  // Polling fallback
  useEffect(() => {
    if (pollingEnabled && conversationId && accessToken) {
      pollingIntervalRef.current = setInterval(() => {
        loadMessages(true); // Silent refresh
      }, 5000); // Poll every 5 seconds
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
    }
  }, [conversationId, accessToken]);

  // Mark as read when page is visible
  useEffect(() => {
    if (!conversationId || !accessToken) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        markAsRead();
        loadMessages(true); // Silent refresh
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [conversationId, accessToken]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!messageText.trim() || sending || !accessToken || !conversationId) return;

    try {
      setSending(true);
      const response = await apiPost<Message>(
        `/conversations/${conversationId}/messages/`,
        {
          content: messageText.trim(),
        },
        {
          token: accessToken,
          cache: "no-store",
        }
      );
      // Message will be added via WebSocket, but add it immediately for better UX
      setMessages((prev) => {
        // Check if message already exists (avoid duplicates from WebSocket)
        if (prev.some((m) => m.id === response.id)) {
          return prev;
        }
        return [...prev, response];
      });
      setMessageText("");
      lastMessageIdRef.current = response.id;
      markAsRead();
    } catch (error) {
      toast.show("Failed to send message", "error");
    } finally {
      setSending(false);
    }
  };

  const getConversationTitle = (): string => {
    if (!conversation) return "Messages";
    if (conversation.title) return conversation.title;
    if (conversation.is_group) return "Group Chat";
    const otherParticipant = conversation.participants.find(
      (p) => p.user.id !== conversation.created_by.id
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
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <header className="flex items-center gap-4 p-4 border-b">
        <button
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-800"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold">{getConversationTitle()}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

              return (
                <div
                  key={message.id}
                  className={`flex gap-2 ${isOwn ? "justify-end" : "justify-start"}`}
                >
                  {!isOwn && (
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt={message.sender.first_name || "User"}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-gray-500">👤</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-lg p-3 ${
                      isOwn
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    {!isOwn && (
                      <p className="text-xs font-semibold mb-1 opacity-70">
                        {message.sender.first_name || message.sender.username || "User"}
                      </p>
                    )}
                    {message.media_url && (
                      <div className="mb-2">
                        <Image
                          src={message.media_url}
                          alt="Message media"
                          width={200}
                          height={200}
                          className="rounded-lg object-cover"
                        />
                      </div>
                    )}
                    {message.content && (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                    <p
                      className={`text-xs mt-1 ${
                        isOwn ? "text-blue-100" : "text-gray-500"
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

      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={!messageText.trim() || sending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}

