"use client";

import { useEffect, useState } from "react";

interface TypingUser {
  userId: string;
  username: string;
  timestamp: number;
}

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
  className?: string;
}

export function TypingIndicator({ typingUsers, className = "" }: TypingIndicatorProps) {
  const [visibleUsers, setVisibleUsers] = useState<TypingUser[]>([]);

  useEffect(() => {
    setVisibleUsers(typingUsers);

    // Auto-remove users after 5 seconds (in case stop typing event is missed)
    const timeout = setTimeout(() => {
      setVisibleUsers([]);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [typingUsers]);

  if (visibleUsers.length === 0) {
    return null;
  }

  const getTypingText = () => {
    if (visibleUsers.length === 1) {
      return `${visibleUsers[0].username} is typing...`;
    } else if (visibleUsers.length === 2) {
      return `${visibleUsers[0].username} and ${visibleUsers[1].username} are typing...`;
    } else {
      return `${visibleUsers[0].username} and ${visibleUsers.length - 1} others are typing...`;
    }
  };

  return (
    <div className={`flex items-center space-x-2 text-sm text-gray-500 italic ${className}`}>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <span>{getTypingText()}</span>
    </div>
  );
}