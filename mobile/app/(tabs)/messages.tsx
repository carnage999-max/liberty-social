import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { Conversation, PaginatedResponse, Friend } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';
import { SkeletonFriend } from '../../components/common/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useMessageBadge } from '../../contexts/MessageBadgeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ActiveFriends from '../../components/friends/ActiveFriends';
import UserProfileBottomSheet from '../../components/profile/UserProfileBottomSheet';
import { useTypingStatus } from '../../contexts/TypingStatusContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function MessagesScreen() {
  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const { user } = useAuth();
  const { syncFromConversations } = useMessageBadge();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [profileBottomSheetVisible, setProfileBottomSheetVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | number | null>(null);
  const { typingStatus } = useTypingStatus();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversations, setSelectedConversations] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedArchivedConversations, setSelectedArchivedConversations] = useState<Set<number>>(new Set());
  const [isArchivedSelectionMode, setIsArchivedSelectionMode] = useState(false);
  const [, forceUpdate] = useState(0);
  
  // Force re-render when typing status changes for faster updates
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate(prev => prev + 1);
    }, 500); // Update every 500ms for fast typing indicator
    return () => clearInterval(interval);
  }, []);
  
  // Calculate FAB bottom position (account for tab bar + safe area)
  // Tab bar height: ~60px (icon + padding) + safe area bottom
  const tabBarHeight = 60;
  const fabBottom = (insets.bottom > 0 ? insets.bottom : 0) + tabBarHeight + 40; // 40px spacing above tab bar

  const loadConversations = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      // Load active conversations (excludes archived by default)
      const response = await apiClient.get<PaginatedResponse<Conversation>>('/conversations/');
      
      // Load archived conversations separately
      const archivedResponse = await apiClient.get<PaginatedResponse<Conversation>>('/conversations/?include_archived=true');
      
      // Separate archived and non-archived conversations
      const archived: Conversation[] = [];
      const active: Conversation[] = [];
      
      // Process all conversations from archived response
      archivedResponse.results.forEach((conv) => {
        const participant = conv.participants.find((p) => p.user.id === user?.id);
        if (participant?.is_archived) {
          archived.push(conv);
        } else {
          active.push(conv);
        }
      });
      
      // Sort by last_message_at (most recent first)
      const sortedActive = active.sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
      });
      
      const sortedArchived = archived.sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
      });
      
      setConversations(sortedActive);
      setArchivedConversations(sortedArchived);
      syncFromConversations(sortedActive);
      setNext(response.next);
    } catch (error) {
      if (!silent) showError('Failed to load conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Helper function to get conversation title
  const getConversationTitle = useCallback((conversation: Conversation) => {
    if (conversation.title) {
      return conversation.title;
    }
    if (conversation.is_group) {
      return 'Group Chat';
    }
    // For direct messages, find the other participant
    const otherParticipant = conversation.participants.find(
      (p) => String(p.user.id) !== String(user?.id)
    );
    if (otherParticipant?.user) {
      const u = otherParticipant.user;
      if (u.first_name && u.last_name) {
        return `${u.first_name} ${u.last_name}`;
      }
      return u.username || u.email?.split('@')[0] || 'Unknown User';
    }
    return 'Unknown Conversation';
  }, [user]);

  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    
    const query = searchQuery.toLowerCase();
    return conversations.filter((conv) => {
      const title = getConversationTitle(conv).toLowerCase();
      const lastMessage = conv.last_message?.content?.toLowerCase() || '';
      return title.includes(query) || lastMessage.includes(query);
    });
  }, [conversations, searchQuery, getConversationTitle]);

  // Handle conversation selection
  const handleConversationLongPress = (conversationId: number) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedConversations(new Set([conversationId]));
    }
  };

  const handleConversationPress = (conversationId: number) => {
    if (isSelectionMode) {
      setSelectedConversations((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(conversationId)) {
          newSet.delete(conversationId);
        } else {
          newSet.add(conversationId);
        }
        if (newSet.size === 0) {
          setIsSelectionMode(false);
        }
        return newSet;
      });
    } else {
      router.push(`/(tabs)/messages/${conversationId}`);
    }
  };

  const handleClearSelection = () => {
    setSelectedConversations(new Set());
    setIsSelectionMode(false);
  };

  // Determine read/unread status of selected conversations
  const selectedConversationsStatus = useMemo(() => {
    if (selectedConversations.size === 0) {
      return { allRead: false, allUnread: false, mixed: false };
    }

    let readCount = 0;
    let unreadCount = 0;

    selectedConversations.forEach((convId) => {
      const conversation = conversations.find((c) => c.id === convId);
      if (!conversation) return;

      const userParticipant = conversation.participants.find(
        (p) => String(p.user.id) === String(user?.id)
      );
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
      const hasUnread = Boolean(
        latestActivityTs && (!lastReadTs || lastReadTs < latestActivityTs)
      );

      if (hasUnread) {
        unreadCount++;
      } else {
        readCount++;
      }
    });

    const total = readCount + unreadCount;
    if (total === 0) {
      return { allRead: false, allUnread: false, mixed: false };
    }

    return {
      allRead: readCount > 0 && unreadCount === 0,
      allUnread: unreadCount > 0 && readCount === 0,
      mixed: readCount > 0 && unreadCount > 0,
    };
  }, [selectedConversations, conversations, user]);

  // Handle bulk actions
  const handleMarkRead = async () => {
    try {
      const promises = Array.from(selectedConversations).map((convId) =>
        apiClient.post(`/conversations/${convId}/mark-read/`)
      );
      await Promise.all(promises);
      showSuccess(`${selectedConversations.size} conversation(s) marked as read`);
      handleClearSelection();
      loadConversations(true);
    } catch (error) {
      showError('Failed to mark conversations as read');
    }
  };

  const handleMarkUnread = async () => {
    try {
      const promises = Array.from(selectedConversations).map((convId) =>
        apiClient.post(`/conversations/${convId}/mark-unread/`)
      );
      await Promise.all(promises);
      showSuccess(`${selectedConversations.size} conversation(s) marked as unread`);
      handleClearSelection();
      loadConversations(true);
    } catch (error: any) {
      console.error('Mark unread error:', error);
      showError('Failed to mark conversations as unread');
    }
  };

  const handleClearChats = async () => {
    try {
      // Clear messages in selected conversations by deleting all messages
      // Handle pagination by fetching all pages
      const promises = Array.from(selectedConversations).map(async (convId) => {
        let allMessages: any[] = [];
        let nextUrl: string | null = `/conversations/${convId}/messages/`;
        
        // Fetch all messages (handle pagination)
        while (nextUrl) {
          const response = await apiClient.get(nextUrl);
          if (response.results) {
            allMessages = [...allMessages, ...response.results];
          }
          nextUrl = response.next || null;
        }
        
        // Delete all messages
        if (allMessages.length > 0) {
          const deletePromises = allMessages.map((msg: any) =>
            apiClient.delete(`/conversations/${convId}/messages/${msg.id}/`)
          );
          await Promise.all(deletePromises);
        }
      });
      await Promise.all(promises);
      showSuccess(`${selectedConversations.size} chat(s) cleared`);
      handleClearSelection();
      loadConversations(true);
    } catch (error: any) {
      console.error('Clear chat error:', error);
      showError('Failed to clear chats');
    }
  };

  const handleArchiveChats = async () => {
    try {
      const promises = Array.from(selectedConversations).map((convId) =>
        apiClient.post(`/conversations/${convId}/archive/`)
      );
      await Promise.all(promises);
      showSuccess(`${selectedConversations.size} conversation(s) archived`);
      handleClearSelection();
      loadConversations(true);
    } catch (error: any) {
      console.error('Archive error:', error);
      showError('Failed to archive conversations');
    }
  };

  const handleUnarchiveChats = async () => {
    try {
      const conversationIds = Array.from(selectedArchivedConversations);
      console.log('Unarchiving conversations:', conversationIds);
      
      const promises = conversationIds.map((convId) => {
        const conversationId = Number(convId); // Ensure it's a number
        console.log(`Unarchiving conversation ID: ${conversationId} (type: ${typeof conversationId})`);
        return apiClient.post(`/conversations/${conversationId}/unarchive/`);
      });
      
      await Promise.all(promises);
      showSuccess(`${selectedArchivedConversations.size} conversation(s) unarchived`);
      setSelectedArchivedConversations(new Set());
      setIsArchivedSelectionMode(false);
      loadConversations(true);
    } catch (error: any) {
      console.error('Unarchive error:', error);
      console.error('Error details:', error.response?.data);
      console.error('Selected conversations:', Array.from(selectedArchivedConversations));
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Failed to unarchive conversations';
      showError(errorMessage);
    }
  };

  const handleArchivedConversationLongPress = (conversationId: number) => {
    console.log('Archived conversation long press:', conversationId, typeof conversationId);
    setIsArchivedSelectionMode(true);
    setSelectedArchivedConversations(new Set([conversationId]));
  };

  const handleArchivedConversationPress = (conversationId: number) => {
    console.log('Archived conversation press:', conversationId, typeof conversationId, 'isSelectionMode:', isArchivedSelectionMode);
    if (isArchivedSelectionMode) {
      setSelectedArchivedConversations((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(conversationId)) {
          newSet.delete(conversationId);
        } else {
          newSet.add(conversationId);
        }
        if (newSet.size === 0) {
          setIsArchivedSelectionMode(false);
        }
        console.log('Updated selected archived conversations:', Array.from(newSet));
        return newSet;
      });
    } else {
      router.push(`/(tabs)/messages/${conversationId}`);
    }
  };

  const handleClearArchivedSelection = () => {
    setSelectedArchivedConversations(new Set());
    setIsArchivedSelectionMode(false);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
  loadConversations();
  }, []);

  useEffect(() => {
    loadConversations();
    
    // Auto-refresh conversations every 5 seconds (silent updates)
    const interval = setInterval(() => {
      loadConversations(true);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadFriends = async () => {
    try {
      setLoadingFriends(true);
      const response = await apiClient.get<PaginatedResponse<Friend>>('/auth/friends/');
      setFriends(response.results);
    } catch (error) {
      showError('Failed to load friends');
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleNewConversation = () => {
    setShowNewConversation(true);
    loadFriends();
  };

  const handleStartConversation = async (friendId: string | number) => {
    try {
      setCreatingConversation(true);
      // Ensure friendId is a string (UUID)
      const friendIdStr = String(friendId);
      
      // Check if conversation already exists
      const existingConversations = await apiClient.get<PaginatedResponse<Conversation>>('/conversations/');
      const existing = existingConversations.results.find((conv) => {
        if (conv.is_group) return false;
        return conv.participants.some((p) => String(p.user.id) === friendIdStr);
      });

      if (existing) {
        setShowNewConversation(false);
        router.push(`/(tabs)/messages/${existing.id}`);
        return;
      }

      // Create new conversation
      const conversation = await apiClient.post<Conversation>('/conversations/', {
        is_group: false,
        participant_ids: [friendIdStr],
      });

      setShowNewConversation(false);
      showSuccess('Conversation started');
      router.push(`/(tabs)/messages/${conversation.id}`);
      loadConversations();
    } catch (error: any) {
      console.error('Failed to start conversation:', error);
      let errorMessage = 'Failed to start conversation';
      if (error?.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.non_field_errors) {
          errorMessage = Array.isArray(error.response.data.non_field_errors)
            ? error.response.data.non_field_errors[0]
            : error.response.data.non_field_errors;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      showError(errorMessage);
    } finally {
      setCreatingConversation(false);
    }
  };


  const getConversationAvatar = (conversation: Conversation) => {
    if (conversation.is_group) {
      return null; // Use default group icon
    }
    // Get the OTHER participant (the person you're chatting with)
    const otherParticipant = conversation.participants.find(
      (p) => p.user.id !== user?.id
    );
    if (otherParticipant?.user.profile_image_url) {
      return resolveRemoteUrl(otherParticipant.user.profile_image_url);
    }
    return null;
  };

  const formatTime = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = now.getTime() - date.getTime();
    const daysDiff = Math.floor((today.getTime() - messageDate.getTime()) / 86400000);

    // Today: show time (e.g., "2:30 PM")
    if (daysDiff === 0) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    }
    
    // Yesterday
    if (daysDiff === 1) {
      return 'Yesterday';
    }
    
    // This week: show day name (e.g., "Monday")
    if (daysDiff < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    }
    
    // Older: show date (e.g., "12/25/2024")
    return date.toLocaleDateString('en-US', { 
      month: 'numeric', 
      day: 'numeric',
      year: daysDiff > 365 ? 'numeric' : undefined
    });
  };

  const renderConversation = ({ item }: { item: Conversation }, isArchivedModal = false) => {
    const title = getConversationTitle(item);
    const avatarUrl = getConversationAvatar(item);
    const avatarSource = avatarUrl ? { uri: avatarUrl } : DEFAULT_AVATAR;
    const lastMessage = item.last_message;
    const userParticipant = item.participants.find(
      (p) => String(p.user.id) === String(user?.id)
    );
    const lastReadTs = userParticipant?.last_read_at
      ? new Date(userParticipant.last_read_at).getTime()
      : null;
    const lastMessageTs = lastMessage?.created_at
      ? new Date(lastMessage.created_at).getTime()
      : null;
    const lastMessageAtTs = item.last_message_at
      ? new Date(item.last_message_at).getTime()
      : null;
    const latestActivityTs = lastMessageTs ?? lastMessageAtTs;
    const hasUnread = Boolean(
      latestActivityTs && (!lastReadTs || lastReadTs < latestActivityTs)
    );
    
    // Check if someone is typing in this conversation - use fresh data from context
    const conversationTyping = typingStatus[item.id] || [];
    // Filter out current user and check timestamps (only show if typing within last 5 seconds)
    const now = Date.now();
    const typingUsers = conversationTyping.filter(u => 
      String(u.userId) !== String(user?.id) && (now - u.timestamp) < 5000
    );
    const isTyping = typingUsers.length > 0;
    
    // Format last message preview
    let lastMessageText = 'No messages yet';
    if (isTyping) {
      // Show typing indicator
      if (typingUsers.length === 1) {
        const typingUser = typingUsers[0];
        const displayName = item.is_group 
          ? (typingUser.username || 'Someone')
          : '';
        lastMessageText = item.is_group 
          ? `${displayName} is typing...`
          : 'typing...';
      } else if (typingUsers.length === 2) {
        lastMessageText = `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`;
      } else {
        lastMessageText = `${typingUsers[0].username} and ${typingUsers.length - 1} others are typing...`;
      }
    } else if (lastMessage) {
      if (lastMessage.is_deleted) {
        lastMessageText = '🚫 This message was deleted';
      } else if (lastMessage.media_url) {
        // Detect media type
        const mediaUrl = lastMessage.media_url;
        const isVideo = /\.(mp4|mov|m4v|webm|mkv|avi|3gp)(\?.*)?$/i.test(mediaUrl);
        const isAudio = /\.(m4a|mp3|wav|aac|ogg|flac|wma)(\?.*)?$/i.test(mediaUrl);
        
        if (isAudio) {
          // Extract duration from content if available (format: "[duration:MM:SS]")
          let durationText = '';
          if (lastMessage.content && lastMessage.content.includes('[duration:')) {
            const durationMatch = lastMessage.content.match(/\[duration:(\d+:\d+)\]/);
            if (durationMatch) {
              durationText = ` (${durationMatch[1]})`;
            }
          }
          lastMessageText = lastMessage.content && !lastMessage.content.includes('[duration:')
            ? `🎤 ${lastMessage.content.replace(/\[duration:\d+:\d+\]/g, '').trim()}${durationText}` 
            : `🎤 Voice message${durationText}`;
        } else if (isVideo) {
          lastMessageText = lastMessage.content 
            ? `🎥 ${lastMessage.content}` 
            : '🎥 Video';
        } else {
          lastMessageText = lastMessage.content 
            ? `📷 ${lastMessage.content}` 
            : '📷 Photo';
        }
      } else {
        lastMessageText = lastMessage.content || 'No messages yet';
      }
      
      // Add sender name for group chats
      if (item.is_group && lastMessage.sender) {
        const senderName = lastMessage.sender.id === user?.id 
          ? 'You' 
          : (lastMessage.sender.first_name || lastMessage.sender.username || 'Someone');
        lastMessageText = `${senderName}: ${lastMessageText}`;
      } else if (lastMessage.sender?.id === user?.id && !item.is_group) {
        // Add "You: " prefix for your own messages in DMs
        lastMessageText = `You: ${lastMessageText}`;
      }
    }
    
    const lastMessageTime = formatTime(item.last_message_at);

    // Use archived selection state if in archived modal
    const currentSelectionMode = isArchivedModal ? isArchivedSelectionMode : isSelectionMode;
    const currentSelectedSet = isArchivedModal ? selectedArchivedConversations : selectedConversations;
    const handleLongPress = isArchivedModal ? handleArchivedConversationLongPress : handleConversationLongPress;
    const handlePress = isArchivedModal ? handleArchivedConversationPress : handleConversationPress;
    
    const isSelected = currentSelectedSet.has(item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          {
            backgroundColor: isSelected
              ? (isDark ? 'rgba(200, 162, 95, 0.2)' : 'rgba(200, 162, 95, 0.15)')
              : hasUnread 
              ? (isDark ? 'rgba(200, 162, 95, 0.1)' : 'rgba(200, 162, 95, 0.05)')
              : (isDark ? colors.backgroundSecondary : '#FFFFFF'),
            borderBottomColor: colors.border,
          },
        ]}
        onPress={() => handlePress(item.id)}
        onLongPress={() => handleLongPress(item.id)}
        activeOpacity={0.7}
      >
        {/* Selection Checkbox */}
        {currentSelectionMode && (
          <View style={styles.checkboxContainer}>
            <View style={[
              styles.checkbox,
              {
                backgroundColor: isSelected ? '#C8A25F' : 'transparent',
                borderColor: isSelected ? '#C8A25F' : colors.border,
              }
            ]}>
              {isSelected && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
          </View>
        )}
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={avatarSource} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatar,
                styles.avatarPlaceholder,
                {
                  backgroundColor: '#192A4A',
                  borderWidth: 2,
                  borderColor: '#C8A25F',
                  borderRadius: 28,
                },
              ]}
            >
              <Ionicons
                name={item.is_group ? 'people' : 'person'}
                size={24}
                color="#C8A25F"
              />
            </View>
          )}
          {hasUnread && (
            <View style={[styles.onlineIndicator, { backgroundColor: '#C8A25F' }]} />
          )}
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text 
              style={[
                styles.conversationTitle, 
                { color: colors.text },
                hasUnread && styles.conversationTitleUnread
              ]} 
              numberOfLines={1}
            >
              {title}
            </Text>
            {lastMessageTime && (
              <Text 
                style={[
                  styles.conversationTime, 
                  { color: hasUnread ? '#C8A25F' : colors.textSecondary },
                  hasUnread && styles.conversationTimeUnread
                ]}
              >
                {lastMessageTime}
              </Text>
            )}
          </View>
          <View style={styles.conversationFooter}>
            <Text
              style={[
                styles.conversationPreview, 
                { 
                  color: isTyping 
                    ? '#C8A25F' 
                    : (hasUnread ? colors.text : colors.textSecondary),
                  fontStyle: isTyping ? 'italic' : 'normal',
                },
                hasUnread && !isTyping && styles.conversationPreviewUnread
              ]}
              numberOfLines={1}
            >
              {lastMessageText}
            </Text>
            {!currentSelectionMode && hasUnread && !isTyping && (
              <View style={[styles.unreadDot, { backgroundColor: '#C8A25F' }]} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    conversationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 12,
    },
    avatarContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: colors.backgroundSecondary,
    },
    avatar: {
      width: '100%',
      height: '100%',
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 28,
    },
    onlineIndicator: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.background,
    },
    conversationContent: {
      flex: 1,
      gap: 6,
    },
    conversationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    conversationTitle: {
      fontSize: 17,
      fontWeight: '600',
      flex: 1,
    },
    conversationTitleUnread: {
      fontWeight: '700',
    },
    conversationTime: {
      fontSize: 13,
    },
    conversationTimeUnread: {
      fontWeight: '600',
    },
    conversationFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    conversationPreview: {
      fontSize: 15,
      flex: 1,
    },
    conversationPreviewUnread: {
      fontWeight: '500',
    },
    unreadDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
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
    fab: {
      position: 'absolute',
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#192A4A',
      borderWidth: 2,
      borderColor: '#C8A25F',
      shadowColor: '#C8A25F',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    modalContainer: {
      flex: 1,
    },
    friendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 12,
    },
    friendAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
    },
    friendName: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 8,
      borderRadius: 20,
      gap: 8,
    },
    searchIcon: {
      marginRight: 4,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      paddingVertical: 4,
    },
    clearSearchButton: {
      padding: 4,
    },
    actionBar: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      maxHeight: 60,
    },
    actionBarContent: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 16,
      alignItems: 'center',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minWidth: 100,
    },
    actionIconButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 4,
    },
    actionIconGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(0, 0, 0, 0.2)',
    },
    dangerIconButton: {
      backgroundColor: '#FF6B6B',
    },
    dangerIconBackground: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      backgroundColor: '#FF6B6B',
      shadowColor: '#FF6B6B',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 3,
      elevation: 4,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '500',
    },
    checkboxContainer: {
      width: 24,
      height: 24,
      marginRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    archivedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 12,
    },
    iconButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 4,
    },
    iconGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(0, 0, 0, 0.2)',
    },
    archivedRowText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '500',
    },
    archivedCount: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 4,
    },
    archivedCountGradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(0, 0, 0, 0.2)',
    },
    archivedCountText: {
      color: '#192A4A',
      fontSize: 12,
      fontWeight: '700',
    },
  });

  const renderFriend = (friend: Friend) => {
    const friendUser = friend.friend;
    const displayName = friendUser.first_name && friendUser.last_name
      ? `${friendUser.first_name} ${friendUser.last_name}`
      : friendUser.username || friendUser.email.split('@')[0];
    const avatarUrl = friendUser.profile_image_url
      ? resolveRemoteUrl(friendUser.profile_image_url)
      : null;
    const avatarSource = avatarUrl ? { uri: avatarUrl } : DEFAULT_AVATAR;

    return (
      <TouchableOpacity
        key={friend.id}
        style={[
          styles.friendItem,
          {
            backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
            borderBottomColor: colors.border,
          },
        ]}
        onPress={() => handleStartConversation(friend.friend_id || friendUser.id)}
        disabled={creatingConversation}
      >
        <Image source={avatarSource} style={styles.friendAvatar} />
        <Text style={[styles.friendName, { color: colors.text }]} numberOfLines={1}>
          {displayName}
        </Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <AppNavbar
        title={isSelectionMode ? `${selectedConversations.size} selected` : "Messages"}
        showLogo={false}
        showProfileImage={false}
        showBackButton={!isSelectionMode}
        showMessageIcon={false}
        showSearchIcon={false}
        onBackPress={() => {
          if (isSelectionMode) {
            handleClearSelection();
          } else {
            router.back();
          }
        }}
        customRightButton={
          isSelectionMode ? (
            <TouchableOpacity onPress={handleClearSelection} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          ) : null
        }
      />
      
      {/* Search Bar */}
      {!isSelectionMode && (
        <View style={[styles.searchContainer, { backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5' }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search conversations..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Action Bar */}
      {isSelectionMode && selectedConversations.size > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={[styles.actionBar, { backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF', borderBottomColor: colors.border }]}
          contentContainerStyle={styles.actionBarContent}
        >
          {/* Show Mark Read only if all are unread OR mixed */}
          {(selectedConversationsStatus.allUnread || selectedConversationsStatus.mixed) && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleMarkRead}
            >
              <View style={styles.actionIconButton}>
                <LinearGradient
                  colors={['#a8862a', '#d7b756', '#a8862a']}
                  style={styles.actionIconGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="checkmark-done" size={18} color="#192A4A" />
                </LinearGradient>
              </View>
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Mark Read</Text>
            </TouchableOpacity>
          )}
          {/* Show Mark Unread only if all are read OR mixed */}
          {(selectedConversationsStatus.allRead || selectedConversationsStatus.mixed) && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleMarkUnread}
            >
              <View style={styles.actionIconButton}>
                <LinearGradient
                  colors={['#a8862a', '#d7b756', '#a8862a']}
                  style={styles.actionIconGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="mail-unread" size={18} color="#192A4A" />
                </LinearGradient>
              </View>
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Mark Unread</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleArchiveChats}
          >
            <View style={styles.actionIconButton}>
              <LinearGradient
                colors={['#a8862a', '#d7b756', '#a8862a']}
                style={styles.actionIconGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="archive" size={18} color="#192A4A" />
              </LinearGradient>
            </View>
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Archive</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleClearChats}
          >
            <View style={[styles.actionIconButton, styles.dangerIconButton]}>
              <View style={styles.dangerIconBackground}>
                <Ionicons name="trash" size={18} color="#FFFFFF" />
              </View>
            </View>
            <Text style={[styles.actionButtonText, { color: '#FF6B6B' }]}>Clear</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
      
      {/* Active Friends and Archived Chats - Show even when no conversations */}
      {!loading && searchQuery.length === 0 && !isSelectionMode && (
        <View style={{ marginBottom: 16 }}>
          <ActiveFriends 
            maxUsers={8} 
            onUserClick={(user) => {
              setSelectedUserId(user.id);
              setProfileBottomSheetVisible(true);
            }}
          />
          {/* Archived Chats Row */}
          {archivedConversations.length > 0 && (
            <TouchableOpacity
              style={[
                styles.archivedRow,
                {
                  backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
                  borderBottomColor: colors.border,
                }
              ]}
              onPress={() => setShowArchivedModal(true)}
            >
              <View style={styles.iconButton}>
                <LinearGradient
                  colors={['#a8862a', '#d7b756', '#a8862a']}
                  style={styles.iconGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="archive" size={18} color="#192A4A" />
                </LinearGradient>
              </View>
              <Text style={[styles.archivedRowText, { color: colors.text }]}>
                Archived Chats
              </Text>
              <View style={styles.archivedCount}>
                <LinearGradient
                  colors={['#a8862a', '#d7b756', '#a8862a']}
                  style={styles.archivedCountGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.archivedCountText}>{archivedConversations.length}</Text>
                </LinearGradient>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, padding: 16 }}>
          {[1, 2, 3].map((i) => (
            <SkeletonFriend key={i} />
          ))}
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No conversations yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: 14 }]}>
            Start a conversation with a friend
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ 
            flexGrow: 1, 
            paddingBottom: tabBarHeight + (insets.bottom > 0 ? insets.bottom : 0) + 20 
          }}
          removeClippedSubviews={true}
          windowSize={10}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          updateCellsBatchingPeriod={50}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: fabBottom }]}
        onPress={handleNewConversation}
      >
        <Ionicons name="add" size={28} color="#C8A25F" />
      </TouchableOpacity>

      {/* New Conversation Modal */}
      <Modal
        visible={showNewConversation}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowNewConversation(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <AppNavbar
            title="New Conversation"
            showLogo={false}
            showProfileImage={false}
            showMessageIcon={false}
            showBackButton={true}
            onBackPress={() => setShowNewConversation(false)}
          />
          {loadingFriends ? (
            <View style={{ flex: 1, padding: 16 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonFriend key={i} />
              ))}
            </View>
          ) : friends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No friends yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: 14 }]}>
                Add friends to start conversations
              </Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }}>
              {friends.map((friend) => renderFriend(friend))}
            </ScrollView>
          )}
        </View>
      </Modal>

      <UserProfileBottomSheet
        visible={profileBottomSheetVisible}
        userId={selectedUserId}
        onClose={() => {
          setProfileBottomSheetVisible(false);
          setSelectedUserId(null);
        }}
      />

      {/* Archived Chats Modal */}
      <Modal
        visible={showArchivedModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowArchivedModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <AppNavbar
            title={isArchivedSelectionMode ? `${selectedArchivedConversations.size} selected` : "Archived Chats"}
            showLogo={false}
            showProfileImage={false}
            showMessageIcon={false}
            showBackButton={!isArchivedSelectionMode}
            onBackPress={() => {
              if (isArchivedSelectionMode) {
                handleClearArchivedSelection();
              } else {
                setShowArchivedModal(false);
              }
            }}
            customRightButton={
              isArchivedSelectionMode ? (
                <TouchableOpacity onPress={handleClearArchivedSelection} style={{ padding: 8 }}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              ) : null
            }
          />
          {archivedConversations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="archive-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No archived conversations
              </Text>
            </View>
          ) : (
            <>
              {/* Action Bar for Archived Modal */}
              {isArchivedSelectionMode && selectedArchivedConversations.size > 0 && (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={[styles.actionBar, { backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF', borderBottomColor: colors.border }]}
                  contentContainerStyle={styles.actionBarContent}
                >
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleUnarchiveChats}
                  >
                    <View style={styles.iconButton}>
                      <LinearGradient
                        colors={['#a8862a', '#d7b756', '#a8862a']}
                        style={styles.iconGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Ionicons name="archive-outline" size={18} color="#192A4A" />
                      </LinearGradient>
                    </View>
                    <Text style={[styles.actionButtonText, { color: colors.text }]}>Unarchive</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
              <FlatList
                data={archivedConversations}
                renderItem={({ item }) => renderConversation({ item }, true)}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ 
                  flexGrow: 1, 
                  paddingBottom: tabBarHeight + (insets.bottom > 0 ? insets.bottom : 0) + 20 
                }}
              />
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

