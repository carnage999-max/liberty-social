import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  AppState,
  ActivityIndicator,
  Modal,
  Alert,
  Keyboard,
} from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { useToast } from '../../../contexts/ToastContext';
import { apiClient } from '../../../utils/api';
import { Message, Conversation, PaginatedResponse } from '../../../types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AppNavbar from '../../../components/layout/AppNavbar';
import { TypingIndicator } from '../../../components/TypingIndicator';
import { resolveRemoteUrl, DEFAULT_AVATAR, resolveMediaUrls } from '../../../utils/url';
import { useAuth } from '../../../contexts/AuthContext';
import { useCall } from '../../../contexts/CallContext';
import { useChatWebSocket } from '../../../hooks/useChatWebSocket';
import * as ImagePicker from 'expo-image-picker';
import AdvancedEmojiPicker from '../../../components/feed/AdvancedEmojiPicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storage } from '../../../utils/storage';
import { getApiBase } from '../../../constants/API';
import { useAlert } from '../../../contexts/AlertContext';
import UserProfileBottomSheet from '../../../components/profile/UserProfileBottomSheet';
import ImageGallery from '../../../components/common/ImageGallery';
import { useTypingStatus } from '../../../contexts/TypingStatusContext';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as Clipboard from 'expo-clipboard';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { Audio } from 'expo-av';
import { useFeedBackground, type FeedBackgroundType } from '../../../hooks/useFeedBackground';
import FeedBackgroundModal from '../../../components/feed/FeedBackgroundModal';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AmericanBackground,
  ChristmasBackground,
  HalloweenBackground,
  CloudsBackground,
  NatureBackground,
  SpaceBackground,
  OceanBackground,
  ForestBackground,
  SunsetBackground,
  StarsBackground,
  ButterfliesBackground,
  DragonsBackground,
  ChristmasTreesBackground,
  MusicNotesBackground,
  PixelHeartsBackground,
} from '../../../components/feed/AnimatedBackgrounds';
import { Image } from 'expo-image';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

type MediaAttachment = {
  uri: string;
  type: 'image' | 'video';
  mimeType?: string;
  filename?: string;
};

const isAudioUrl = (url?: string | null) =>
  !!url && /\.(m4a|mp3|wav|aac|ogg|flac|wma|webm)(\?.*)?$/i.test(url);

// Check video AFTER audio to avoid false positives (webm can be audio or video)
// Only treat as video if it's NOT audio and matches video extensions
const isVideoUrl = (url?: string | null) => {
  if (!url) return false;
  // First check if it's audio - if so, it's not a video
  if (isAudioUrl(url)) return false;
  // Then check for video extensions (excluding webm since it's handled above)
  return /\.(mp4|mov|m4v|mkv|avi|3gp)(\?.*)?$/i.test(url);
};

// Memoized MessageItem component for performance optimization
type MessageItemProps = {
  item: Message;
  isOwn: boolean;
  avatarSource: any;
  mediaUrl: string | null;
  isAudio: boolean;
  isVideo: boolean;
  playingAudioId: number | null;
  audioDuration: number;
  audioPosition: number;
  videoThumbnails: Record<number, string>;
  galleryMedia: Array<{ messageId: number; url: string }>;
  chatBackgroundTheme: string;
  colors: any;
  isDark: boolean;
  onLongPress: () => void;
  onAudioPress: () => void;
  onImagePress: () => void;
  onVideoPress: () => void;
  onVideoLayout: () => void;
  onReactionPress: (text: string) => void;
  formatTime: (date: string) => string;
  formatDuration: (seconds: number) => string;
  waveformHeights: number[];
  progressBarWidthRef: React.MutableRefObject<number>;
  audioSound: Audio.Sound | null;
  setAudioPosition: (pos: number) => void;
};

