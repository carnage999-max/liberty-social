import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  KeyboardAvoidingView,
  Platform,
  AppState,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { useToast } from '../../../contexts/ToastContext';
import { apiClient } from '../../../utils/api';
import { Message, Conversation, PaginatedResponse } from '../../../types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AppNavbar from '../../../components/layout/AppNavbar';
import { TypingIndicator } from '../../../components/TypingIndicator';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../../utils/url';
import { useAuth } from '../../../contexts/AuthContext';
import { useChatWebSocket } from '../../../hooks/useChatWebSocket';
import * as ImagePicker from 'expo-image-picker';
import AdvancedEmojiPicker from '../../../components/feed/AdvancedEmojiPicker';
import { resolveMediaUrls } from '../../../utils/url';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storage } from '../../../utils/storage';
import { getApiBase } from '../../../constants/API';
import { useAlert } from '../../../contexts/AlertContext';
import UserProfileBottomSheet from '../../../components/profile/UserProfileBottomSheet';
import ImageGallery from '../../../components/common/ImageGallery';
import { VideoView, useVideoPlayer } from 'expo-video';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

type MediaAttachment = {
  uri: string;
  type: 'image' | 'video';
  mimeType?: string;
  filename?: string;
};

const isVideoUrl = (url?: string | null) =>
  !!url && /\.(mp4|mov|m4v|webm|mkv|avi|3gp)(\?.*)?$/i.test(url);

