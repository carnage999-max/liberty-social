import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { Image as ExpoImage } from 'expo-image';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';
import type { User } from '../../types';

interface FriendshipChange {
  id: number;
  friend: User;
  action: string;
  action_display: string;
  removal_reason?: string;
  removal_reason_display?: string;
  created_at: string;
}

interface FriendshipHistoryModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function FriendshipHistoryModal({
  visible,
  onClose,
}: FriendshipHistoryModalProps) {
  const { colors, isDark } = useTheme();
  const { showError } = useToast();
  const [newFriends, setNewFriends] = useState<FriendshipChange[]>([]);
  const [formerFriends, setFormerFriends] = useState<FriendshipChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      fetchFriendChanges();
    } else {
      // Reset state when modal closes
      setNewFriends([]);
      setFormerFriends([]);
      setError(null);
    }
  }, [visible]);

  const fetchFriendChanges = async () => {
    try {
      setLoading(true);
      setError(null);

      const [newFriendsData, formerFriendsData] = await Promise.all([
        apiClient.get<FriendshipChange[] | { results: FriendshipChange[] }>(
          '/auth/friendship-history/new_friends/'
        ),
        apiClient.get<FriendshipChange[] | { results: FriendshipChange[] }>(
          '/auth/friendship-history/former_friends/'
        ),
      ]);

      setNewFriends(
        Array.isArray(newFriendsData)
          ? newFriendsData
          : (newFriendsData as { results: FriendshipChange[] })?.results || []
      );
      setFormerFriends(
        Array.isArray(formerFriendsData)
          ? formerFriendsData
          : (formerFriendsData as { results: FriendshipChange[] })?.results || []
      );
    } catch (err) {
      console.error('Error fetching friendship history:', err);
      setError('Unable to load friend changes. Please try again.');
      showError('Failed to load friendship history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const getRemovalReasonText = (removalReason?: string) => {
    switch (removalReason) {
      case 'unfriended_by_user':
        return 'You unfriended';
      case 'unfriended_by_friend':
        return 'They unfriended you';
      case 'both_mutual':
        return 'Mutual unfriend';
      default:
        return 'Unfriended';
    }
  };

  const getRemovalReasonColor = (removalReason?: string) => {
    switch (removalReason) {
      case 'unfriended_by_user':
        return { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' };
      case 'unfriended_by_friend':
        return { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' };
      case 'both_mutual':
        return { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' };
      default:
        return { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' };
    }
  };

  const FriendChangeCard = ({
    change,
    isNew,
  }: {
    change: FriendshipChange;
    isNew: boolean;
  }) => {
    const friend = change.friend;
    const displayName =
      friend.username ||
      [friend.first_name, friend.last_name].filter(Boolean).join(' ') ||
      friend.email ||
      'User';

    const avatarUri = friend.profile_image_url
      ? resolveRemoteUrl(friend.profile_image_url)
      : null;
    const avatarSource = avatarUri ? { uri: avatarUri } : DEFAULT_AVATAR;
    const firstLetter = (displayName || 'U')[0]?.toUpperCase() || 'U';

    const removalReasonColor = !isNew && change.removal_reason
      ? getRemovalReasonColor(change.removal_reason)
      : null;

    return (
      <View
        style={[
          styles.friendChangeCard,
          {
            backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.friendChangeContent}>
          <View style={styles.friendChangeAvatar}>
            {avatarUri ? (
              <ExpoImage
                source={avatarSource}
                style={styles.avatarImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: colors.border },
                ]}
              >
                <Text
                  style={[styles.avatarText, { color: colors.textSecondary }]}
                >
                  {firstLetter}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.friendChangeInfo}>
            <Text style={[styles.friendChangeName, { color: colors.text }]}>
              {displayName}
            </Text>
            <Text
              style={[styles.friendChangeDate, { color: colors.textSecondary }]}
            >
              {isNew ? 'Added' : 'Removed'} {formatDate(change.created_at)}
            </Text>
          </View>
        </View>

        {!isNew && change.removal_reason && removalReasonColor && (
          <View
            style={[
              styles.removalReasonBadge,
              {
                backgroundColor: removalReasonColor.bg,
                borderColor: removalReasonColor.border,
              },
            ]}
          >
            <Text
              style={[styles.removalReasonText, { color: removalReasonColor.text }]}
            >
              {getRemovalReasonText(change.removal_reason)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
      paddingTop: 20,
      paddingBottom: 40,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
    },
    closeButton: {
      padding: 8,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    sectionIndicator: {
      width: 6,
      height: 24,
      borderRadius: 3,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
    },
    friendChangeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    friendChangeContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    friendChangeAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarPlaceholder: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 18,
      fontWeight: '600',
    },
    friendChangeInfo: {
      flex: 1,
    },
    friendChangeName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    friendChangeDate: {
      fontSize: 12,
    },
    removalReasonBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
    },
    removalReasonText: {
      fontSize: 11,
      fontWeight: '600',
    },
    emptyState: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '600',
      marginTop: 12,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 14,
      marginTop: 8,
      textAlign: 'center',
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    errorContainer: {
      padding: 40,
      alignItems: 'center',
    },
    errorText: {
      fontSize: 14,
      textAlign: 'center',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.modalContent,
            { backgroundColor: colors.background },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Friendship History
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={[styles.errorText, { color: colors.text }]}>
                  {error}
                </Text>
              </View>
            ) : newFriends.length === 0 && formerFriends.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="people-outline"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  No friend changes in the last 30 days
                </Text>
                <Text
                  style={[styles.emptySubtext, { color: colors.textSecondary }]}
                >
                  Come back here when you make new friends or unfriend someone.
                </Text>
              </View>
            ) : (
              <View>
                {newFriends.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <View
                        style={[
                          styles.sectionIndicator,
                          { backgroundColor: '#10B981' },
                        ]}
                      />
                      <Text
                        style={[styles.sectionTitle, { color: colors.text }]}
                      >
                        New Friends ({newFriends.length})
                      </Text>
                    </View>
                    {newFriends.map((change) => (
                      <FriendChangeCard key={change.id} change={change} isNew={true} />
                    ))}
                  </View>
                )}

                {formerFriends.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <View
                        style={[
                          styles.sectionIndicator,
                          { backgroundColor: '#EF4444' },
                        ]}
                      />
                      <Text
                        style={[styles.sectionTitle, { color: colors.text }]}
                      >
                        Former Friends ({formerFriends.length})
                      </Text>
                    </View>
                    {formerFriends.map((change) => (
                      <FriendChangeCard
                        key={change.id}
                        change={change}
                        isNew={false}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

