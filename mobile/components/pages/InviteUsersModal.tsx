import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { Friend, PaginatedResponse } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';

interface InviteUsersModalProps {
  visible: boolean;
  pageId: number;
  onClose: () => void;
  onInvitesSent?: () => void;
}

export default function InviteUsersModal({
  visible,
  pageId,
  onClose,
  onInvitesSent,
}: InviteUsersModalProps) {
  const { colors, isDark } = useTheme();
  const { accessToken } = useAuth();
  const { showSuccess, showError } = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageFollowers, setPageFollowers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible && pageId) {
      // Reset state
      setFriends([]);
      setFilteredFriends([]);
      setSearchQuery('');
      setSelectedFriends(new Set());
      // Load page followers first, then friends
      loadPageFollowers().then(() => {
        loadFriends();
      });
    } else {
      setSearchQuery('');
      setSelectedFriends(new Set());
    }
  }, [visible, pageId]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = friends.filter((friend) => {
        const friendData = (friend as any).friend || friend;
        const username = friendData.username?.toLowerCase() || '';
        const email = friendData.email?.toLowerCase() || '';
        const firstName = friendData.first_name?.toLowerCase() || '';
        const lastName = friendData.last_name?.toLowerCase() || '';
        return (
          username.includes(query) ||
          email.includes(query) ||
          firstName.includes(query) ||
          lastName.includes(query)
        );
      });
      setFilteredFriends(filtered);
    } else {
      setFilteredFriends(friends);
    }
  }, [searchQuery, friends]);

  const loadFriends = async () => {
    try {
      setLoading(true);
      
      const response = await apiClient.get<PaginatedResponse<Friend>>('/auth/friends/?page_size=100');
      console.log('Friends API response:', response);
      
      let friendsList: Friend[] = [];
      
      // Handle paginated response - friends are wrapped in "friend" field
      if (response.results && Array.isArray(response.results)) {
        friendsList = response.results.map((item: any) => {
          console.log('Processing friend item:', item);
          // FriendsSerializer wraps friend data in a "friend" field
          return item.friend;
        }).filter(Boolean);
      } else if (Array.isArray(response)) {
        friendsList = response.map((item: any) => {
          console.log('Processing friend item:', item);
          return item.friend || item;
        }).filter(Boolean);
      }
      
      console.log('Extracted friends list:', friendsList.length, friendsList.map(f => ({ id: f.id, username: (f as any).username })));
      
      // Filter out friends who already follow the page
      const currentFollowers = pageFollowers.size > 0 ? pageFollowers : new Set<string>();
      const filtered = friendsList.filter((f) => {
        const friendId = String(f.id || (f as any).id);
        const shouldInclude = friendId && !currentFollowers.has(friendId);
        if (!shouldInclude) {
          console.log('Filtering out friend:', friendId, 'because they follow the page');
        }
        return shouldInclude;
      });
      
      console.log('Final filtered friends:', filtered.length, 'Page followers:', currentFollowers.size);
      
      setFriends(filtered);
      setFilteredFriends(filtered);
    } catch (error) {
      console.error('Failed to load friends:', error);
      showError('Failed to load friends list');
    } finally {
      setLoading(false);
    }
  };

  const loadPageFollowers = async () => {
    try {
      if (!pageId) return new Set<string>();
      const response = await apiClient.get(`/pages/${pageId}/followers/`);
      
      let followerIds: Set<string> = new Set();
      if (Array.isArray(response)) {
        followerIds = new Set(
          response
            .map((item: any) => {
              // Handle different response formats
              const userId = item.user?.id || item.user_id || item.user || item.id;
              return userId ? String(userId) : null;
            })
            .filter(Boolean)
        );
      } else if (response.results && Array.isArray(response.results)) {
        followerIds = new Set(
          response.results
            .map((item: any) => {
              const userId = item.user?.id || item.user_id || item.user || item.id;
              return userId ? String(userId) : null;
            })
            .filter(Boolean)
        );
      }
      
      setPageFollowers(followerIds);
      return followerIds;
    } catch (error) {
      console.error('Failed to load page followers:', error);
      setPageFollowers(new Set<string>());
      return new Set<string>();
    }
  };

  const toggleFriend = (friendId: string | number) => {
    const newSelected = new Set(selectedFriends);
    const friendIdStr = String(friendId);
    if (newSelected.has(friendIdStr)) {
      newSelected.delete(friendIdStr);
    } else {
      newSelected.add(friendIdStr);
    }
    setSelectedFriends(newSelected);
  };

  const selectAllFriends = () => {
    const allFriendIds = new Set(filteredFriends.map((f) => {
      const friendData = (f as any).friend || f;
      return String(friendData.id);
    }));
    setSelectedFriends(allFriendIds);
  };

  const deselectAllFriends = () => {
    setSelectedFriends(new Set());
  };

  const sendInvites = async () => {
    if (selectedFriends.size === 0) {
      showError('Please select at least one friend');
      return;
    }

    try {
      setSending(true);
      const friendIds = Array.from(selectedFriends).map((id) => {
        const parsed = parseInt(id, 10);
        return isNaN(parsed) ? id : parsed;
      });

      const response = await apiClient.post(`/pages/${pageId}/send-invites/`, {
        friend_ids: friendIds,
      });

      // Filter out "already invited" or "already following" errors silently
      const significantErrors = response.errors?.filter((err: any) => {
        const errorMsg = err.error?.toLowerCase() || '';
        return !errorMsg.includes('already') && !errorMsg.includes('invite already sent');
      }) || [];

      const totalSent = response.total_sent || response.invites_sent?.length || 0;
      
      if (totalSent > 0) {
        showSuccess(
          `Invites sent to ${totalSent} friend${totalSent > 1 ? 's' : ''}!`
        );
        setSelectedFriends(new Set());
        onInvitesSent?.();
        onClose();
      } else if (significantErrors.length > 0) {
        // Only show errors if they're not "already invited" type
        const errorCount = significantErrors.length;
        showError(`${errorCount} invite${errorCount > 1 ? 's' : ''} could not be sent`);
      } else if (response.errors && response.errors.length > 0) {
        // All errors were "already invited" - show success message
        showSuccess('All selected friends have already been invited or are already following this page.');
        setSelectedFriends(new Set());
        onClose();
      }
    } catch (error: any) {
      console.error('Failed to send invites:', error);
      showError(error?.response?.data?.detail || 'Failed to send invites');
    } finally {
      setSending(false);
    }
  };

  const renderFriend = ({ item }: { item: Friend }) => {
    // Friends are already extracted in loadFriends, so item is already the friend object
    const friendId = String(item.id || (item as any).id);
    const isSelected = selectedFriends.has(friendId);
    const displayName =
      (item as any).username ||
      `${(item as any).first_name || ''} ${(item as any).last_name || ''}`.trim() ||
      (item as any).email ||
      'Friend';

    const avatarUri = (item as any).profile_image_url
      ? resolveRemoteUrl((item as any).profile_image_url)
      : null;
    const avatarSource = avatarUri ? { uri: avatarUri } : DEFAULT_AVATAR;

    return (
      <TouchableOpacity
        style={[
          styles.friendItem,
          {
            backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
            borderColor: isSelected ? '#C8A25F' : colors.border,
          },
        ]}
        onPress={() => toggleFriend(item.id || (item as any).id)}
        activeOpacity={0.7}
      >
        <View style={styles.friendCheckbox}>
          {isSelected && <Ionicons name="checkmark" size={20} color="#C8A25F" />}
        </View>
        <Image source={avatarSource} style={styles.friendAvatar} />
        <View style={styles.friendInfo}>
          <Text style={[styles.friendName, { color: colors.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          {(item as any).bio && (
            <Text style={[styles.friendBio, { color: colors.textSecondary }]} numberOfLines={1}>
              {(item as any).bio}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const allSelected = filteredFriends.length > 0 && 
    filteredFriends.every((f) => {
      // Friends are already extracted, so f is the friend object
      const friendId = String(f.id || (f as any).id);
      return selectedFriends.has(friendId);
    });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF' }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Invite Friends to Follow</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: '#000000' }]}
              placeholder="Search friends..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Select All */}
          <TouchableOpacity
            style={[
              styles.selectAllButton,
              {
                backgroundColor: isDark ? colors.background : '#F8F9FF',
                borderColor: '#C8A25F',
              },
            ]}
            onPress={allSelected ? deselectAllFriends : selectAllFriends}
          >
            <View style={[styles.checkbox, allSelected && styles.checkboxSelected]}>
              {allSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
            </View>
            <Text style={[styles.selectAllText, { color: colors.text }]}>
              {allSelected ? 'Deselect All' : 'Select All'}
            </Text>
            <Text style={[styles.selectCount, { color: colors.textSecondary }]}>
              {selectedFriends.size} of {filteredFriends.length} selected
            </Text>
          </TouchableOpacity>

          {/* Friends List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#C8A25F" />
            </View>
          ) : filteredFriends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery ? 'No friends found' : friends.length === 0 ? 'No friends to invite' : 'All your friends already follow this page'}
              </Text>
              {friends.length > 0 && !searchQuery && (
                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  You have {friends.length} friend{friends.length !== 1 ? 's' : ''}, but they all already follow this page.
                </Text>
              )}
            </View>
          ) : (
            <>
              <Text style={[styles.debugText, { color: colors.textSecondary }]}>
                Showing {filteredFriends.length} friend{filteredFriends.length !== 1 ? 's' : ''}
              </Text>
              <FlatList
                data={filteredFriends}
                renderItem={renderFriend}
                keyExtractor={(item) => {
                  const id = String(item.id || (item as any).id);
                  console.log('FlatList keyExtractor for item:', id);
                  return id;
                }}
                style={styles.friendsList}
                contentContainerStyle={styles.friendsListContent}
                extraData={filteredFriends.length}
              />
            </>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}
              disabled={sending}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sendButton}
              onPress={sendInvites}
              disabled={sending || selectedFriends.size === 0}
            >
              <LinearGradient
                colors={['#192A4A', '#1a2335']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sendButtonGradient}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.sendButtonText}>
                    Send ({selectedFriends.size})
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    height: '90%',
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#C8A25F',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8F9FF',
    borderWidth: 1,
    borderColor: '#C8A25F',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#C8A25F',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#C8A25F',
  },
  selectAllText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  selectCount: {
    fontSize: 13,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  debugText: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontStyle: 'italic',
  },
  friendsList: {
    flex: 1,
  },
  friendsListContent: {
    padding: 16,
    paddingBottom: 20,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  friendCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  friendBio: {
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#C8A25F',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sendButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#C8A25F',
  },
  sendButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

