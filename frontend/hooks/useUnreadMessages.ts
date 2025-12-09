"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useConversations } from "./useConversations";

export function useUnreadMessages() {
  const { user } = useAuth();
  const { conversations } = useConversations();

  const unreadCount = useMemo(() => {
    if (!user || !conversations) return 0;

    return conversations.filter((conversation) => {
      const userParticipant = conversation.participants.find(
        (p) => String(p.user.id) === String(user.id)
      );
      
      // Skip archived conversations
      if (userParticipant?.is_archived) return false;

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
      
      // Conversation is unread if there's activity after the last read time
      return Boolean(
        latestActivityTs && (!lastReadTs || lastReadTs < latestActivityTs)
      );
    }).length;
  }, [conversations, user]);

  return { unreadCount };
}

