import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../utils/api';
import { UserProfileOverview, Post, Friend, PaginatedResponse } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { resolveRemoteUrl, DEFAULT_AVATAR, resolveMediaUrls } from '../../utils/url';

type ProfileTab = 'posts' | 'photos' | 'friends';

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [profile, setProfile] = useState<UserProfileOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // If userId is provided in params, view that user's profile; otherwise view own profile
  const userId = params.userId ? Number(params.userId) : currentUser?.id;
  const isOwnProfile = userId === currentUser?.id;

  useEffect(() => {
    if (userId) {
      loadProfile();
      if (activeTab === 'friends') {
        loadFriends();
      }
    }
  }, [userId, activeTab]);

  const loadProfile = async () => {
    if (!userId) return;
    
    try {
      if (!refreshing) {
        setLoading(true);
      }
      const data = await apiClient.get<UserProfileOverview>(`/auth/user/${userId}/overview/`);
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProfile();
    if (activeTab === 'friends' && isOwnProfile) {
      loadFriends();
    }
  }, [activeTab, isOwnProfile]);

  const loadFriends = async () => {
    if (!userId || !isOwnProfile) return; // Only load friends for own profile
    
    try {
      setLoadingFriends(true);
      const response = await apiClient.get<PaginatedResponse<Friend>>('/auth/friends/');
      setFriends(response.results || []);
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
      flex: 1,
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
  }), [colors, isDark]);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const avatarUri = profile?.user?.profile_image_url 
    ? resolveRemoteUrl(profile.user.profile_image_url)
    : null;
  const avatarSource = avatarUri ? { uri: avatarUri } : DEFAULT_AVATAR;

  const renderPosts = () => {
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
            onPress={() => router.push(`/(tabs)/feed/${post.id}`)}
          >
            {post.media && post.media.length > 0 ? (
              <Image
                source={{ uri: post.media[0] }}
                style={styles.postImage}
                resizeMode="cover"
              />
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
              // Could navigate to a photo viewer
            }}
          >
            <Image
              source={{ uri: photo }}
              style={styles.postImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderFriends = () => {
    if (loadingFriends) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
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
              onPress={() => router.push(`/(tabs)/profile?userId=${friendUser.id}`)}
            >
              <Image source={friendAvatarSource} style={styles.friendAvatar} />
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
    );
  };

  return (
    <View style={styles.container}>
      <AppNavbar 
        title={isOwnProfile ? "Profile" : fullName || username || "Profile"} 
        showLogo={false} 
        showProfileImage={false} 
        showSettingsIcon={isOwnProfile} 
      />
      <ScrollView
        style={styles.container}
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
              <Image source={avatarSource} style={styles.avatar} />
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
              if (isOwnProfile && friends.length === 0) {
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
    </View>
  );
}
