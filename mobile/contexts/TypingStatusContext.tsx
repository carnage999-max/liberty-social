import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface TypingUser {
  userId: string;
  username: string;
  timestamp: number;
}

interface TypingStatusContextValue {
  typingStatus: Record<number, TypingUser[]>;
  setTypingStatus: (conversationId: number, users: TypingUser[]) => void;
  addTypingUser: (conversationId: number, userId: string, username: string) => void;
  removeTypingUser: (conversationId: number, userId: string) => void;
  clearTypingStatus: (conversationId: number) => void;
}

const TypingStatusContext = createContext<TypingStatusContextValue | undefined>(undefined);

export function TypingStatusProvider({ children }: { children: ReactNode }) {
  const [typingStatus, setTypingStatusState] = useState<Record<number, TypingUser[]>>({});

  // Auto-cleanup old typing status (older than 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingStatusState((prev) => {
        const updated: Record<number, TypingUser[]> = {};
        let hasChanges = false;
        Object.keys(prev).forEach((convId) => {
          const users = prev[Number(convId)];
          const activeUsers = users.filter((u) => now - u.timestamp < 5000);
          if (activeUsers.length > 0) {
            updated[Number(convId)] = activeUsers;
          }
          if (activeUsers.length !== users.length) {
            hasChanges = true;
          }
        });
        // Only update if there are changes to avoid unnecessary re-renders
        return hasChanges ? updated : prev;
      });
    }, 1000); // Check every second for faster updates

    return () => clearInterval(interval);
  }, []);

  const setTypingStatus = useCallback((conversationId: number, users: TypingUser[]) => {
    setTypingStatusState((prev) => ({
      ...prev,
      [conversationId]: users,
    }));
  }, []);

  const addTypingUser = useCallback((conversationId: number, userId: string, username: string) => {
    setTypingStatusState((prev) => {
      const current = prev[conversationId] || [];
      const filtered = current.filter((u) => u.userId !== userId);
      return {
        ...prev,
        [conversationId]: [...filtered, { userId, username, timestamp: Date.now() }],
      };
    });
  }, []);

  const removeTypingUser = useCallback((conversationId: number, userId: string) => {
    setTypingStatusState((prev) => {
      const current = prev[conversationId] || [];
      const filtered = current.filter((u) => u.userId !== userId);
      if (filtered.length === 0) {
        const updated = { ...prev };
        delete updated[conversationId];
        return updated;
      }
      return {
        ...prev,
        [conversationId]: filtered,
      };
    });
  }, []);

  const clearTypingStatus = useCallback((conversationId: number) => {
    setTypingStatusState((prev) => {
      const updated = { ...prev };
      delete updated[conversationId];
      return updated;
    });
  }, []);

  return (
    <TypingStatusContext.Provider
      value={{
        typingStatus,
        setTypingStatus,
        addTypingUser,
        removeTypingUser,
        clearTypingStatus,
      }}
    >
      {children}
    </TypingStatusContext.Provider>
  );
}

export function useTypingStatus() {
  const context = useContext(TypingStatusContext);
  if (!context) {
    throw new Error('useTypingStatus must be used within TypingStatusProvider');
  }
  return context;
}

