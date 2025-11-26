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
  ActivityIndicator,
  Modal,
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
import * as ImagePicker from 'expo-image-picker';
import AdvancedEmojiPicker from '../../../components/feed/AdvancedEmojiPicker';
import { resolveMediaUrls } from '../../../utils/url';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

type MediaAttachment = {
  uri: string;
  type: 'image' | 'video';
  mimeType?: string;
  filename?: string;
};

export default function ConversationDetailScreen() {
  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [next, setNext] = useState<string | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [mediaAttachment, setMediaAttachment] = useState<MediaAttachment | null>(null);
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

  // WebSocket connection with better error handling
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
      // Silently enable polling - don't show error to user
      console.log('[WebSocket] Connection error, using polling fallback');
      setPollingEnabled(true);
    },
    onConnect: () => {
      console.log('[WebSocket] Connected successfully');
      setPollingEnabled(false);
    },
    onDisconnect: () => {
      // Silently enable polling as fallback when WebSocket disconnects
      console.log('[WebSocket] Disconnected, using polling fallback');
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

  const handlePickMedia = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showError('Permission to access media library is required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Check file size
        if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
          showError(`File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`);
          return;
        }

        const type = asset.type === 'video' ? 'video' : 'image';
        const filename = asset.uri.split('/').pop() || (type === 'video' ? 'video.mp4' : 'image.jpg');
        
        // Determine MIME type from filename or asset type
        let mimeType = 'image/jpeg';
        if (type === 'video') {
          mimeType = 'video/mp4';
        } else {
          const ext = filename.split('.').pop()?.toLowerCase();
          if (ext === 'png') mimeType = 'image/png';
          else if (ext === 'gif') mimeType = 'image/gif';
          else if (ext === 'webp') mimeType = 'image/webp';
          else mimeType = 'image/jpeg';
        }
        
        setMediaAttachment({
          uri: asset.uri,
          type,
          mimeType,
          filename,
        });
      }
    } catch (error) {
      console.error('Error picking media:', error);
      showError('Failed to pick media');
    }
  };

  const removeMediaAttachment = () => {
    setMediaAttachment(null);
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageText((prev) => prev + emoji);
    setEmojiPickerVisible(false);
  };

  const sendMessage = async () => {
    if ((!messageText.trim() && !mediaAttachment) || sending) return;

    try {
      setSending(true);
      let mediaUrl: string | null = null;

      // Upload media if present
      if (mediaAttachment) {
        try {
          const formData = new FormData();
          const filename = mediaAttachment.filename || (mediaAttachment.type === 'video' ? 'video.mp4' : 'image.jpg');
          const mimeType = mediaAttachment.mimeType || (mediaAttachment.type === 'video' ? 'video/mp4' : 'image/jpeg');
          
          formData.append('file', {
            uri: mediaAttachment.uri,
            type: mimeType,
            name: filename,
          } as any);

          console.log('[Message] Uploading media:', { filename, mimeType, uri: mediaAttachment.uri.substring(0, 50) + '...' });
          
          const uploadResponse = await apiClient.postFormData<{ url: string }>(
            '/uploads/images/',
            formData
          );
          
          console.log('[Message] Upload response:', uploadResponse);
          
          if (uploadResponse.url) {
            mediaUrl = uploadResponse.url;
          } else if ((uploadResponse as any).urls && Array.isArray((uploadResponse as any).urls) && (uploadResponse as any).urls.length > 0) {
            mediaUrl = (uploadResponse as any).urls[0];
          } else {
            throw new Error('No URL in upload response');
          }
        } catch (error: any) {
          console.error('[Message] Upload error:', error);
          const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || 'Failed to upload media';
          showError(errorMessage);
          setSending(false);
          return;
        }
      }

      const response = await apiClient.post<Message>(
        `/conversations/${id}/messages/`,
        {
          content: messageText.trim() || null,
          media_url: mediaUrl,
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
      removeMediaAttachment();
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
      (p) => p.user.id !== user?.id
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
    const mediaUrl = item.media_url ? resolveMediaUrls(item.media_url)[0] : null;

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
          {mediaUrl && (
            <Image
              source={{ uri: mediaUrl }}
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
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexGrow: 1,
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
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    mediaPreview: {
      marginHorizontal: 16,
      marginBottom: 8,
      position: 'relative',
    },
    mediaPreviewImage: {
      width: 100,
      height: 100,
      borderRadius: 12,
    },
    removeMediaButton: {
      position: 'absolute',
      top: -8,
      right: -8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 24,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: isDark ? colors.background : '#FFFFFF',
      minHeight: 44,
      maxHeight: 100,
    },
    textInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      paddingVertical: 4,
      maxHeight: 84,
    },
    emojiButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 4,
    },
    attachButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
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

  const canSend = messageText.trim() || mediaAttachment;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
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
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id.toString()}
            style={{ flex: 1 }}
            contentContainerStyle={styles.messagesList}
            inverted={false}
            showsVerticalScrollIndicator={true}
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
        )}
        {!loading && (
          <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 0 : 8) }]}>
            {mediaAttachment && (
              <View style={styles.mediaPreview}>
                <Image
                  source={{ uri: mediaAttachment.uri }}
                  style={styles.mediaPreviewImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.removeMediaButton}
                  onPress={removeMediaAttachment}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.attachButton}
                onPress={handlePickMedia}
                disabled={sending}
              >
                <Ionicons
                  name="attach-outline"
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.textSecondary}
                  value={messageText}
                  onChangeText={setMessageText}
                  multiline
                  maxLength={1000}
                  editable={!sending}
                />
                <TouchableOpacity
                  style={styles.emojiButton}
                  onPress={() => setEmojiPickerVisible(true)}
                  disabled={sending}
                >
                  <Text style={{ fontSize: 20 }}>😀</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: canSend ? colors.primary : colors.border,
                  },
                ]}
                onPress={sendMessage}
                disabled={!canSend || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name="send"
                    size={20}
                    color={canSend ? '#FFFFFF' : colors.textSecondary}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      
        <AdvancedEmojiPicker
          visible={emojiPickerVisible}
          onClose={() => setEmojiPickerVisible(false)}
          onSelect={handleEmojiSelect}
        />
      </KeyboardAvoidingView>
    </View>
  );
}
