import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../utils/api';
import { Conversation, PaginatedResponse } from '../types';
import { useAuth } from './AuthContext';

interface MessageBadgeContextValue {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  syncFromConversations: (conversations: Conversation[]) => void;
}

const MessageBadgeContext = createContext<MessageBadgeContextValue | undefined>(undefined);

const POLL_INTERVAL_MS = 8000;
const PAGE_SIZE = 100;

export const MessageBadgeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const isMountedRef = useRef(true);

  const calculateUnread = useCallback(
    (conversations: Conversation[]) => {
      if (!user) {
        return 0;
      }
      const currentUserId = String(user.id);
      return conversations.reduce((total, conversation) => {
        const participant = conversation.participants.find(
          (p) => String(p.user.id) === currentUserId
        );
        const lastRead = participant?.last_read_at ? new Date(participant.last_read_at).getTime() : null;
        const lastMessage = conversation.last_message?.created_at
          ? new Date(conversation.last_message.created_at).getTime()
          : null;
        const lastMessageAt = conversation.last_message_at
          ? new Date(conversation.last_message_at).getTime()
          : null;
        const latestActivity = lastMessage ?? lastMessageAt;
        if (latestActivity && (!lastRead || lastRead < latestActivity)) {
          return total + 1;
        }
        return total;
      }, 0);
    },
    [user]
  );

  const syncFromConversations = useCallback(
    (conversations: Conversation[]) => {
      if (!isMountedRef.current) return;
      if (!user) {
        setUnreadCount(0);
        return;
      }
      setUnreadCount(calculateUnread(conversations));
    },
    [calculateUnread, user]
  );

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await apiClient.get<PaginatedResponse<Conversation>>(
        `/conversations/?page_size=${PAGE_SIZE}`
      );
      syncFromConversations(response.results);
    } catch (error) {
      // Fail silently; badge will refresh on next interval or manual refresh
    }
  }, [syncFromConversations, user]);

  useEffect(() => {
    isMountedRef.current = true;
    refreshUnreadCount();

    const interval = setInterval(() => {
      refreshUnreadCount();
    }, POLL_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [refreshUnreadCount]);

  const value = useMemo(
    () => ({ unreadCount, refreshUnreadCount, syncFromConversations }),
    [refreshUnreadCount, syncFromConversations, unreadCount]
  );

  return (
    <MessageBadgeContext.Provider value={value}>
      {children}
    </MessageBadgeContext.Provider>
  );
};

export const useMessageBadge = (): MessageBadgeContextValue => {
  const context = useContext(MessageBadgeContext);
  if (!context) {
    throw new Error('useMessageBadge must be used within a MessageBadgeProvider');
  }
  return context;
};
