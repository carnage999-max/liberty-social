import React, { useState, useEffect, useCallback } from 'react';
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

export default function MessagesScreen() {
  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const { user } = useAuth();
  const { syncFromConversations } = useMessageBadge();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [profileBottomSheetVisible, setProfileBottomSheetVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | number | null>(null);
  
  // Calculate FAB bottom position (account for tab bar + safe area)
  // Tab bar height: ~60px (icon + padding) + safe area bottom
  const tabBarHeight = 60;
  const fabBottom = (insets.bottom > 0 ? insets.bottom : 0) + tabBarHeight + 40; // 40px spacing above tab bar

  const loadConversations = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await apiClient.get<PaginatedResponse<Conversation>>('/conversations/');
      
      // Sort by last_message_at (most recent first)
      const sorted = response.results.sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
      });
      
      setConversations(sorted);
      syncFromConversations(sorted);
      setNext(response.next);
    } catch (error) {
      if (!silent) showError('Failed to load conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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

  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.title) {
      return conversation.title;
    }
    if (conversation.is_group) {
      return 'Group Chat';
    }
    // For direct messages, show the OTHER participant's name (not created_by, but the person you're chatting with)
    const otherParticipant = conversation.participants.find(
      (p) => p.user.id !== user?.id
    );
    if (otherParticipant) {
      const participantUser = otherParticipant.user;
      if (participantUser.first_name && participantUser.last_name) {
        return `${participantUser.first_name} ${participantUser.last_name}`;
      }
      if (participantUser.username) {
        return participantUser.username;
      }
      return participantUser.email.split('@')[0];
    }
    return 'Unknown User';
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

  const renderConversation = ({ item }: { item: Conversation }) => {
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
    
    // Format last message preview
    let lastMessageText = 'No messages yet';
    if (lastMessage) {
      if (lastMessage.is_deleted) {
        lastMessageText = '🚫 This message was deleted';
      } else if (lastMessage.media_url) {
        lastMessageText = lastMessage.content 
          ? `📷 ${lastMessage.content}` 
          : '📷 Photo';
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

    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          {
            backgroundColor: hasUnread 
              ? (isDark ? 'rgba(200, 162, 95, 0.1)' : 'rgba(200, 162, 95, 0.05)')
              : (isDark ? colors.backgroundSecondary : '#FFFFFF'),
            borderBottomColor: colors.border,
          },
        ]}
        onPress={() => {
          router.push(`/(tabs)/messages/${item.id}`);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={avatarSource} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatar,
                styles.avatarPlaceholder,
                { backgroundColor: colors.primary },
              ]}
            >
              <Ionicons
                name={item.is_group ? 'people' : 'person'}
                size={24}
                color="#FFFFFF"
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
                { color: hasUnread ? colors.text : colors.textSecondary },
                hasUnread && styles.conversationPreviewUnread
              ]}
              numberOfLines={1}
            >
              {lastMessageText}
            </Text>
            {hasUnread && (
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
    },
    avatar: {
      width: '100%',
      height: '100%',
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
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
        title="Messages"
        showLogo={false}
        showProfileImage={false}
        showBackButton={true}
        onBackPress={() => router.back()}
      />
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
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}
          ListHeaderComponent={
            <View style={{ marginBottom: 16 }}>
              <ActiveFriends 
                maxUsers={8} 
                onUserClick={(user) => {
                  setSelectedUserId(user.id);
                  setProfileBottomSheetVisible(true);
                }}
              />
            </View>
          }
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
    </View>
  );
}

