'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useUserStatus } from '@/hooks/useUserStatus';

interface UserStatusContextValue {
  isConnected: boolean;
}

const UserStatusContext = createContext<UserStatusContextValue | undefined>(undefined);

/**
 * Provider component for global user status tracking
 *
 * Wrap your application with this provider to enable real-time online status tracking.
 * Should be placed near the top of your component tree, after AuthProvider.
 *
 * Usage:
 * ```tsx
 * <AuthProvider>
 *   <UserStatusProvider>
 *     <App />
 *   </UserStatusProvider>
 * </AuthProvider>
 * ```
 */
export function UserStatusProvider({ children }: { children: ReactNode }) {
  const { isConnected } = useUserStatus((event) => {
    // Log status changes for debugging
    console.debug(
      `[UserStatusProvider] User ${event.user_id} is now ${event.is_online ? 'online' : 'offline'}`
    );
  });

  return (
    <UserStatusContext.Provider value={{ isConnected }}>
      {children}
    </UserStatusContext.Provider>
  );
}

/**
 * Hook to access user status connection state
 *
 * Usage:
 * ```tsx
 * const { isConnected } = useUserStatusContext();
 * ```
 */
export function useUserStatusContext() {
  const ctx = useContext(UserStatusContext);
  if (!ctx) {
    throw new Error('useUserStatusContext must be used within UserStatusProvider');
  }
  return ctx;
}
