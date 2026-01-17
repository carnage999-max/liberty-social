import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../utils/api';
import { Friend, PaginatedResponse } from '../../types';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';
import { useRouter } from 'expo-router';

interface FriendData {
  friend: {
    id: string;
    username: string;
    profile_image_url: string | null;
    is_online: boolean;
    last_seen: string;
  };
}

interface ActiveFriendsProps {
  maxUsers?: number;
  onUserClick?: (user: FriendData['friend']) => void;
}

export default function ActiveFriends({
  maxUsers = 8,
  onUserClick,
}: ActiveFriendsProps) {
  const { colors, isDark } = useTheme();
  const { user: currentUser, accessToken } = useAuth();
  const router = useRouter();
  const [friends, setFriends] = useState<FriendData['friend'][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showingType, setShowingType] = useState<'online' | 'recent'>('online');

  // Format last seen time
  const formatLastSeen = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays <= 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    const fetchFriends = async () => {
      if (!accessToken) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch friends list
        const response = await apiClient.get<PaginatedResponse<Friend>>('/auth/friends/?page_size=100');
        const friendsList = (response.results || []).map((item: Friend) => {
          // Friend structure: { id, friend: { id, username, ... } }
          return (item as any).friend || item;
        });

        if (friendsList.length === 0) {
          setError("You don't have any friends yet");
          setFriends([]);
          return;
        }

        // Separate online and recently active friends
        const onlineFriends = friendsList
          .filter((friend: FriendData['friend']) => friend.is_online)
          .sort((a: FriendData['friend'], b: FriendData['friend']) => 
            new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
          )
          .slice(0, maxUsers);

        if (onlineFriends.length > 0) {
          setFriends(onlineFriends);
          setShowingType('online');
        } else {
          // No online friends, show recently active (up to 7 days)
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          const recentlyActiveFriends = friendsList
            .filter(
              (friend: FriendData['friend']) =>
                !friend.is_online && new Date(friend.last_seen) > sevenDaysAgo
            )
            .sort((a: FriendData['friend'], b: FriendData['friend']) => 
              new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
            )
            .slice(0, maxUsers);

          if (recentlyActiveFriends.length > 0) {
            setFriends(recentlyActiveFriends);
            setShowingType('recent');
          } else {
            setError('No friends online or active in the last 7 days');
            setFriends([]);
          }
        }
      } catch (err) {
        console.error('Error fetching friends:', err);
        setError(err instanceof Error ? err.message : 'Failed to load friends');
        setFriends([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFriends();

    // Refresh every 30 seconds
    const interval = setInterval(fetchFriends, 30000);

    return () => clearInterval(interval);
  }, [accessToken, maxUsers]);

  if (!currentUser) {
    return null;
  }

  if (loading && friends.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? colors.backgroundSecondary : '#F8F9FF' }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: '#fbbf24' }]}>Who's Online?</Text>
          <ActivityIndicator size="small" color="#fbbf24" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
          {[...Array(4)].map((_, i) => (
            <View key={i} style={styles.friendItemSkeleton}>
              <View style={[styles.avatarSkeleton, { backgroundColor: colors.border }]} />
              <View style={[styles.nameSkeleton, { backgroundColor: colors.border }]} />
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (error && friends.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? colors.backgroundSecondary : '#F8F9FF' }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: '#fbbf24' }]}>Who's Online?</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
        </View>
      </View>
    );
  }

  if (friends.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.backgroundSecondary : '#F8F9FF' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: '#fbbf24' }]}>Who's Online?</Text>
        <View style={styles.statusBadgeContainer}>
          <LinearGradient
            colors={['#a8862a', '#d7b756', '#a8862a']}
            style={styles.statusBadgeGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.statusBadgeContent}>
              {showingType === 'online' ? (
                <Ionicons name="ellipse" size={8} color="#0B3D91" style={{ marginRight: 4 }} />
              ) : (
                <Ionicons name="location" size={8} color="#0B3D91" style={{ marginRight: 4 }} />
              )}
              <Text style={styles.statusBadgeText}>
                {showingType === 'online' ? 'Online' : 'Recently Active'}
          </Text>
            </View>
          </LinearGradient>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
        <View style={styles.friendsContainer}>
          {friends.map((friend) => {
            const avatarUrl = friend.profile_image_url
              ? resolveRemoteUrl(friend.profile_image_url)
              : null;
            const avatarSource = avatarUrl ? { uri: avatarUrl } : DEFAULT_AVATAR;

            return (
              <TouchableOpacity
                key={friend.id}
                style={styles.friendItem}
                onPress={() => {
                  if (onUserClick) {
                    onUserClick(friend);
                  } else {
                    router.push(`/(tabs)/users/${friend.slug ?? friend.id}`);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.flagContainer}>
                  {/* Flag background - using gradient as fallback since we can't use GIF in React Native easily */}
                  <View
                    style={[
                      styles.flagBackground,
                      {
                        backgroundColor: isDark ? '#1b2849' : '#EEF3FF',
                      },
                    ]}
                  />
                  {/* Profile Image Container */}
                  <View style={styles.avatarContainer}>
                    {avatarUrl ? (
                      <Image source={avatarSource} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>
                          {(friend.username?.[0] || 'F').toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  {/* Online Status Indicator */}
                  <View
                    style={[
                      styles.onlineIndicator,
                      friend.is_online ? styles.onlineDot : styles.offlineDot,
                    ]}
                  />
                </View>
                <Text style={styles.friendName} numberOfLines={1}>
                  {friend.username}
                </Text>
                <Text style={[styles.friendStatus, { color: colors.textSecondary }]} numberOfLines={1}>
                  {friend.is_online ? 'Active now' : formatLastSeen(friend.last_seen)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      marginHorizontal: 16,
      marginVertical: 6,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    title: {
      fontSize: 14,
      fontWeight: 'bold',
    },
    statusBadgeContainer: {
      borderRadius: 10,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 4,
    },
    statusBadgeGradient: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(0, 0, 0, 0.2)',
    },
    statusBadgeContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#0B3D91',
    },
    scrollView: {
      paddingVertical: 4,
    },
    friendsContainer: {
      flexDirection: 'row',
      gap: 10,
    },
    friendItem: {
      alignItems: 'center',
      width: 64,
    },
    flagContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginBottom: 6,
    },
    flagBackground: {
      position: 'absolute',
      width: '100%',
      height: '100%',
    },
    avatarContainer: {
      width: 50,
      height: 50,
      borderRadius: 25,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: '#fbbf24',
      zIndex: 10,
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
      bottom: 1,
      right: 1,
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: '#FFFFFF',
      zIndex: 20,
    },
    onlineDot: {
      backgroundColor: '#10B981',
    },
    offlineDot: {
      backgroundColor: '#6B7280',
    },
    friendName: {
      fontSize: 11,
      fontWeight: '600',
      color: '#fbbf24',
      textAlign: 'center',
      marginTop: 2,
    },
    friendStatus: {
      fontSize: 10,
      textAlign: 'center',
      marginTop: 1,
    },
    errorContainer: {
      paddingVertical: 16,
      alignItems: 'center',
    },
    errorText: {
      fontSize: 14,
      textAlign: 'center',
    },
    friendItemSkeleton: {
      alignItems: 'center',
      width: 80,
      marginRight: 12,
    },
    avatarSkeleton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      marginBottom: 6,
    },
    nameSkeleton: {
      width: 50,
      height: 10,
      borderRadius: 5,
    },
  });