const MessageItem = memo(({
  item,
  isOwn,
  avatarSource,
  mediaUrl,
  isAudio,
  isVideo,
  playingAudioId,
  audioDuration,
  audioPosition,
  videoThumbnails,
  galleryMedia,
  chatBackgroundTheme,
  colors,
  isDark,
  onLongPress,
  onAudioPress,
  onImagePress,
  onVideoPress,
  onVideoLayout,
  onReactionPress,
  formatTime,
  formatDuration,
  waveformHeights,
  progressBarWidthRef,
  audioSound,
  setAudioPosition,
  showDateSeparator,
  formatDateSeparator,
}: MessageItemProps) => {
  if (item.is_deleted) {
    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparatorContainer}>
            <View style={[styles.dateSeparator, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
              <Text style={[styles.dateSeparatorText, { color: colors.textSecondary }]}>
                {formatDateSeparator(new Date(item.created_at))}
              </Text>
            </View>
          </View>
        )}
        <View
          style={[
            styles.messageContainer,
            isOwn ? styles.messageContainerOwn : styles.messageContainerOther,
          ]}
        >
          <View style={styles.messageContent}>
            <View
              style={[
                styles.messageBubble,
                styles.deletedMessageBubble,
                {
                  backgroundColor: '#9CA3AF',
                },
              ]}
            >
              <Text
                style={[
                  styles.deletedMessage,
                  {
                    color: '#FFFFFF',
                    textShadowColor: chatBackgroundTheme !== 'default' ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
                    textShadowOffset: chatBackgroundTheme !== 'default' ? { width: 0, height: 1 } : { width: 0, height: 0 },
                    textShadowRadius: chatBackgroundTheme !== 'default' ? 2 : 0,
                  },
                ]}
              >
                This message was deleted
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View>
      {showDateSeparator && (
        <View style={styles.dateSeparatorContainer}>
          <View style={[styles.dateSeparator, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
            <Text style={[styles.dateSeparatorText, { color: colors.textSecondary }]}>
              {formatDateSeparator(new Date(item.created_at))}
            </Text>
          </View>
        </View>
      )}
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
          onLongPress={onLongPress}
          activeOpacity={0.9}
          delayLongPress={300}
        >
          <View
            style={[
              styles.messageBubble,
              isOwn
                ? { backgroundColor: '#0B3D91' }
                : { backgroundColor: isDark ? colors.backgroundSecondary : '#E5E5E5' },
            ]}
          >
            {!isOwn && (
              <Text style={[
                styles.messageSender, 
                { 
                  color: colors.textSecondary,
                  textShadowColor: chatBackgroundTheme !== 'default' ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
                  textShadowOffset: chatBackgroundTheme !== 'default' ? { width: 0, height: 1 } : { width: 0, height: 0 },
                  textShadowRadius: chatBackgroundTheme !== 'default' ? 2 : 0,
                }
              ]}>
                {item.sender.first_name || item.sender.username || 'User'}
              </Text>
            )}
            {mediaUrl && isAudio && (
              <View style={[styles.audioPlayerContainer, { backgroundColor: isOwn ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]}>
                <TouchableOpacity
                  onPress={onAudioPress}
                  style={styles.audioPlayButton}
                >
                  <Ionicons
                    name={playingAudioId === item.id ? "pause" : "play"}
                    size={24}
                    color={isOwn ? '#FFFFFF' : colors.primary}
                  />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.audioWaveform}>
                    {waveformHeights.map((height, i) => (
                      <View
                        key={i}
                        style={[
                          styles.audioWaveBar,
                          {
                            height: playingAudioId === item.id ? height : 8,
                            backgroundColor: isOwn ? 'rgba(255, 255, 255, 0.6)' : colors.primary,
                          }
                        ]}
                      />
                    ))}
                  </View>
                  {playingAudioId === item.id && audioDuration > 0 && (
                    <TouchableOpacity
                      style={styles.audioProgressContainer}
                      activeOpacity={1}
                      onLayout={(e) => {
                        progressBarWidthRef.current = e.nativeEvent.layout.width;
                      }}
                      onPress={async (e) => {
                        if (audioSound && progressBarWidthRef.current > 0) {
                          try {
                            const { locationX } = e.nativeEvent;
                            const seekRatio = Math.max(0, Math.min(1, locationX / progressBarWidthRef.current));
                            const seekMillis = Math.floor(seekRatio * audioDuration * 1000);
                            await audioSound.setPositionAsync(seekMillis);
                            setAudioPosition(Math.floor(seekMillis / 1000));
                          } catch (error) {
                            console.error('Error seeking audio:', error);
                          }
                        }
                      }}
                    >
                      <View style={[
                        styles.audioProgressBar,
                        { 
                          backgroundColor: isOwn ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.1)',
                        }
                      ]}>
                        <View style={[
                          styles.audioProgressFill,
                          { 
                            width: `${(audioPosition / audioDuration) * 100}%`,
                            backgroundColor: isOwn ? '#FFFFFF' : colors.primary,
                          }
                        ]} />
                      </View>
                    </TouchableOpacity>
                  )}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <Text style={[styles.audioDuration, { color: isOwn ? 'rgba(255, 255, 255, 0.8)' : colors.textSecondary }]}>
                      Voice note{(() => {
                        if (item.content && item.content.includes('[duration:')) {
                          const durationMatch = item.content.match(/\[duration:(\d+:\d+)\]/);
                          if (durationMatch) {
                            return ` • ${durationMatch[1]}`;
                          }
                        }
                        return '';
                      })()}
                    </Text>
                    {playingAudioId === item.id && audioDuration > 0 && (
                      <Text style={[styles.audioDuration, { color: isOwn ? 'rgba(255, 255, 255, 0.6)' : colors.textSecondary, fontSize: 11 }]}>
                        {formatDuration(audioPosition)} / {formatDuration(audioDuration)}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}
            {mediaUrl && !isVideo && !isAudio && (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={onImagePress}
              >
                <Image
                  source={{ uri: mediaUrl }}
                  style={styles.messageMedia}
                  contentFit="cover"
                />
              </TouchableOpacity>
            )}
            {mediaUrl && isVideo && (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={onVideoPress}
                onLayout={onVideoLayout}
              >
                <View style={[styles.messageMedia, styles.videoPreview, { backgroundColor: '#000' }]}>
                  {videoThumbnails[item.id] ? (
                    <Image
                      source={{ uri: videoThumbnails[item.id] }}
                      style={[styles.messageMedia, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}
                      contentFit="cover"
                    />
                  ) : null}
                  <View style={styles.videoOverlay}>
                    <Ionicons name="play-circle" size={64} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', marginTop: 8, fontSize: 12 }}>Tap to play video</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            {item.content && (() => {
              let displayContent = item.content;
              if (displayContent.includes('[duration:')) {
                displayContent = displayContent.replace(/\[duration:\d+:\d+\]/g, '').trim();
              }
              return displayContent ? (
                <Text
                  style={[
                    styles.messageText,
                    { 
                      color: isOwn ? '#FFFFFF' : colors.text,
                      textShadowColor: chatBackgroundTheme !== 'default' ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
                      textShadowOffset: chatBackgroundTheme !== 'default' ? { width: 0, height: 1 } : { width: 0, height: 0 },
                      textShadowRadius: chatBackgroundTheme !== 'default' ? 2 : 0,
                    },
                  ]}
                >
                  {displayContent}
                </Text>
              ) : null;
            })()}
            <Text
              style={[
                styles.messageTime,
                { color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textSecondary },
              ]}
            >
              {formatTime(item.created_at)}
            </Text>
            
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
                    onPress={() => onReactionPress(`${reaction.user.first_name || reaction.user.username} reacted`)}
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
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo - return true if props are equal (don't re-render)
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.content === nextProps.item.content &&
    prevProps.item.media_url === nextProps.item.media_url &&
    prevProps.item.is_deleted === nextProps.item.is_deleted &&
    prevProps.item.reactions?.length === nextProps.item.reactions?.length &&
    prevProps.playingAudioId === nextProps.playingAudioId &&
    prevProps.audioPosition === nextProps.audioPosition &&
    prevProps.audioDuration === nextProps.audioDuration &&
    prevProps.videoThumbnails[prevProps.item.id] === nextProps.videoThumbnails[nextProps.item.id] &&
    prevProps.chatBackgroundTheme === nextProps.chatBackgroundTheme &&
    prevProps.showDateSeparator === nextProps.showDateSeparator
  );
});

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [next, setNext] = useState<string | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [mediaAttachment, setMediaAttachment] = useState<MediaAttachment | null>(null);
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; username: string; timestamp: number }>>([]);
  const { addTypingUser, removeTypingUser, clearTypingStatus } = useTypingStatus();
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputContainerHeight, setInputContainerHeight] = useState(0);
  const [videoThumbnails, setVideoThumbnails] = useState<Record<number, string>>({});
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
  const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);
  const [previewAudioSound, setPreviewAudioSound] = useState<Audio.Sound | null>(null);
  const [waveformHeights, setWaveformHeights] = useState<number[]>(Array(12).fill(8));
  const [previewWaveformHeights, setPreviewWaveformHeights] = useState<number[]>(Array(12).fill(8));
  const [audioPosition, setAudioPosition] = useState<number>(0); // Current position in seconds
  const [audioDuration, setAudioDuration] = useState<number>(0); // Total duration in seconds
  const progressBarWidthRef = useRef<number>(200); // Default width, will be measured
  const [isRecording, setIsRecording] = useState(false);
  const { theme: chatBackgroundTheme, changeTheme, mounted: backgroundMounted } = useFeedBackground();
  const [backgroundModalVisible, setBackgroundModalVisible] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const recordingDurationRef = useRef<NodeJS.Timeout | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const waveformIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previewWaveformIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageIdRef = useRef<number | null>(null);
  const inputContainerRef = useRef<View | null>(null);
  const loadingOlderRef = useRef(false);
  const scrollOffsetRef = useRef<number>(0);
  const firstVisibleItemRef = useRef<number | null>(null);
  const shouldAutoScrollRef = useRef(true); // Track if user is near bottom (like website)

  // Create video player instance at component level to avoid hook order issues
  const videoPlayer = useVideoPlayer(videoPreviewUrl || '', (player) => {
    if (videoPreviewUrl) {
      player.loop = false;
      player.play();
    }
  });

  const loadConversation = async () => {
    try {
      const data = await apiClient.get<Conversation>(`/conversations/${id}/?include_archived=true`);
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
        `/conversations/${id}/messages/?include_archived=true`
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

  const loadOlderMessages = async () => {
    if (!next || loadingMore || !id || loadingOlderRef.current) return;
    
    try {
      loadingOlderRef.current = true;
      setLoadingMore(true);
      
      // Save current scroll position and height (like website does)
      let previousScrollHeight = 0;
      let previousScrollOffset = 0;
      
      // Get current scroll metrics from FlatList
      if (flatListRef.current) {
        try {
          // Use getScrollMetrics if available, otherwise use ref
          const metrics = (flatListRef.current as any).getScrollMetrics?.();
          if (metrics) {
            previousScrollHeight = metrics.contentLength;
            previousScrollOffset = metrics.offset;
          }
        } catch (e) {
          // Fallback: use stored offset
          previousScrollOffset = scrollOffsetRef.current;
        }
      }
      
      // Extract path from next URL (handle both full URLs and relative paths)
      let path = next;
      if (next.startsWith('http://') || next.startsWith('https://')) {
        try {
          const url = new URL(next);
          path = url.pathname + url.search;
          // Remove /api prefix if present since API base already includes it
          if (path.startsWith('/api/')) {
            path = path.substring(4);
          }
        } catch (error) {
          console.error('Error parsing nextUrl:', next, error);
          path = next.startsWith('/api/') ? next.substring(4) : next;
        }
      } else if (path.startsWith('/api/')) {
        path = path.substring(4);
      }
      
      const response = await apiClient.get<PaginatedResponse<Message>>(path);
      const olderMessages = response.results.reverse();
      
      if (olderMessages.length === 0) {
        setNext(null);
        return;
      }
      
      // Prepend older messages to the existing messages (like website does)
      setMessages((prev) => [...olderMessages, ...prev]);
      setNext(response.next || null);
      
      // Restore scroll position after new messages are added (exact website logic)
      setTimeout(() => {
        if (flatListRef.current) {
          try {
            // Get new scroll metrics
            const metrics = (flatListRef.current as any).getScrollMetrics?.();
            if (metrics) {
              const newScrollHeight = metrics.contentLength;
              const scrollDifference = newScrollHeight - previousScrollHeight;
              const newScrollOffset = previousScrollOffset + scrollDifference;
              
              // Scroll to the new offset (like website: scrollTop = previousScrollTop + scrollDifference)
              flatListRef.current.scrollToOffset({
                offset: newScrollOffset,
                animated: false,
              });
            } else {
              // Fallback: try to maintain approximate position
              flatListRef.current.scrollToOffset({
                offset: previousScrollOffset + (olderMessages.length * 100), // Approximate 100px per message
                animated: false,
              });
            }
          } catch (error) {
            console.warn('Failed to restore scroll position:', error);
          }
        }
      }, 50);
    } catch (error) {
      console.error('Failed to load older messages:', error);
      showError('Failed to load older messages');
    } finally {
      setLoadingMore(false);
      // Reset the ref after a delay to allow scroll to stabilize
      setTimeout(() => {
        loadingOlderRef.current = false;
      }, 1000);
    }
  };

  const markAsRead = async () => {
    if (!id) return;
    try {
      await apiClient.post(`/conversations/${id}/mark-read/?include_archived=true`);
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
        // Only scroll to bottom if user is near bottom (like website)
        if (shouldAutoScrollRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
        }
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
      // Don't show typing indicator for current user
      if (String(userId) === String(user?.id)) return;
      
      // Update global typing status immediately
      if (conversationId) {
        addTypingUser(conversationId, userId, username);
      }
      
      setTypingUsers((prev) => {
        // Remove if already exists
        const filtered = prev.filter((u) => u.userId !== userId);
        return [...filtered, { userId, username, timestamp: Date.now() }];
      });
    },
    onTypingStop: (userId: string) => {
      // Don't process typing stop for current user
      if (String(userId) === String(user?.id)) return;
      
      // Update global typing status immediately
      if (conversationId) {
        removeTypingUser(conversationId, userId);
      }
      
      setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
    },
    onReactionCreated: (messageId: number, reaction: any) => {
      // Update message with new reaction
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId) {
            const existingReactions = msg.reactions || [];
            // Check if reaction already exists (avoid duplicates)
            const reactionExists = existingReactions.some(
              (r) => r.id === reaction.id || (r.user.id === reaction.user.id && r.reaction_type === reaction.reaction_type)
            );
            if (reactionExists) {
              return msg;
            }
            return {
              ...msg,
              reactions: [...existingReactions, reaction],
            };
          }
          return msg;
        })
      );
    },
    onReactionDeleted: (messageId: number, reactionId: number) => {
      // Remove reaction from message
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId) {
            return {
              ...msg,
              reactions: (msg.reactions || []).filter((r) => r.id !== reactionId),
            };
          }
          return msg;
        })
      );
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
      
      return () => {
        // Clear typing status when screen loses focus
        if (conversationId) {
          clearTypingStatus(conversationId);
        }
      };
    }, [id, conversationId, clearTypingStatus])
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

  // Handle keyboard show/hide events
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Scroll to bottom when keyboard opens only if user is near bottom
        if (shouldAutoScrollRef.current) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      // Use ref to get the latest recording state
      const currentRecording = recordingRef.current;
      if (currentRecording) {
        currentRecording.getStatusAsync()
          .then((status) => {
            if (status.isRecording || (status as any).canRecord) {
              return currentRecording.stopAndUnloadAsync();
            }
          })
          .catch(() => {
            // Recording might already be unloaded, ignore error
          });
      }
      if (recordingDurationRef.current) {
        clearInterval(recordingDurationRef.current);
        recordingDurationRef.current = null;
      }
    };
  }, []); // Only run on unmount

  // Generate video thumbnail
  const generateVideoThumbnail = async (videoUrl: string, messageId: number) => {
    if (videoThumbnails[messageId]) return; // Already generated
    
    // Double-check it's actually a video, not audio (webm can be either)
    if (isAudioUrl(videoUrl)) {
      console.warn('Skipping thumbnail generation for audio file:', videoUrl);
      return;
    }
    
    try {
      const { uri } = await getThumbnailAsync(videoUrl, {
        time: 1000, // 1 second into the video
        quality: 0.8,
      });
      setVideoThumbnails((prev) => ({ ...prev, [messageId]: uri }));
    } catch (error) {
      console.error('Error generating video thumbnail:', error);
    }
  };

  // Request microphone permission
  const requestMicrophonePermission = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        showError('Microphone permission is required to record voice notes');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      showError('Failed to request microphone permission');
      return false;
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      recordingRef.current = newRecording;
      setIsRecording(true);
      setRecordingDuration(0);
      setAudioUri(null);

      // Start duration timer
      recordingDurationRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      showError('Failed to start recording');
      setIsRecording(false);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (!recording) return;

    try {
      const uri = recording.getURI();
      
      try {
        await recording.stopAndUnloadAsync();
      } catch (error: any) {
        // Recording might already be stopped, check if we have URI
        if (!uri && error.message?.includes('already been unloaded')) {
          console.log('Recording already unloaded');
        } else {
          throw error;
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      if (uri) {
        setAudioUri(uri);
        // Get audio duration
        try {
          const { sound } = await Audio.Sound.createAsync({ uri });
          const status = await sound.getStatusAsync();
          if (status.isLoaded && status.durationMillis) {
            const durationSeconds = Math.floor(status.durationMillis / 1000);
            setAudioDuration(durationSeconds);
          }
          await sound.unloadAsync();
        } catch (error) {
          console.error('Error getting audio duration:', error);
          // Fallback to recording duration if available
          setAudioDuration(recordingDuration);
        }
      }

      if (recordingDurationRef.current) {
        clearInterval(recordingDurationRef.current);
        recordingDurationRef.current = null;
      }

      setRecording(null);
      recordingRef.current = null;
      setIsRecording(false);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      showError('Failed to stop recording');
      setRecording(null);
      recordingRef.current = null;
      setIsRecording(false);
    }
  };

  // Cancel recording
  const cancelRecording = async () => {
    if (recording) {
      try {
        const status = await recording.getStatusAsync();
        if (status.isRecording || (status as any).canRecord) {
          await recording.stopAndUnloadAsync();
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
        });
      } catch (error: any) {
        // Ignore "already unloaded" errors
        if (!error.message?.includes('already been unloaded')) {
          console.error('Error canceling recording:', error);
        }
      }
    }

    if (recordingDurationRef.current) {
      clearInterval(recordingDurationRef.current);
      recordingDurationRef.current = null;
    }

    setRecording(null);
    recordingRef.current = null;
    setIsRecording(false);
    setRecordingDuration(0);
    setAudioUri(null);
    setAudioDuration(0);
    setAudioDuration(0);
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Play preview audio
  const playPreviewAudio = async () => {
    if (!audioUri) return;

    try {
      // Stop any existing preview audio
      if (previewAudioSound) {
        await previewAudioSound.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );

      setPreviewAudioSound(sound);

      // Start waveform animation
      if (previewWaveformIntervalRef.current) {
        clearInterval(previewWaveformIntervalRef.current);
      }
      previewWaveformIntervalRef.current = setInterval(() => {
        setPreviewWaveformHeights(
          Array(12).fill(0).map(() => Math.random() * 20 + 8)
        );
      }, 150);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          if (previewWaveformIntervalRef.current) {
            clearInterval(previewWaveformIntervalRef.current);
            previewWaveformIntervalRef.current = null;
          }
          sound.unloadAsync();
          setPreviewAudioSound(null);
          setPreviewWaveformHeights(Array(12).fill(8));
        }
      });
    } catch (error) {
      console.error('Error playing preview audio:', error);
      showError('Failed to play audio');
    }
  };

  // Stop preview audio
  const stopPreviewAudio = async () => {
    if (previewAudioSound) {
      try {
        await previewAudioSound.stopAsync();
        await previewAudioSound.unloadAsync();
        setPreviewAudioSound(null);
        if (previewWaveformIntervalRef.current) {
          clearInterval(previewWaveformIntervalRef.current);
          previewWaveformIntervalRef.current = null;
        }
        setPreviewWaveformHeights(Array(12).fill(8));
      } catch (error) {
        console.error('Error stopping preview audio:', error);
      }
    }
  };

  // Play message audio
  const playMessageAudio = async (audioUrl: string, messageId: number) => {
    try {
      // Stop any currently playing audio
      if (audioSound) {
        await audioSound.unloadAsync();
        setAudioSound(null);
        setPlayingAudioId(null);
        setWaveformHeights(Array(12).fill(8));
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );

      setAudioSound(sound);
      setPlayingAudioId(messageId);

      // Start waveform animation
      if (waveformIntervalRef.current) {
        clearInterval(waveformIntervalRef.current);
      }
      waveformIntervalRef.current = setInterval(() => {
        setWaveformHeights(
          Array(12).fill(0).map(() => Math.random() * 30 + 10)
        );
      }, 150);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          // Update position and duration
          if (status.positionMillis !== undefined) {
            setAudioPosition(Math.floor(status.positionMillis / 1000));
          }
          if (status.durationMillis !== undefined && status.durationMillis > 0) {
            setAudioDuration(Math.floor(status.durationMillis / 1000));
          }
          
          if (status.didJustFinish) {
            if (waveformIntervalRef.current) {
              clearInterval(waveformIntervalRef.current);
              waveformIntervalRef.current = null;
            }
            sound.unloadAsync();
            setAudioSound(null);
            setPlayingAudioId(null);
            setWaveformHeights(Array(12).fill(8));
            setAudioPosition(0);
            setAudioDuration(0);
          }
        }
      });
    } catch (error) {
      console.error('Error playing message audio:', error);
      showError('Failed to play audio');
    }
  };

  // Stop message audio
  const stopMessageAudio = async () => {
    if (audioSound) {
      try {
        await audioSound.stopAsync();
        await audioSound.unloadAsync();
        setAudioSound(null);
        setPlayingAudioId(null);
        if (waveformIntervalRef.current) {
          clearInterval(waveformIntervalRef.current);
          waveformIntervalRef.current = null;
        }
        setWaveformHeights(Array(12).fill(8));
      } catch (error) {
        console.error('Error stopping message audio:', error);
      }
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudioSound) {
        previewAudioSound.unloadAsync().catch(console.error);
      }
      if (audioSound) {
        audioSound.unloadAsync().catch(console.error);
      }
      if (previewWaveformIntervalRef.current) {
        clearInterval(previewWaveformIntervalRef.current);
      }
      if (waveformIntervalRef.current) {
        clearInterval(waveformIntervalRef.current);
      }
    };
  }, [previewAudioSound, audioSound]);

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
    if ((!messageText.trim() && !mediaAttachment && !audioUri) || sending) return;

    try {
      setSending(true);
      let mediaUrl: string | null = null;

      // Upload audio if present
      if (audioUri && editingMessageId === null) {
        try {
          const formData = new FormData();
          const filename = `voice-note-${Date.now()}.m4a`;
          const mimeType = 'audio/x-m4a'; // Use correct MIME type for m4a
          
          formData.append('file', {
            uri: audioUri,
            type: mimeType,
            name: filename,
          } as any);

          console.log('[Message] Uploading audio:', { filename, mimeType });
          
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
          
          if (uploadData.url) {
            mediaUrl = uploadData.url;
          } else if (uploadData.urls && Array.isArray(uploadData.urls) && uploadData.urls.length > 0) {
            mediaUrl = uploadData.urls[0];
          } else {
            throw new Error('No URL in upload response');
          }
        } catch (error: any) {
          console.error('[Message] Audio upload error:', error);
          const errorMessage = error?.message || 'Failed to upload audio';
          showError(errorMessage);
          setSending(false);
          return;
        }
      }

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
        // Include duration in content for audio messages
        let content = messageText.trim() || null;
        if (audioUri && recordingDuration > 0) {
          const durationStr = formatDuration(recordingDuration);
          content = content ? `${content} [duration:${durationStr}]` : `[duration:${durationStr}]`;
        }
        
      const response = await apiClient.post<Message>(
        `/conversations/${id}/messages/`,
        {
            content: content,
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
        setAudioUri(null);
        setAudioDuration(0);
        cancelRecording();
      lastMessageIdRef.current = response.id;
        markAsRead();
      }
      
      // Scroll to bottom only if user is near bottom (like website)
      // When sending a message, user should see it, so set shouldAutoScrollRef to true
      shouldAutoScrollRef.current = true;
      setTimeout(() => {
        if (shouldAutoScrollRef.current) {
        flatListRef.current?.scrollToEnd({ animated: true });
        }
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

  const formatDateSeparator = (date: Date): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const messageDate = new Date(date);
    messageDate.setHours(0, 0, 0, 0);
    
    if (messageDate.getTime() === today.getTime()) {
      return "Today";
    } else if (messageDate.getTime() === yesterday.getTime()) {
      return "Yesterday";
    } else {
      // Format as DD/MM/YYYY
      const day = String(messageDate.getDate()).padStart(2, "0");
      const month = String(messageDate.getMonth() + 1).padStart(2, "0");
      const year = messageDate.getFullYear();
      return `${day}/${month}/${year}`;
    }
  };

  const galleryMedia = useMemo(() => {
    return messages
      .map((message) => {
        if (!message.media_url) return null;
        const url = resolveMediaUrls(message.media_url)[0];
        if (!url || isVideoUrl(url) || isAudioUrl(url)) return null;
        return { messageId: message.id, url };
      })
      .filter((entry): entry is { messageId: number; url: string } => !!entry);
  }, [messages]);

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.sender.id === user?.id;
    const avatarUrl = item.sender.profile_image_url
      ? resolveRemoteUrl(item.sender.profile_image_url)
      : null;
    const avatarSource = avatarUrl ? { uri: avatarUrl } : DEFAULT_AVATAR;
    const mediaUrl = item.media_url ? resolveMediaUrls(item.media_url)[0] : null;
    const isAudio = isAudioUrl(mediaUrl);
    const isVideo = isVideoUrl(mediaUrl) && !isAudio;

    // Check if we need to show a date separator (like website)
    const showDateSeparator = (() => {
      if (index === 0) return true; // Always show for first message
      
      const currentDate = new Date(item.created_at);
      const previousMessage = messages[index - 1];
      if (!previousMessage) return false;
      
      const previousDate = new Date(previousMessage.created_at);
      
      // Check if dates are different
    return (
        currentDate.getDate() !== previousDate.getDate() ||
        currentDate.getMonth() !== previousDate.getMonth() ||
        currentDate.getFullYear() !== previousDate.getFullYear()
      );
    })();

    return (
      <MessageItem
        item={item}
        isOwn={isOwn}
        avatarSource={avatarSource}
        mediaUrl={mediaUrl}
        isAudio={isAudio}
        isVideo={isVideo}
        playingAudioId={playingAudioId}
        audioDuration={audioDuration}
        audioPosition={audioPosition}
        videoThumbnails={videoThumbnails}
        galleryMedia={galleryMedia}
        chatBackgroundTheme={chatBackgroundTheme}
        colors={colors}
        isDark={isDark}
        onLongPress={() => {
          setSelectedMessageId(item.id);
          setMessageMenuVisible(true);
        }}
        onAudioPress={() => {
          if (playingAudioId === item.id) {
            stopMessageAudio();
          } else {
            playMessageAudio(mediaUrl!, item.id);
          }
        }}
        onImagePress={() => {
          const galleryIndex = galleryMedia.findIndex((m) => m.messageId === item.id);
          if (galleryIndex >= 0) {
            setGalleryIndex(galleryIndex);
            setGalleryVisible(true);
          }
        }}
        onVideoPress={() => setVideoPreviewUrl(mediaUrl!)}
        onVideoLayout={() => {
          if (!videoThumbnails[item.id] && mediaUrl) {
            generateVideoThumbnail(mediaUrl, item.id);
          }
        }}
        onReactionPress={(text) => showSuccess(text)}
        formatTime={formatTime}
        formatDuration={formatDuration}
        waveformHeights={waveformHeights}
        progressBarWidthRef={progressBarWidthRef}
        audioSound={audioSound}
        setAudioPosition={setAudioPosition}
        showDateSeparator={showDateSeparator}
        formatDateSeparator={formatDateSeparator}
      />
    );
  }, [user?.id, colors, isDark, chatBackgroundTheme, playingAudioId, audioDuration, audioPosition, videoThumbnails, galleryMedia, formatTime, formatDuration, waveformHeights, playMessageAudio, stopMessageAudio, setSelectedMessageId, setMessageMenuVisible, setVideoPreviewUrl, setGalleryIndex, setGalleryVisible, generateVideoThumbnail, showSuccess, audioSound, messages, formatDateSeparator]);

  const canSend = editingMessageId !== null 
    ? editText.trim() 
    : messageText.trim() || mediaAttachment || audioUri;

  // Get receiver ID for calls
  const getReceiverId = useCallback(() => {
    if (!conversation || conversation.is_group) return null;
    const otherParticipant = conversation.participants.find(
      (p) => p.user.id !== user?.id
    );
    return otherParticipant?.user.id || null;
  }, [conversation, user?.id]);

  // Use call context
  const { initiateCall } = useCall();

  // Handle voice call
  const handleVoiceCall = async () => {
    try {
      const receiverId = getReceiverId();
      if (!receiverId) {
        showError('Cannot initiate call to group chat');
        return;
      }
      await initiateCall(receiverId, 'voice', conversationId || undefined);
    } catch (error) {
      console.error('Error initiating voice call:', error);
      showError('Failed to initiate voice call');
    }
  };

  // Handle video call
  const handleVideoCall = async () => {
    try {
      const receiverId = getReceiverId();
      if (!receiverId) {
        showError('Cannot initiate call to group chat');
        return;
      }
      await initiateCall(receiverId, 'video', conversationId || undefined);
    } catch (error) {
      console.error('Error initiating video call:', error);
      showError('Failed to initiate video call');
    }
  };

  const headerContextMenu = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 }}>
      {/* Voice call button */}
      <TouchableOpacity onPress={handleVoiceCall} style={{ padding: 8 }}>
        <Ionicons name="call" size={22} color={colors.primary} />
      </TouchableOpacity>
      
      {/* Video call button */}
      <TouchableOpacity onPress={handleVideoCall} style={{ padding: 8 }}>
        <Ionicons name="videocam" size={22} color={colors.primary} />
      </TouchableOpacity>
      
      {/* Menu button */}
      <TouchableOpacity
        onPress={() => setHeaderMenuVisible(true)}
        style={{ padding: 8 }}
      >
        <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
      </TouchableOpacity>
    </View>
  );

  // Calculate bottom position for input container
  // When keyboard is open: position at keyboardHeight (sits on top of keyboard)
  // When keyboard is closed: position at safe area bottom
  const inputBottom = keyboardHeight > 0 
    ? keyboardHeight 
    : insets.bottom;
  
  // Calculate padding for input container
  // Add safe area padding when keyboard is closed (iOS only, Android handles it automatically)
  const inputPaddingBottom = keyboardHeight > 0 
    ? 0 
    : (Platform.OS === 'ios' ? insets.bottom : 0);

  // Background image mapping
  const BACKGROUND_IMAGES: Record<string, any> = useMemo(() => ({
    '/backgrounds/american-flag.gif': require('../../../assets/backgrounds/american-flag.gif'),
    '/backgrounds/nyan-cat.gif': require('../../../assets/backgrounds/nyan-cat.gif'),
    '/backgrounds/christmas-tree.gif': require('../../../assets/backgrounds/christmas-tree.gif'),
    '/backgrounds/sunset.gif': require('../../../assets/backgrounds/sunset.gif'),
    '/backgrounds/shooting-star.gif': require('../../../assets/backgrounds/shooting-star.gif'),
    '/backgrounds/minions-dance.gif': require('../../../assets/backgrounds/minions-dance.gif'),
    '/backgrounds/frog-chilling-under-sunset.gif': require('../../../assets/backgrounds/frog-chilling-under-sunset.gif'),
    '/backgrounds/cat-lanterns.gif': require('../../../assets/backgrounds/cat-lanterns.gif'),
    '/backgrounds/ghost.gif': require('../../../assets/backgrounds/ghost.gif'),
    '/backgrounds/dark-stars.png': require('../../../assets/backgrounds/dark-stars.png'),
    '/backgrounds/cat-eyes.png': require('../../../assets/backgrounds/cat-eyes.png'),
    '/backgrounds/spider-webs.png': require('../../../assets/backgrounds/spider-webs.png'),
    '/backgrounds/spider.png': require('../../../assets/backgrounds/spider.png'),
    '/backgrounds/gothic-skulls.jpeg': require('../../../assets/backgrounds/gothic-skulls.jpeg'),
    '/backgrounds/dragon-chinese-myth.jpeg': require('../../../assets/backgrounds/dragon-chinese-myth.jpeg'),
    '/backgrounds/demon-slayer-flame-hashira.jpeg': require('../../../assets/backgrounds/demon-slayer-flame-hashira.jpeg'),
    '/backgrounds/nyan-cat-purple.jpeg': require('../../../assets/backgrounds/nyan-cat-purple.jpeg'),
    '/backgrounds/green-lightning.jpeg': require('../../../assets/backgrounds/green-lightning.jpeg'),
    '/backgrounds/bat-sign.png': require('../../../assets/backgrounds/bat-sign.png'),
    '/backgrounds/emojis.png': require('../../../assets/backgrounds/emojis.png'),
    '/backgrounds/green-corridor.png': require('../../../assets/backgrounds/green-corridor.png'),
    '/backgrounds/illusion.png': require('../../../assets/backgrounds/illusion.png'),
    '/backgrounds/kaleidoscope.png': require('../../../assets/backgrounds/kaleidoscope.png'),
  }), []);

  // Check if background is an image
  const isImageBackground = useMemo(() => 
    chatBackgroundTheme.startsWith('/backgrounds/') && BACKGROUND_IMAGES[chatBackgroundTheme],
    [chatBackgroundTheme]
  );

  // Get background colors for themed backgrounds
  const getBackgroundColors = (): [string, string, string] => {
    switch (chatBackgroundTheme) {
      case 'clouds':
        return ['#E3F2FD', '#BBDEFB', '#90CAF9'] as const;
      case 'nature':
        return ['#F1F8E9', '#DCEDC8', '#C5E1A5'] as const;
      case 'space':
        return ['#1A237E', '#283593', '#3949AB'] as const;
      case 'ocean':
        return ['#E1F5FE', '#B3E5FC', '#81D4FA'] as const;
      case 'forest':
        return ['#E8F5E9', '#C8E6C9', '#A5D6A7'] as const;
      case 'sunset':
        return ['#FFF3E0', '#FFCCBC', '#FFAB91'] as const;
      case 'stars':
        return ['#0D1B2A', '#1B263B', '#415A77'] as const;
      case 'american':
        return ['#B22234', '#FFFFFF', '#3C3B6E'] as const;
      case 'christmas':
        return ['#165B33', '#BB2528', '#F8F8F8'] as const;
      case 'halloween':
        return ['#FF6600', '#1A1A1A', '#FFA500'] as const;
      case 'butterflies':
        return ['#FFF0F5', '#FFE4E1', '#FFB6C1'] as const;
      case 'dragons':
        return ['#2C1810', '#8B4513', '#CD853F'] as const;
      case 'christmas-trees':
        return ['#0B6623', '#228B22', '#32CD32'] as const;
      case 'music-notes':
        return ['#663399', '#9370DB', '#BA55D3'] as const;
      case 'pixel-hearts':
        return ['#FF1744', '#F50057', '#C51162'] as const;
      default:
        return [colors.background, colors.background, colors.background] as const;
    }
  };

  // Check if theme has animated background
  const hasAnimatedBackground = [
    'american',
    'christmas',
    'halloween',
    'clouds',
    'nature',
    'space',
    'ocean',
    'forest',
    'sunset',
    'stars',
    'butterflies',
    'dragons',
    'christmas-trees',
    'music-notes',
    'pixel-hearts',
  ].includes(chatBackgroundTheme);

  // Render animated background component
  const renderAnimatedBackground = () => {
    if (!backgroundMounted || chatBackgroundTheme === 'default') return null;

    switch (chatBackgroundTheme) {
      case 'american':
        return <AmericanBackground />;
      case 'christmas':
        return <ChristmasBackground />;
      case 'clouds':
        return <CloudsBackground />;
      case 'space':
        return <SpaceBackground />;
      case 'halloween':
        return <HalloweenBackground />;
      case 'ocean':
        return <OceanBackground />;
      case 'nature':
        return <NatureBackground />;
      case 'forest':
        return <ForestBackground />;
      case 'sunset':
        return <SunsetBackground />;
      case 'stars':
        return <StarsBackground />;
      case 'butterflies':
        return <ButterfliesBackground />;
      case 'dragons':
        return <DragonsBackground />;
      case 'christmas-trees':
        return <ChristmasTreesBackground />;
      case 'music-notes':
        return <MusicNotesBackground />;
      case 'pixel-hearts':
        return <PixelHeartsBackground />;
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: backgroundMounted && chatBackgroundTheme !== 'default' ? 'transparent' : (isDark ? '#0f172a' : '#f8fafc') }]}>
      {/* Image Background Layer */}
      {backgroundMounted && isImageBackground && (
        <Image
          source={BACKGROUND_IMAGES[chatBackgroundTheme]}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      )}
      
      {/* Animated Background Layer */}
      {backgroundMounted && !isImageBackground && hasAnimatedBackground && renderAnimatedBackground()}
      
      {/* Gradient Background Layer */}
      {backgroundMounted && !isImageBackground && !hasAnimatedBackground && chatBackgroundTheme !== 'default' && (
        <LinearGradient
          colors={getBackgroundColors()}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      
      {/* Dark overlay for text visibility on backgrounds */}
      {backgroundMounted && chatBackgroundTheme !== 'default' && (
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.3)', 'transparent', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          locations={[0, 0.2, 1]}
          pointerEvents="none"
        />
      )}
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
        <View style={[styles.emptyContainer, { backgroundColor: 'transparent' }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={[styles.emptyContainer, { backgroundColor: 'transparent' }]}>
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
                renderItem={({ item, index }) => renderMessage({ item, index })}
                keyExtractor={(item) => item.id.toString()}
            onScrollToIndexFailed={(info) => {
              // If scroll to index fails, try scrolling to offset instead
              const wait = new Promise(resolve => setTimeout(resolve, 500));
              wait.then(() => {
                flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
              });
            }}
            style={[{ flex: 1 }, { backgroundColor: backgroundMounted && chatBackgroundTheme !== 'default' ? 'transparent' : (isDark ? '#0f172a' : '#f8fafc') }]}
            contentContainerStyle={[
              styles.messagesList,
              { 
                backgroundColor: 'transparent',
                paddingBottom: inputContainerHeight + inputBottom + inputPaddingBottom + (mediaAttachment ? 80 : 0) + (editingMessageId !== null ? 60 : 0) + (typingUsers.length > 0 ? 50 : 0)
              }
            ]}
            ListHeaderComponent={
              loadingMore ? (
                <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
            ListFooterComponent={
              typingUsers.length > 0 ? (
                <View style={styles.typingIndicatorContainer}>
                  <TypingIndicator typingUsers={typingUsers} />
                </View>
              ) : null
            }
            inverted={false}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() => {
              // Only auto-scroll to bottom if user is near bottom AND not loading older messages (like website)
              if (!loadingMore && !loadingOlderRef.current && shouldAutoScrollRef.current) {
                // Small delay to ensure content is rendered
                setTimeout(() => {
                  if (flatListRef.current) {
                    flatListRef.current.scrollToEnd({ animated: false });
                  }
                }, 50);
              }
            }}
            onScroll={(event) => {
              // Save scroll offset for scroll position restoration (like website)
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              scrollOffsetRef.current = contentOffset.y;
              
              // Track if user is near bottom (like website) - only auto-scroll if within 50px
              const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
              shouldAutoScrollRef.current = distanceFromBottom < 50;
              
              // Load older messages when scrolling near the top (within 100px, like website)
              if (contentOffset.y < 100 && next && !loadingMore && !loadingOlderRef.current) {
                loadOlderMessages();
              }
            }}
            scrollEventThrottle={16}
            removeClippedSubviews={true}
            windowSize={10}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            updateCellsBatchingPeriod={100}
            onLayout={() => {
              // Scroll to bottom on initial layout
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: false });
              }, 100);
            }}
          />
        )}


        {/* Media Attachment Preview - Show above input */}
        {mediaAttachment && (
          <View style={[
            { 
              paddingHorizontal: 16, 
              paddingVertical: 12, 
              backgroundColor: isDark ? '#1e293b' : '#ffffff', 
              borderTopWidth: 1, 
              borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
              position: 'absolute',
              bottom: inputContainerHeight + inputBottom + inputPaddingBottom,
              left: 0,
              right: 0,
            }
          ]}>
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
                  contentFit="cover"
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
          <View 
            ref={inputContainerRef}
            onLayout={(e) => {
              const { height } = e.nativeEvent.layout;
              setInputContainerHeight(height);
            }}
              style={[
              styles.inputContainer,
              {
                position: 'absolute',
                bottom: inputBottom,
                left: 0,
                right: 0,
                paddingBottom: inputPaddingBottom,
              }
            ]}
          >
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
            <View style={styles.inputRow}>
              {!isRecording && !audioUri ? (
                <View style={[styles.inputWrapper, { backgroundColor: isDark ? colors.backgroundSecondary : '#E5E5E5', borderColor: isDark ? colors.border : '#D1D5DB' }]}>
                  <TouchableOpacity
                    style={styles.attachButtonInside}
                    onPress={handlePickMedia}
                    disabled={sending}
                  >
                    <Ionicons
                      name="attach-outline"
                      size={22}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.textInput, { color: colors.text }]}
                    placeholder={editingMessageId !== null ? 'Edit message...' : 'Message'}
                    placeholderTextColor={colors.textSecondary}
                    value={editingMessageId !== null ? editText : messageText}
                    onChangeText={(text) => {
                      if (editingMessageId !== null) {
                        setEditText(text);
                      } else {
                        setMessageText(text);
                        // Call startTyping when user types
                        if (startTyping && text.trim().length > 0) {
                          startTyping();
                        } else if (stopTyping && text.trim().length === 0) {
                          stopTyping();
                        }
                      }
                    }}
                    onBlur={() => {
                      // Stop typing when user stops typing
                      if (stopTyping) stopTyping();
                    }}
                    multiline
                    maxLength={1000}
                    editable={!sending}
                  />
                  <TouchableOpacity
                    style={styles.emojiButtonInside}
                    onPress={() => setEmojiPickerVisible(true)}
                    disabled={sending || isRecording}
                  >
                    <Ionicons
                      name="happy-outline"
                      size={22}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.inputWrapper, { backgroundColor: isDark ? colors.backgroundSecondary : '#E5E5E5', borderColor: isDark ? colors.border : '#D1D5DB', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }]}>
                  {isRecording ? (
                    <>
                      {/* Pulsing red dot */}
                      <View style={{ 
                        width: 12, 
                        height: 12, 
                        borderRadius: 6, 
                        backgroundColor: '#FF6B6B',
                        shadowColor: '#FF6B6B',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.8,
                        shadowRadius: 4,
                        elevation: 4,
                      }} />
                      {/* Duration */}
                      <Text style={{ color: colors.text, fontSize: 16, flex: 1, fontWeight: '500' }}>
                        {formatDuration(recordingDuration)}
                      </Text>
                      {/* Stop button (saves recording) */}
                      <TouchableOpacity
                        onPress={stopRecording}
                        style={{ 
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          marginRight: 8,
                          overflow: 'hidden',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 3,
                          elevation: 4,
                        }}
                      >
                        <LinearGradient
                          colors={['#a8862a', '#d7b756', '#a8862a']}
                          style={{
                            flex: 1,
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: 'rgba(0, 0, 0, 0.2)',
                          }}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Ionicons name="stop" size={18} color="#192A4A" />
                        </LinearGradient>
                      </TouchableOpacity>
                      {/* Cancel button (discards recording) */}
                      <TouchableOpacity
                        onPress={cancelRecording}
                        style={{ 
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          overflow: 'hidden',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 3,
                          elevation: 4,
                        }}
                      >
                        <LinearGradient
                          colors={['#a8862a', '#d7b756', '#a8862a']}
                          style={{
                            flex: 1,
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: 'rgba(0, 0, 0, 0.2)',
                          }}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Ionicons name="close" size={18} color="#192A4A" />
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  ) : audioUri ? (
                    <>
                      <TouchableOpacity
                        onPress={() => {
                          if (previewAudioSound) {
                            stopPreviewAudio();
                          } else {
                            playPreviewAudio();
                          }
                        }}
                        style={{ 
                          width: 40, 
                          height: 40, 
                          borderRadius: 20,
                          overflow: 'hidden',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 3,
                          elevation: 4,
                        }}
                      >
                        <LinearGradient
                          colors={['#a8862a', '#d7b756', '#a8862a']}
                          style={{
                            flex: 1,
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: 'rgba(0, 0, 0, 0.2)',
                          }}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Ionicons
                            name={previewAudioSound ? "pause" : "play"}
                            size={18}
                            color="#192A4A"
                          />
                        </LinearGradient>
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 20, marginBottom: 4 }}>
                          {previewWaveformHeights.map((height, i) => (
                            <View
                              key={i}
            style={[
                                {
                                  width: 3,
                                  height: height,
                                  backgroundColor: '#C8A25F',
                                  borderRadius: 2,
                                }
                              ]}
                            />
                          ))}
                        </View>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>
                          Voice note
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                          {formatDuration(recordingDuration)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={cancelRecording}
                        style={{ 
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          marginRight: 8,
                          overflow: 'hidden',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 3,
                          elevation: 4,
                        }}
                      >
                        <LinearGradient
                          colors={['#a8862a', '#d7b756', '#a8862a']}
                          style={{
                            flex: 1,
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: 'rgba(0, 0, 0, 0.2)',
                          }}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Ionicons name="close" size={18} color="#192A4A" />
                        </LinearGradient>
                      </TouchableOpacity>
                      {/* Send button for voice note */}
                      <TouchableOpacity
                        style={styles.sendButton}
                        onPress={sendMessage}
                        disabled={sending}
                      >
                        <LinearGradient
                          colors={['#a8862a', '#d7b756', '#a8862a']}
                          style={styles.sendButtonGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          {sending ? (
                            <ActivityIndicator size="small" color="#192A4A" />
                          ) : (
                            <Ionicons name="send" size={18} color="#192A4A" />
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              )}
              {!isRecording && !audioUri && (
                <>
                  {canSend ? (
                    <TouchableOpacity
                      style={styles.sendButton}
                      onPress={sendMessage}
                      disabled={sending}
                    >
                      <LinearGradient
                        colors={['#a8862a', '#d7b756', '#a8862a']}
                        style={styles.sendButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        {sending ? (
                          <ActivityIndicator size="small" color="#192A4A" />
                        ) : (
                          <Ionicons
                            name="send"
                            size={18}
                            color="#192A4A"
                          />
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.micButton}
                      onPress={startRecording}
                      disabled={sending}
                    >
                      <LinearGradient
                        colors={['#a8862a', '#d7b756', '#a8862a']}
                        style={styles.micButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Ionicons
                          name="mic"
                          size={18}
                          color="#192A4A"
                        />
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>
        )}
      </View>
      
        <AdvancedEmojiPicker
          visible={emojiPickerVisible}
          onClose={() => setEmojiPickerVisible(false)}
          onSelect={handleEmojiSelect}
        />

        {/* Background Modal */}
        <FeedBackgroundModal
          visible={backgroundModalVisible}
          onClose={() => setBackgroundModalVisible(false)}
          currentTheme={chatBackgroundTheme}
          onThemeChange={(theme: FeedBackgroundType) => {
            changeTheme(theme);
            setBackgroundModalVisible(false);
          }}
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
                            blocked_user_id: otherParticipant.user.id 
                          });
                          showSuccess(`${userName} has been blocked`);
                          router.push('/messages');
                        } catch (error: any) {
                          console.error('Block user error:', error);
                          const errorMessage = error.response?.data?.message || 
                                              error.response?.data?.detail ||
                                              error.response?.data?.blocked_user_id?.[0] ||
                                              'Failed to block user';
                          showError(errorMessage);
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
                style={styles.menuItem}
                onPress={() => {
                  setHeaderMenuVisible(false);
                  setBackgroundModalVisible(true);
                }}
              >
                <Ionicons name="color-palette" size={20} color={colors.text} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>Change Background</Text>
              </TouchableOpacity>
              
              {/* Archive/Unarchive option */}
              {(() => {
                const userParticipant = conversation?.participants.find(
                  (p) => p.user.id === user?.id
                );
                const isArchived = userParticipant?.is_archived || false;
                
                return (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setHeaderMenuVisible(false);
                      if (isArchived) {
                        showConfirm(
                          'Are you sure you want to unarchive this conversation?',
                          async () => {
                            try {
                              await apiClient.post(`/conversations/${id}/unarchive/`);
                              showSuccess('Conversation unarchived');
                              loadConversation(); // Reload to update archived status
                            } catch (error: any) {
                              console.error('Unarchive error:', error);
                              const errorMessage = error.response?.data?.message || 
                                                  error.response?.data?.detail ||
                                                  'Failed to unarchive conversation';
                              showError(errorMessage);
                            }
                          },
                          undefined,
                          'Unarchive Conversation',
                          false
                        );
                      } else {
                        showConfirm(
                          'Are you sure you want to archive this conversation? It will be moved to your archived chats.',
                          async () => {
                            try {
                              await apiClient.post(`/conversations/${id}/archive/`);
                              showSuccess('Conversation archived');
                              router.push('/messages');
                            } catch (error: any) {
                              console.error('Archive error:', error);
                              const errorMessage = error.response?.data?.message || 
                                                  error.response?.data?.detail ||
                                                  'Failed to archive conversation';
                              showError(errorMessage);
                            }
                          },
                          undefined,
                          'Archive Conversation',
                          false
                        );
                      }
                    }}
                  >
                    <Ionicons 
                      name={isArchived ? "archive-outline" : "archive"} 
                      size={20} 
                      color={colors.text} 
                    />
                    <Text style={[styles.menuItemText, { color: colors.text }]}>
                      {isArchived ? 'Unarchive' : 'Archive'}
          </Text>
                  </TouchableOpacity>
                );
              })()}
              
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
                          // WebSocket will handle the update asynchronously
                          // No need to reload messages
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
                {(() => {
                  const selectedMessage = messages.find((m) => m.id === selectedMessageId);
                  const hasText = selectedMessage?.content && selectedMessage.content.trim().length > 0;
                  
                  return (
                    <>
                      {hasText && (
                        <TouchableOpacity
                          style={styles.messageOption}
                          onPress={async () => {
                            if (selectedMessage?.content) {
                              await Clipboard.setStringAsync(selectedMessage.content);
                              showSuccess('Message copied to clipboard');
                            }
                            setMessageMenuVisible(false);
                          }}
                        >
                          <Ionicons name="copy-outline" size={22} color={colors.text} />
                          <Text style={[styles.messageOptionText, { color: colors.text }]}>Copy</Text>
                        </TouchableOpacity>
                      )}
                      
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
                    </>
                  );
                })()}

                {(() => {
                  const selectedMessage = messages.find((m) => m.id === selectedMessageId);
                  const isOwnMessage = selectedMessage?.sender.id === user?.id;
                  const hasMedia = !!selectedMessage?.media_url; // Any media (audio, video, image) prevents editing
                  const canEdit = isOwnMessage && !hasMedia; // Only allow editing text messages without media
                  
                  return isOwnMessage ? (
                    <>
                      {canEdit && (
                        <TouchableOpacity
                          style={styles.messageOption}
                          onPress={() => {
                            if (selectedMessage) {
                              setEditText(selectedMessage.content || '');
                              setEditingMessageId(selectedMessageId);
                            }
                            setMessageMenuVisible(false);
                          }}
                        >
                          <Ionicons name="pencil-outline" size={22} color={colors.text} />
                          <Text style={[styles.messageOptionText, { color: colors.text }]}>Edit Message</Text>
                        </TouchableOpacity>
                      )}
                      
                      <TouchableOpacity
                      style={styles.messageOption}
                      onPress={() => {
                        setMessageMenuVisible(false);
                        showConfirm(
                          'Are you sure you want to delete this message? This action cannot be undone.',
                          async () => {
                            try {
                              await apiClient.delete(`/conversations/${id}/messages/${selectedMessageId}/`);
                              setMessages((prev) =>
                                prev.map((m) =>
                                  m.id === selectedMessageId ? { ...m, is_deleted: true } : m
                                )
                              );
                              showSuccess('Message deleted');
                            } catch (error: any) {
                              console.error('Delete message error:', error);
                              const errorMessage = error.response?.data?.detail || 
                                                  error.response?.data?.message ||
                                                  'Failed to delete message';
                              showError(errorMessage);
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
                  ) : null;
                })()}
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
                      // WebSocket will handle the update asynchronously
                      // No need to reload messages
                      setReactionPickerVisible(null);
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
  dateSeparatorContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dateSeparatorText: {
    fontSize: 12,
    fontWeight: '600',
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
    flexDirection: 'column',
    backgroundColor: 'transparent',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  sendButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
  typingIndicatorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
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
  },
  deletedMessageBubble: {
    opacity: 0.7,
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
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 44,
    maxHeight: 120,
  },
  attachButtonInside: {
    padding: 8,
    paddingLeft: 12,
  },
  emojiButtonInside: {
    padding: 8,
    paddingRight: 12,
  },
    textInput: {
      flex: 1,
    minHeight: 28,
    maxHeight: 100,
    paddingHorizontal: 4,
    paddingVertical: 8,
    fontSize: 16,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  micButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
      borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
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
  audioPlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    minWidth: 200,
  },
  audioPlayButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
    justifyContent: 'center',
      alignItems: 'center',
    backgroundColor: 'rgba(200, 162, 95, 0.2)',
  },
  audioWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    height: 30,
      justifyContent: 'center',
    },
  audioWaveBar: {
    width: 2.5,
    borderRadius: 1.25,
    minHeight: 8,
  },
  audioProgressContainer: {
    marginTop: 6,
    marginBottom: 4,
  },
  audioProgressBar: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
    width: '100%',
  },
  audioProgressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  audioDuration: {
    fontSize: 12,
    marginTop: 4,
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
    flexDirection: 'column',
    backgroundColor: 'transparent',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  sendButtonGradient: {
    flex: 1,
    justifyContent: 'center',
      alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
  typingIndicatorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
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
  },
  deletedMessageBubble: {
    opacity: 0.7,
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
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 44,
    maxHeight: 120,
  },
  attachButtonInside: {
    padding: 8,
    paddingLeft: 12,
  },
  emojiButtonInside: {
    padding: 8,
    paddingRight: 12,
  },
  textInput: {
    flex: 1,
    minHeight: 28,
    maxHeight: 100,
    paddingHorizontal: 4,
    paddingVertical: 8,
    fontSize: 16,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  micButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
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
  audioPlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    minWidth: 200,
  },
  audioPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 162, 95, 0.2)',
  },
  audioWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    height: 30,
    justifyContent: 'center',
  },
  audioWaveBar: {
    width: 2.5,
    borderRadius: 1.25,
    minHeight: 8,
  },
  audioProgressContainer: {
    marginTop: 6,
    marginBottom: 4,
  },
  audioProgressBar: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
    width: '100%',
  },
  audioProgressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  audioDuration: {
    fontSize: 12,
    marginTop: 4,
  },
});
