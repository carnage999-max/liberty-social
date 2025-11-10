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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MessagesScreen() {
  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const { user } = useAuth();
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
  
  // Calculate FAB bottom position (account for tab bar + safe area)
  // Tab bar height: ~60px (icon + padding) + safe area bottom
  const tabBarHeight = 60;
  const fabBottom = (insets.bottom > 0 ? insets.bottom : 0) + tabBarHeight + 16; // 16px spacing above tab bar

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<PaginatedResponse<Conversation>>('/conversations/');
      setConversations(response.results);
      setNext(response.next);
    } catch (error) {
      showError('Failed to load conversations');
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
    
    // Auto-refresh conversations every 30 seconds
    const interval = setInterval(() => {
      loadConversations();
    }, 30000);

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
    // For direct messages, show the other participant's name
    const otherParticipant = conversation.participants.find(
      (p) => p.user.id !== conversation.created_by.id
    );
    if (otherParticipant) {
      const user = otherParticipant.user;
      if (user.first_name && user.last_name) {
        return `${user.first_name} ${user.last_name}`;
      }
      if (user.username) {
        return user.username;
      }
      return user.email.split('@')[0];
    }
    return 'Unknown User';
  };

  const getConversationAvatar = (conversation: Conversation) => {
    if (conversation.is_group) {
      return null; // Use default group icon
    }
    const otherParticipant = conversation.participants.find(
      (p) => p.user.id !== conversation.created_by.id
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
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const title = getConversationTitle(item);
    const avatarUrl = getConversationAvatar(item);
    const avatarSource = avatarUrl ? { uri: avatarUrl } : DEFAULT_AVATAR;
    const lastMessage = item.last_message;
    const lastMessageText = lastMessage?.content || 'No messages yet';
    const lastMessageTime = formatTime(item.last_message_at);

    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          {
            backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
            borderBottomColor: colors.border,
          },
        ]}
        onPress={() => {
          // Navigate to conversation detail
          router.push(`/(tabs)/messages/${item.id}`);
        }}
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
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.conversationTitle, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            {lastMessageTime && (
              <Text style={[styles.conversationTime, { color: colors.textSecondary }]}>
                {lastMessageTime}
              </Text>
            )}
          </View>
          <Text
            style={[styles.conversationPreview, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {lastMessageText}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
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
      width: 50,
      height: 50,
      borderRadius: 25,
      overflow: 'hidden',
    },
    avatar: {
      width: '100%',
      height: '100%',
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    conversationContent: {
      flex: 1,
      gap: 4,
    },
    conversationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    conversationTitle: {
      fontSize: 16,
      fontWeight: '600',
      flex: 1,
    },
    conversationTime: {
      fontSize: 12,
    },
    conversationPreview: {
      fontSize: 14,
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
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
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
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: fabBottom }]}
        onPress={handleNewConversation}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
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
    </View>
  );
}

