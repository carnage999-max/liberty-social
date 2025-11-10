import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  AppState,
} from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { useToast } from '../../../contexts/ToastContext';
import { apiClient } from '../../../utils/api';
import { Message, Conversation, PaginatedResponse } from '../../../types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AppNavbar from '../../../components/layout/AppNavbar';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../../utils/url';
import { useAuth } from '../../../contexts/AuthContext';
import { useChatWebSocket } from '../../../hooks/useChatWebSocket';

export default function ConversationDetailScreen() {
  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [next, setNext] = useState<string | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageIdRef = useRef<number | null>(null);

  const loadConversation = async () => {
    try {
      const data = await apiClient.get<Conversation>(`/conversations/${id}/`);
      setConversation(data);
    } catch (error) {
      showError('Failed to load conversation');
      router.back();
    }
  };

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await apiClient.get<PaginatedResponse<Message>>(
        `/conversations/${id}/messages/`
      );
      const newMessages = response.results.reverse(); // Reverse to show oldest first
      setMessages(newMessages);
      setNext(response.next);
      
      // Update last message ID for polling
      if (newMessages.length > 0) {
        lastMessageIdRef.current = newMessages[newMessages.length - 1].id;
      }
    } catch (error) {
      if (!silent) showError('Failed to load messages');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const markAsRead = async () => {
    if (!id) return;
    try {
      await apiClient.post(`/conversations/${id}/mark-read/`);
    } catch (error) {
      // Silently fail - not critical
    }
  };

  // WebSocket connection
  // Convert id to number if it's a string
  const conversationId = id ? (typeof id === 'string' ? parseInt(id, 10) : Number(id)) : null;
  const { isConnected } = useChatWebSocket({
    conversationId: conversationId || 0,
    enabled: !!conversationId && !isNaN(conversationId),
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
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
        return updated;
      });
      markAsRead();
    },
    onError: (error) => {
      console.error('[WebSocket] Error:', error);
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
    if (pollingEnabled && id) {
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
  }, [pollingEnabled, id]);

  // Load conversation and messages on mount
  useEffect(() => {
    if (id) {
      loadConversation();
      loadMessages();
      markAsRead();
    }
  }, [id]);

  // Mark as read when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (id) {
        markAsRead();
      }
    }, [id])
  );

  // Mark as read when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && id) {
        markAsRead();
        loadMessages(true); // Silent refresh
      }
    });

    return () => {
      subscription.remove();
    };
  }, [id]);

  const sendMessage = async () => {
    if (!messageText.trim() || sending) return;

    try {
      setSending(true);
      const response = await apiClient.post<Message>(
        `/conversations/${id}/messages/`,
        {
          content: messageText.trim(),
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
      setMessageText('');
      lastMessageIdRef.current = response.id;
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      markAsRead();
    } catch (error) {
      showError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const getConversationTitle = () => {
    if (!conversation) return 'Messages';
    if (conversation.title) return conversation.title;
    if (conversation.is_group) return 'Group Chat';
    const otherParticipant = conversation.participants.find(
      (p) => p.user.id !== conversation.created_by.id
    );
    if (otherParticipant) {
      const u = otherParticipant.user;
      if (u.first_name && u.last_name) return `${u.first_name} ${u.last_name}`;
      if (u.username) return u.username;
      return u.email.split('@')[0];
    }
    return 'Messages';
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.is_deleted) {
      return (
        <View style={[styles.messageContainer, styles.messageContainerOwn]}>
          <Text style={[styles.deletedMessage, { color: colors.textSecondary }]}>
            This message was deleted
          </Text>
        </View>
      );
    }

    const isOwn = item.sender.id === user?.id;
    const avatarUrl = item.sender.profile_image_url
      ? resolveRemoteUrl(item.sender.profile_image_url)
      : null;
    const avatarSource = avatarUrl ? { uri: avatarUrl } : DEFAULT_AVATAR;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwn ? styles.messageContainerOwn : styles.messageContainerOther,
        ]}
      >
        {!isOwn && (
          <Image source={avatarSource} style={styles.messageAvatar} />
        )}
        <View
          style={[
            styles.messageBubble,
            isOwn
              ? { backgroundColor: colors.primary }
              : { backgroundColor: isDark ? colors.backgroundSecondary : '#E5E5E5' },
          ]}
        >
          {!isOwn && (
            <Text style={[styles.messageSender, { color: colors.textSecondary }]}>
              {item.sender.first_name || item.sender.username || 'User'}
            </Text>
          )}
          {item.media_url && (
            <Image
              source={{ uri: item.media_url }}
              style={styles.messageMedia}
              resizeMode="cover"
            />
          )}
          {item.content && (
            <Text
              style={[
                styles.messageText,
                { color: isOwn ? '#FFFFFF' : colors.text },
              ]}
            >
              {item.content}
            </Text>
          )}
          <Text
            style={[
              styles.messageTime,
              { color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textSecondary },
            ]}
          >
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    messagesList: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    messageContainer: {
      flexDirection: 'row',
      marginVertical: 4,
      alignItems: 'flex-end',
      gap: 8,
    },
    messageContainerOwn: {
      justifyContent: 'flex-end',
    },
    messageContainerOther: {
      justifyContent: 'flex-start',
    },
    messageAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    messageBubble: {
      maxWidth: '75%',
      padding: 12,
      borderRadius: 16,
      gap: 4,
    },
    messageSender: {
      fontSize: 12,
      fontWeight: '600',
    },
    messageText: {
      fontSize: 15,
      lineHeight: 20,
    },
    messageTime: {
      fontSize: 11,
      alignSelf: 'flex-end',
    },
    messageMedia: {
      width: 200,
      height: 200,
      borderRadius: 12,
      marginBottom: 4,
    },
    deletedMessage: {
      fontSize: 13,
      fontStyle: 'italic',
      textAlign: 'center',
      padding: 8,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      gap: 8,
    },
    textInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 15,
      maxHeight: 100,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      textAlign: 'center',
      marginTop: 16,
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <AppNavbar
        title={getConversationTitle()}
        showLogo={false}
        showProfileImage={false}
        showMessageIcon={false}
        showBackButton={true}
        onBackPress={() => router.back()}
      />
      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No messages yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: 14 }]}>
            Start the conversation
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.messagesList}
            inverted={false}
            onContentSizeChange={() => {
              // Auto-scroll to bottom when content size changes
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }}
            onLayout={() => {
              // Scroll to bottom on initial layout
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: false });
              }, 100);
            }}
          />
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDark ? colors.background : '#FFFFFF',
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Type a message..."
              placeholderTextColor={colors.textSecondary}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor: messageText.trim() ? colors.primary : colors.border,
                },
              ]}
              onPress={sendMessage}
              disabled={!messageText.trim() || sending}
            >
              <Ionicons
                name="send"
                size={20}
                color={messageText.trim() ? '#FFFFFF' : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

