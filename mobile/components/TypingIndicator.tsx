import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TypingUser {
  userId: string;
  username: string;
  timestamp: number;
}

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
  style?: any;
}

export function TypingIndicator({ typingUsers, style }: TypingIndicatorProps) {
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
    <View style={[styles.container, style]}>
      <View style={styles.dots}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
      <Text style={styles.text}>{getTypingText()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dots: {
    flexDirection: 'row',
    marginRight: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9CA3AF',
    marginHorizontal: 2,
    // Note: For bounce animation, consider using Animated API or react-native-animatable
  },
  text: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
});