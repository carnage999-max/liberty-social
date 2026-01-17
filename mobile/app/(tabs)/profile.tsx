import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { UserProfileOverview, Post, Friend, PaginatedResponse, Conversation } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppNavbar from '../../components/layout/AppNavbar';
import { resolveRemoteUrl, DEFAULT_AVATAR, resolveMediaUrls } from '../../utils/url';
import UserProfileBottomSheet from '../../components/profile/UserProfileBottomSheet';
import { SkeletonProfile, SkeletonFriend, Skeleton } from '../../components/common/Skeleton';
import ImageGallery from '../../components/common/ImageGallery';
import FriendshipHistoryModal from '../../components/profile/FriendshipHistoryModal';

type ProfileTab = 'posts' | 'photos' | 'friends';

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const { user: currentUser } = useAuth();
  const { showError } = useAlert();
  const { showSuccess, showError: showToastError } = useToast();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfileOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [profileBottomSheetVisible, setProfileBottomSheetVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | number | null>(null);
  const [loadedTabs, setLoadedTabs] = useState<Set<ProfileTab>>(new Set());
  const [startingConversation, setStartingConversation] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [friendshipHistoryVisible, setFriendshipHistoryVisible] = useState(false);

  // If userId is provided in params, view that user's profile; otherwise view own profile
  const userId = params.userId ? Number(params.userId) : currentUser?.id;
  const isOwnProfile = userId === currentUser?.id;

  // Load profile when userId is available
  useEffect(() => {
    if (userId && !profile) {
      loadProfile();
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      // Only load profile on initial mount or when userId changes
      if (!profile) {
        loadProfile();
      }
      // Load tab-specific data when switching tabs
      if (activeTab === 'friends' && !loadedTabs.has('friends')) {
        loadFriends();
      }
    }
  }, [userId, activeTab]);

  const loadProfile = async () => {
    if (!userId) return;
    
    try {
      if (!refreshing && !profile) {
        setLoading(true);
      }
      const data = await apiClient.get<UserProfileOverview>(`/auth/user/${userId}/overview/`);
      setProfile(data);
      // Mark posts and photos as loaded since they come with the profile
      setLoadedTabs(prev => new Set([...prev, 'posts', 'photos']));
    } catch (error) {
      console.error('Error loading profile:', error);
      showError('Failed to load user profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleStartConversation = useCallback(async () => {
    if (!userId || isOwnProfile) return;
    
    try {
      setStartingConversation(true);
      // Ensure userId is a string (UUID)
      const friendId = String(userId);
      
      // Check if conversation already exists
      const existingConversations = await apiClient.get<PaginatedResponse<Conversation>>('/conversations/');
      const existing = existingConversations.results.find((conv) => {
        if (conv.is_group) return false;
        return conv.participants.some((p) => String(p.user.id) === friendId);
      });

      if (existing) {
        router.push(`/(tabs)/messages/${existing.id}`);
        return;
      }

      // Create new conversation
      const conversation = await apiClient.post<Conversation>('/conversations/', {
        is_group: false,
        participant_ids: [friendId],
      });

      showSuccess('Conversation started');
      router.push(`/(tabs)/messages/${conversation.id}`);
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
      showToastError(errorMessage);
    } finally {
      setStartingConversation(false);
    }
  }, [userId, isOwnProfile, router, showSuccess, showToastError]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProfile();
    if (activeTab === 'friends' && isOwnProfile) {
      loadFriends();
    }
  }, [activeTab, isOwnProfile, profile]);

  const loadFriends = async () => {
    if (!userId || !isOwnProfile) return; // Only load friends for own profile
    
    try {
      setLoadingFriends(true);
      const response = await apiClient.get<PaginatedResponse<Friend>>('/auth/friends/');
      setFriends(response.results || []);
      setLoadedTabs(prev => new Set([...prev, 'friends']));
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setLoadingFriends(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const month = date.toLocaleString('default', { month: 'long' });
      const year = date.getFullYear();
      return `Joined ${month} ${year}`;
    } catch {
      return 'N/A';
    }
  };

  const fullName = profile?.user?.first_name || profile?.user?.last_name
    ? `${profile?.user?.first_name || ''} ${profile?.user?.last_name || ''}`.trim()
    : null;

  const username = profile?.user?.username;
  const email = isOwnProfile ? currentUser?.email : null; // Only show email for own profile
  const bio = profile?.user?.bio;
  const dateJoined = profile?.user?.date_joined;

  const photos = useMemo(() => {
    if (!profile?.stats?.photos) return [];
    return resolveMediaUrls(profile.stats.photos);
  }, [profile?.stats?.photos]);

  const posts = useMemo(() => {
    if (!profile?.recent_posts) return [];
    return profile.recent_posts.map((post) => ({
      ...post,
      media: resolveMediaUrls(post.media || []),
    }));
  }, [profile?.recent_posts]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    profileHeader: {
      padding: 20,
      paddingBottom: 12,
    },
    profileTopSection: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    avatarContainer: {
      position: 'relative',
      marginRight: 20,
    },
    avatar: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: colors.border,
    },
    editProfileButton: {
      position: 'absolute',
      top: 65,
      right: -8,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    profileInfo: {
      flex: 1,
      paddingTop: 8,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    fullName: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginRight: 8,
    },
    username: {
      fontSize: 15,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    infoText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginLeft: 6,
    },
    bio: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
      marginTop: 12,
      marginBottom: 8,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 16,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      marginTop: 12,
    },
    stat: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    statLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    tabsContainer: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    tab: {
      flex: 1,
      paddingVertical: 14,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.primary,
    },
    tabIcon: {
      marginRight: 6,
    },
    contentContainer: {
      minHeight: 400,
    },
    postsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    postItem: {
      width: '33.333%',
      aspectRatio: 1,
      padding: 1,
    },
    postImage: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.border,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
      minHeight: 300,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 12,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    friendshipHistoryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 8,
      borderRadius: 12,
      borderWidth: 1,
      gap: 12,
    },
    friendshipHistoryButtonText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
    },
    friendsList: {
      padding: 16,
    },
    friendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 8,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderRadius: 12,
    },
    friendAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: colors.border,
      marginRight: 12,
    },
    friendInfo: {
      flex: 1,
    },
    friendName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    friendUsername: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    messageButtonContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    messageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
      gap: 8,
    },
    messageButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  }), [colors, isDark]);

  // Only show full page skeleton on initial load when profile is null
  if (loading && !profile) {
    return (
      <View style={styles.container}>
        <AppNavbar 
          title={isOwnProfile ? "Profile" : "Profile"}
          showProfileImage={false} 
          showMessageIcon={false}
          showLogo={false} 
          showSettingsIcon={isOwnProfile} 
        />
        <SkeletonProfile />
      </View>
    );
  }

  const avatarUri = profile?.user?.profile_image_url 
    ? resolveRemoteUrl(profile.user.profile_image_url)
    : null;
  const avatarSource = avatarUri ? { uri: avatarUri } : DEFAULT_AVATAR;

  const renderPosts = () => {
    // Show skeleton loading only if profile is still loading initially
    if (loading && !profile) {
      return (
        <View style={styles.contentContainer}>
          <View style={styles.postsGrid}>
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <View key={item} style={styles.postItem}>
                <Skeleton width="100%" height="100%" borderRadius={0} />
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (posts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="grid-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No posts yet</Text>
        </View>
      );
    }

    return (
      <View style={styles.postsGrid}>
        {posts.map((post) => (
          <TouchableOpacity
            key={post.id}
            style={styles.postItem}
            onPress={() => router.push(`/(tabs)/feed/${post.slug ?? post.id}`)}
          >
            {post.media && post.media.length > 0 ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  setGalleryImages(post.media || []);
                  setGalleryIndex(0);
                  setGalleryVisible(true);
                }}
              >
              <Image
                source={{ uri: post.media[0] }}
                style={styles.postImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />
              </TouchableOpacity>
            ) : (
              <View style={[styles.postImage, { justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color={colors.textSecondary}
                />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderPhotos = () => {
    // Show skeleton loading only if profile is still loading initially
    if (loading && !profile) {
      return (
        <View style={styles.contentContainer}>
          <View style={styles.postsGrid}>
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <View key={item} style={styles.postItem}>
                <Skeleton width="100%" height="100%" borderRadius={0} />
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (photos.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No photos yet</Text>
        </View>
      );
    }

    return (
      <View style={styles.postsGrid}>
        {photos.map((photo, index) => (
          <TouchableOpacity
            key={`photo-${index}`}
            style={styles.postItem}
            onPress={() => {
              setGalleryImages(photos);
              setGalleryIndex(index);
              setGalleryVisible(true);
            }}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: photo }}
              style={styles.postImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderFriends = () => {
    if (loadingFriends) {
      return (
        <View style={styles.friendsList}>
          {[1, 2, 3, 4, 5].map((item) => (
            <SkeletonFriend key={item} />
          ))}
        </View>
      );
    }

    if (!isOwnProfile) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Friend list is private</Text>
        </View>
      );
    }

    if (friends.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No friends yet</Text>
        </View>
      );
    }

    return (
      <View>
        <TouchableOpacity
          style={[
            styles.friendshipHistoryButton,
            {
              backgroundColor: isDark ? colors.backgroundSecondary : '#F3F4F6',
              borderColor: colors.border,
            },
          ]}
          onPress={() => setFriendshipHistoryVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={20} color={colors.primary} />
          <Text style={[styles.friendshipHistoryButtonText, { color: colors.text }]}>
            Friendship History
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.friendsList}>
          {friends.map((friend) => {
          const friendUser = friend.friend;
          const friendDisplayName = friendUser.username ||
            `${friendUser.first_name || ''} ${friendUser.last_name || ''}`.trim() ||
            friendUser.email ||
            'User';
          const friendAvatarUri = friendUser.profile_image_url
            ? resolveRemoteUrl(friendUser.profile_image_url)
            : null;
          const friendAvatarSource = friendAvatarUri ? { uri: friendAvatarUri } : DEFAULT_AVATAR;

          return (
            <TouchableOpacity
              key={friend.id}
              style={styles.friendItem}
              onPress={() => {
                setSelectedUserId(friendUser.id);
                setProfileBottomSheetVisible(true);
              }}
            >
              <Image 
                source={friendAvatarSource} 
                style={styles.friendAvatar} 
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{friendDisplayName}</Text>
                {friendUser.username && (
                  <Text style={styles.friendUsername}>@{friendUser.username}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          );
        })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppNavbar 
        title={isOwnProfile ? "Profile" : fullName || username || "Profile"}
        showProfileImage={false} 
        showMessageIcon={false}
        showLogo={false} 
        showSettingsIcon={isOwnProfile} 
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: (insets.bottom || 0) + 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.profileHeader}>
          <View style={styles.profileTopSection}>
            <View style={styles.avatarContainer}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  if (avatarUri) {
                    setGalleryImages([avatarUri]);
                    setGalleryIndex(0);
                    setGalleryVisible(true);
                  }
                }}
              >
              <Image 
                source={avatarSource} 
                style={styles.avatar} 
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />
              </TouchableOpacity>
              {isOwnProfile && (
                <TouchableOpacity
                  style={styles.editProfileButton}
                  onPress={() => router.push('/(tabs)/profile/edit')}
                >
                  <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                {fullName && (
                  <Text style={styles.fullName} numberOfLines={1}>
                    {fullName}
                  </Text>
                )}
              </View>
              {username && (
                <Text style={styles.username}>@{username}</Text>
              )}
              {dateJoined && (
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.infoText}>{formatDate(dateJoined)}</Text>
                </View>
              )}
              {email && isOwnProfile && (
                <View style={styles.infoRow}>
                  <Ionicons name="mail-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.infoText} numberOfLines={1}>{email}</Text>
                </View>
              )}
              {bio && (
                <Text style={styles.bio}>{bio}</Text>
              )}
            </View>
          </View>

          {!isOwnProfile && profile?.relationship?.is_friend && (
            <View style={styles.messageButtonContainer}>
              <TouchableOpacity
                style={[styles.messageButton, { backgroundColor: colors.primary }]}
                onPress={handleStartConversation}
                disabled={startingConversation}
              >
                <Ionicons name="chatbubbles-outline" size={20} color="#FFFFFF" />
                <Text style={styles.messageButtonText}>Message</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile?.stats?.post_count ?? 0}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile?.stats?.friend_count ?? 0}</Text>
              <Text style={styles.statLabel}>Friends</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{photos.length}</Text>
              <Text style={styles.statLabel}>Photos</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
            onPress={() => setActiveTab('posts')}
          >
            <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
              Posts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'photos' && styles.tabActive]}
            onPress={() => setActiveTab('photos')}
          >
            <Text style={[styles.tabText, activeTab === 'photos' && styles.tabTextActive]}>
              Photos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
            onPress={() => {
              setActiveTab('friends');
              if (isOwnProfile && !loadedTabs.has('friends')) {
                loadFriends();
              }
            }}
          >
            <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
              Friends
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentContainer}>
          {activeTab === 'posts' && renderPosts()}
          {activeTab === 'photos' && renderPhotos()}
          {activeTab === 'friends' && renderFriends()}
        </View>
      </ScrollView>

      <UserProfileBottomSheet
        visible={profileBottomSheetVisible}
        userId={selectedUserId}
        onClose={() => {
          setProfileBottomSheetVisible(false);
          setSelectedUserId(null);
        }}
      />

      <ImageGallery
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
        images={galleryImages}
        initialIndex={galleryIndex}
      />

      {isOwnProfile && (
        <FriendshipHistoryModal
          visible={friendshipHistoryVisible}
          onClose={() => setFriendshipHistoryVisible(false)}
        />
      )}
    </View>
  );
}