export default function ConversationDetailScreen() {
  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const { showConfirm } = useAlert();
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
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; username: string; timestamp: number }>>([]);
  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [messageMenuVisible, setMessageMenuVisible] = useState(false);
  const [messageMenuPosition, setMessageMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [reactionPickerVisible, setReactionPickerVisible] = useState<number | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [profileBottomSheetVisible, setProfileBottomSheetVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | number | null>(null);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageIdRef = useRef<number | null>(null);

  // Create video player instance at component level to avoid hook order issues
  const videoPlayer = useVideoPlayer(videoPreviewUrl || '', (player) => {
    if (videoPreviewUrl) {
      player.loop = false;
      player.play();
    }
  });

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
  const { isConnected, startTyping, stopTyping } = useChatWebSocket({
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
    onTypingStart: (userId: string, username: string) => {
      setTypingUsers((prev) => {
        // Remove if already exists
        const filtered = prev.filter((u) => u.userId !== userId);
        return [...filtered, { userId, username, timestamp: Date.now() }];
      });
    },
    onTypingStop: (userId: string) => {
      setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
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

      // Upload media if present (only for new messages, not edits)
      if (mediaAttachment && editingMessageId === null) {
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
          
          // Use fetch instead of axios for better React Native FormData support
          const apiBase = getApiBase();
          const uploadUrl = `${apiBase.replace(/\/+$/, '')}/uploads/images/`;
          const token = await storage.getAccessToken();
          
          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          });
          
          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.message || 'Upload failed');
          }
          
          const uploadData = await uploadResponse.json();
          console.log('[Message] Upload response:', uploadData);
          
          if (uploadData.url) {
            mediaUrl = uploadData.url;
          } else if (uploadData.urls && Array.isArray(uploadData.urls) && uploadData.urls.length > 0) {
            mediaUrl = uploadData.urls[0];
          } else {
            throw new Error('No URL in upload response');
          }
        } catch (error: any) {
          console.error('[Message] Upload error:', error);
          const errorMessage = error?.message || 'Failed to upload media';
          showError(errorMessage);
          setSending(false);
          return;
        }
      }

      // If editing, make a PATCH request
      if (editingMessageId !== null) {
        const response = await apiClient.patch<Message>(
          `/messages/${editingMessageId}/`,
          {
            content: messageText.trim() || null,
          }
        );
        
        setMessages((prev) =>
          prev.map((m) =>
            m.id === editingMessageId ? response : m
          )
        );
        
        setMessageText('');
        setEditingMessageId(null);
        setEditText('');
        showSuccess('Message updated');
      } else {
        // New message
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
        markAsRead();
      }
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
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

  const galleryMedia = useMemo(() => {
    return messages
      .map((message) => {
        if (!message.media_url) return null;
        const url = resolveMediaUrls(message.media_url)[0];
        if (!url || isVideoUrl(url)) return null;
        return { messageId: message.id, url };
      })
      .filter((entry): entry is { messageId: number; url: string } => !!entry);
  }, [messages]);

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
    const isVideo = isVideoUrl(mediaUrl);

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
        <View style={styles.messageContent}>
          <TouchableOpacity
            onLongPress={() => {
              setSelectedMessageId(item.id);
              setMessageMenuVisible(true);
            }}
            activeOpacity={0.9}
            delayLongPress={300}
          >
            <View
              style={[
                styles.messageBubble,
                isOwn
                  ? { backgroundColor: '#1b2749' }
                  : { backgroundColor: isDark ? colors.backgroundSecondary : '#E5E5E5' },
              ]}
            >
              {!isOwn && (
                <Text style={[styles.messageSender, { color: colors.textSecondary }]}>
                  {item.sender.first_name || item.sender.username || 'User'}
                </Text>
              )}
              {mediaUrl && !isVideo && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    const index = galleryMedia.findIndex((m) => m.messageId === item.id);
                    if (index >= 0) {
                      setGalleryIndex(index);
                      setGalleryVisible(true);
                    }
                  }}
                >
                  <Image
                    source={{ uri: mediaUrl }}
                    style={styles.messageMedia}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
              {mediaUrl && isVideo && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setVideoPreviewUrl(mediaUrl)}
                >
                  <View style={[styles.messageMedia, styles.videoPreview, { backgroundColor: '#000' }]}>
                    <View style={styles.videoOverlay}>
                      <Ionicons name="play-circle" size={64} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', marginTop: 8, fontSize: 12 }}>Tap to play video</Text>
                    </View>
                  </View>
                </TouchableOpacity>
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
              
              {/* Reactions Display - Inside bubble like frontend */}
              {item.reactions && item.reactions.length > 0 && (
                <View style={[styles.reactionsContainer, isOwn && styles.reactionsContainerOwn]}>
                  {item.reactions.map((reaction, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.reactionBadge,
                        { 
                          backgroundColor: isDark ? 'rgba(200, 162, 95, 0.2)' : 'rgba(200, 162, 95, 0.1)',
                          borderWidth: 1,
                          borderColor: 'rgba(200, 162, 95, 0.3)',
                        }
                      ]}
                      onPress={() => {
                        showSuccess(`${reaction.user.first_name || reaction.user.username} reacted`);
                      }}
                    >
                      <Text style={styles.reactionEmoji}>{reaction.reaction_type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const canSend = editingMessageId !== null 
    ? editText.trim() 
    : messageText.trim() || mediaAttachment;

  const headerContextMenu = (
    <TouchableOpacity
      onPress={() => setHeaderMenuVisible(true)}
      style={{ padding: 8 }}
    >
      <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
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
        onBackPress={() => router.push('/messages')}
        customRightButton={headerContextMenu}
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
            style={[{ flex: 1 }, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}
            contentContainerStyle={[styles.messagesList, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}
            inverted={false}
            showsVerticalScrollIndicator={true}
            onContentSizeChange={() => {
              // Auto-scroll to bottom when content size changes
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }}
            removeClippedSubviews={true}
            windowSize={10}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            onLayout={() => {
              // Scroll to bottom on initial layout
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: false });
              }, 100);
            }}
          />
        )}
        
        {/* Typing Indicator - Show in messages area */}
        {typingUsers.length > 0 && (
          <View style={[{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
            <TypingIndicator typingUsers={typingUsers} />
          </View>
        )}

        {/* Media Attachment Preview - Show above input */}
        {mediaAttachment && (
          <View style={[{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: isDark ? '#1e293b' : '#ffffff', borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {mediaAttachment.type === 'video' ? (
                <View style={[styles.mediaPreviewImage, styles.videoPreview, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="play-circle" size={48} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', marginTop: 4, fontSize: 11 }}>Video</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: mediaAttachment.uri }}
                  style={styles.mediaPreviewImage}
                  resizeMode="cover"
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>
                  {mediaAttachment.type === 'video' ? 'Video attachment' : 'Image attachment'}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  Ready to send
                </Text>
              </View>
              <TouchableOpacity
                onPress={removeMediaAttachment}
                style={{ padding: 8, backgroundColor: 'rgba(255, 107, 107, 0.1)', borderRadius: 20 }}
              >
                <Ionicons name="close" size={20} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!loading && (
          <View style={styles.inputContainer}>
            {/* Edit Mode Indicator */}
            {editingMessageId !== null && (
              <View style={[styles.editIndicator, { backgroundColor: colors.backgroundSecondary, borderTopColor: colors.primary }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Editing message</Text>
                  <Text style={{ color: colors.text, fontSize: 14, marginTop: 4 }} numberOfLines={1}>
                    {editText}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setEditingMessageId(null);
                    setEditText('');
                  }}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
            <View style={[styles.inputRow, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0' }]}>
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
              <TouchableOpacity
                style={styles.emojiButton}
                onPress={() => setEmojiPickerVisible(true)}
                disabled={sending}
              >
                <Ionicons
                  name="happy-outline"
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder={editingMessageId !== null ? 'Edit message...' : 'Type a message...'}
                  placeholderTextColor={colors.textSecondary}
                  value={editingMessageId !== null ? editText : messageText}
                  onChangeText={(text) => {
                    if (editingMessageId !== null) {
                      setEditText(text);
                    } else {
                      setMessageText(text);
                      // Call startTyping when user types
                      if (startTyping) startTyping();
                    }
                  }}
                  multiline
                  maxLength={1000}
                  editable={!sending}
                />
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

        {/* Header Options Modal */}
        <Modal
          visible={headerMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setHeaderMenuVisible(false)}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onPress={() => setHeaderMenuVisible(false)}
            activeOpacity={1}
          >
            <View style={[styles.contextMenu, { backgroundColor: colors.backgroundSecondary }]}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setHeaderMenuVisible(false);
                  // Open user profile in bottom sheet
                  const otherParticipant = conversation?.participants.find(
                    (p) => p.user.id !== user?.id
                  );
                  if (otherParticipant) {
                    setSelectedUserId(otherParticipant.user.id);
                    setProfileBottomSheetVisible(true);
                  }
                }}
              >
                <Ionicons name="person" size={20} color={colors.text} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>View Profile</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setHeaderMenuVisible(false);
                  const otherParticipant = conversation?.participants.find(
                    (p) => p.user.id !== user?.id
                  );
                  if (otherParticipant) {
                    const userName = otherParticipant.user.first_name || otherParticipant.user.username || 'this user';
                    showConfirm(
                      `Are you sure you want to block ${userName}? You won't be able to see their posts or interact with them.`,
                      async () => {
                        try {
                          await apiClient.post('/auth/blocks/', { 
                            blocked_user: otherParticipant.user.id 
                          });
                          showSuccess(`${userName} has been blocked`);
                          router.push('/messages');
                        } catch (error: any) {
                          showError(error.response?.data?.detail || 'Failed to block user');
                        }
                      },
                      undefined,
                      'Block User',
                      true
                    );
                  }
                }}
              >
                <Ionicons name="ban" size={20} color="#FF6B6B" />
                <Text style={[styles.menuItemText, { color: '#FF6B6B' }]}>Block User</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }]}
                onPress={() => {
                  setHeaderMenuVisible(false);
                  showConfirm(
                    'Are you sure you want to clear all messages in this chat? This action cannot be undone.',
                    () => {
                      setMessages([]);
                      showSuccess('Chat cleared');
                    },
                    undefined,
                    'Clear Chat',
                    true
                  );
                }}
              >
                <Ionicons name="trash" size={20} color="#FF6B6B" />
                <Text style={[styles.menuItemText, { color: '#FF6B6B' }]}>Clear Chat</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Message Options Modal */}
        {selectedMessageId && (
          <Modal
            visible={messageMenuVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setMessageMenuVisible(false)}
          >
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
              onPress={() => setMessageMenuVisible(false)}
              activeOpacity={1}
            >
              <View style={[styles.messageOptionsMenu, { backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF' }]}>
                <Text style={[styles.messageOptionsTitle, { color: colors.text }]}>Message Options</Text>
                
                {/* Quick Reactions */}
                <View style={styles.quickReactions}>
                  {['❤️', '👍', '😂', '😮', '😢', '🔥'].map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.quickReactionButton}
                      onPress={async () => {
                        setMessageMenuVisible(false);
                        try {
                          await apiClient.post('/reactions/', {
                            message: selectedMessageId,
                            reaction_type: emoji,
                          });
                          loadMessages(true);
                          showSuccess('Reaction added!');
                        } catch (error) {
                          console.error('Reaction error:', error);
                          showError('Failed to add reaction');
                        }
                      }}
                    >
                      <Text style={styles.quickReactionEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {/* Message Actions */}
                <TouchableOpacity
                  style={styles.messageOption}
                  onPress={() => {
                    setReactionPickerVisible(selectedMessageId);
                    setMessageMenuVisible(false);
                  }}
                >
                  <Ionicons name="happy-outline" size={22} color={colors.text} />
                  <Text style={[styles.messageOptionText, { color: colors.text }]}>More Reactions</Text>
                </TouchableOpacity>

                {messages.find((m) => m.id === selectedMessageId)?.sender.id === user?.id && (
                  <>
                    <TouchableOpacity
                      style={styles.messageOption}
                      onPress={() => {
                        const message = messages.find((m) => m.id === selectedMessageId);
                        if (message) {
                          setEditText(message.content || '');
                          setEditingMessageId(selectedMessageId);
                        }
                        setMessageMenuVisible(false);
                      }}
                    >
                      <Ionicons name="pencil-outline" size={22} color={colors.text} />
                      <Text style={[styles.messageOptionText, { color: colors.text }]}>Edit Message</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.messageOption}
                      onPress={() => {
                        setMessageMenuVisible(false);
                        showConfirm(
                          'Are you sure you want to delete this message? This action cannot be undone.',
                          async () => {
                            try {
                              await apiClient.delete(`/messages/${selectedMessageId}/`);
                              setMessages((prev) =>
                                prev.map((m) =>
                                  m.id === selectedMessageId ? { ...m, is_deleted: true } : m
                                )
                              );
                              showSuccess('Message deleted');
                            } catch (error) {
                              showError('Failed to delete message');
                            }
                          },
                          undefined,
                          'Delete Message',
                          true
                        );
                      }}
                    >
                      <Ionicons name="trash-outline" size={22} color={colors.secondary} />
                      <Text style={[styles.messageOptionText, { color: colors.secondary }]}>Delete Message</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Reaction Picker Modal */}
        <Modal
          visible={reactionPickerVisible !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setReactionPickerVisible(null)}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onPress={() => setReactionPickerVisible(null)}
            activeOpacity={1}
          >
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <AdvancedEmojiPicker
                visible={reactionPickerVisible !== null}
                onClose={() => setReactionPickerVisible(null)}
                onSelect={async (emoji) => {
                  if (reactionPickerVisible !== null) {
                    try {
                      await apiClient.post('/reactions/', {
                        message: reactionPickerVisible,
                        reaction_type: emoji,
                      });
                      loadMessages(true);
                      setReactionPickerVisible(null);
                      showSuccess('Reaction added!');
                    } catch (error) {
                      console.error('Reaction error:', error);
                      showError('Failed to add reaction');
                    }
                  }
                }}
              />
            </View>
          </TouchableOpacity>
        </Modal>

        {/* User Profile Bottom Sheet */}
        <UserProfileBottomSheet
          visible={profileBottomSheetVisible}
          userId={selectedUserId}
          onClose={() => {
            setProfileBottomSheetVisible(false);
            setSelectedUserId(null);
          }}
        />

        {/* Image Gallery */}
        <ImageGallery
          visible={galleryVisible}
          images={galleryMedia.map((m) => m.url)}
          initialIndex={galleryIndex}
          onClose={() => setGalleryVisible(false)}
        />

        {/* Video Player Modal */}
        {videoPreviewUrl && (
          <Modal
            visible={!!videoPreviewUrl}
            transparent
            animationType="fade"
            onRequestClose={() => setVideoPreviewUrl(null)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)' }}>
              <TouchableOpacity
                style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }}
                onPress={() => setVideoPreviewUrl(null)}
              >
                <Ionicons name="close" size={32} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <VideoView
                  style={{ width: '100%', height: 300 }}
                  player={videoPlayer}
                  allowsPictureInPicture
                />
              </View>
            </View>
          </Modal>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexGrow: 1,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 6,
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 8,
  },
  messageContainerOwn: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    alignSelf: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 4,
  },
  messageContent: {
    maxWidth: '75%',
    minWidth: 80,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    
  },
  messageBubbleOwn: {
    borderTopRightRadius: 6,
  },
  messageBubbleOther: {
    borderTopLeftRadius: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
  messageMedia: {
    width: 240,
    height: 180,
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageImage: {
    width: 240,
    height: 180,
    borderRadius: 12,
  },
  videoPreview: {
    position: 'relative',
    width: 240,
    height: 180,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  messageTimestamp: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.6,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  reactionsContainerOwn: {
    justifyContent: 'flex-end',
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#1e293b',
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  typingText: {
    fontSize: 13,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  headerMenu: {
    position: 'absolute',
    top: 60,
    right: 16,
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderRadius: 8,
  },
  menuOptionText: {
    fontSize: 15,
  },
  messageMenu: {
    position: 'absolute',
    borderRadius: 12,
    padding: 8,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  messageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
    borderRadius: 8,
  },
  messageOptionText: {
    fontSize: 14,
  },
  quickReactionsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  },
  quickReactionButton: {
    padding: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickReactionEmoji: {
    fontSize: 20,
  },
  mediaPreviewContainer: {
    padding: 12,
    borderTopWidth: 1,
  },
  mediaPreview: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  mediaPreviewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  mediaPreviewInfo: {
    flex: 1,
  },
  mediaPreviewName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  mediaPreviewSize: {
    fontSize: 12,
    opacity: 0.6,
  },
  removeMediaButton: {
    padding: 8,
  },
  typingIndicator: {
    marginBottom: 8,
  },
  deletedMessage: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 8,
    opacity: 0.6,
  },
  messageContainerOther: {
    justifyContent: 'flex-start',
    
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  messageTime: {
    fontSize: 11,
    alignSelf: 'flex-end',
    opacity: 0.6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  editIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 2,
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 12,
    gap: 8,
    borderTopWidth: 1,
  },
  attachButton: {
    padding: 8,
  },
  emojiButton: {
    padding: 8,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#475569',
  },
  textInput: {
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#ffffff',
  },
  contextMenu: {
    position: 'absolute',
    top: 60,
    right: 10,
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  messageOptionsMenu: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  messageOptionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  quickReactions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
});
