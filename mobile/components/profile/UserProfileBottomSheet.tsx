import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

interface UserProfileOverview {
  user: {
    id: string;
    username?: string;
    first_name: string;
    last_name: string;
    email: string;
    profile_image_url?: string;
    bio?: string;
    date_joined?: string;
  };
  stats: {
    post_count: number;
    friend_count: number;
    photos: string[];
  };
  recent_posts: Array<any>;
  relationship?: {
    is_self: boolean;
    is_friend: boolean;
    incoming_request: boolean;
    outgoing_request: boolean;
    incoming_request_id?: number;
    outgoing_request_id?: number;
    friend_entry_id?: number;
    viewer_has_blocked: boolean;
    blocked_by_target: boolean;
    viewer_block_id?: number;
    can_send_friend_request: boolean;
  };
  can_view_posts: boolean;
  can_view_friend_count: boolean;
}

interface UserProfileBottomSheetProps {
  visible: boolean;
  userId: string | number | null;
  onClose: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_TRANSLATE_Y = -SCREEN_HEIGHT + 100;

export default function UserProfileBottomSheet({
  visible,
  userId,
  onClose,
}: UserProfileBottomSheetProps) {
  const { colors, isDark } = useTheme();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'photos'>('overview');
  const [actionLoading, setActionLoading] = useState(false);

  const translateY = useSharedValue(0);
  const context = useSharedValue({ y: 0 });

  useEffect(() => {
    if (visible && userId) {
      translateY.value = withSpring(MAX_TRANSLATE_Y, { damping: 50 });
      loadProfile();
    } else {
      translateY.value = withTiming(0);
    }
  }, [visible, userId]);

  const loadProfile = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const data = await apiClient.get<UserProfileOverview>(`/auth/user/${userId}/overview/`);
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load user profile');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    translateY.value = withTiming(0, {}, () => {
      runOnJS(onClose)();
    });
  };

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      translateY.value = event.translationY + context.value.y;
      translateY.value = Math.max(translateY.value, MAX_TRANSLATE_Y);
    })
    .onEnd(() => {
      if (translateY.value > MAX_TRANSLATE_Y / 2) {
        runOnJS(handleClose)();
      } else {
        translateY.value = withSpring(MAX_TRANSLATE_Y, { damping: 50 });
      }
    });

  const rBottomSheetStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const handleSendFriendRequest = async () => {
    if (!userId) return;
    try {
      setActionLoading(true);
      await apiClient.post('/auth/friend-requests/', { to_user_id: userId });
      Alert.alert('Success', 'Friend request sent');
      loadProfile();
    } catch (error) {
      Alert.alert('Error', 'Failed to send friend request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    const requestId = profile?.relationship?.outgoing_request_id;
    if (!requestId) return;
    try {
      setActionLoading(true);
      await apiClient.post(`/auth/friend-requests/${requestId}/cancel/`);
      Alert.alert('Success', 'Friend request cancelled');
      loadProfile();
    } catch (error) {
      Alert.alert('Error', 'Failed to cancel request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    const requestId = profile?.relationship?.incoming_request_id;
    if (!requestId) return;
    try {
      setActionLoading(true);
      await apiClient.post(`/auth/friend-requests/${requestId}/accept-friend-request/`);
      Alert.alert('Success', 'You are now friends');
      loadProfile();
    } catch (error) {
      Alert.alert('Error', 'Failed to accept request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfriend = () => {
    const friendId = profile?.relationship?.friend_entry_id;
    if (!friendId) return;
    Alert.alert(
      'Unfriend User',
      'Are you sure you want to unfriend this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await apiClient.delete(`/auth/friends/${friendId}/`);
              Alert.alert('Success', 'Friend removed');
              loadProfile();
            } catch (error) {
              Alert.alert('Error', 'Failed to unfriend user');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleBlock = () => {
    if (!userId) return;
    Alert.alert(
      'Block User',
      'Are you sure you want to block this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              // Backend expects blocked_user as string UUID (matches frontend and README)
              const userIdString = String(userId);
              await apiClient.post('/auth/blocks/', { blocked_user: userIdString });
              Alert.alert('Success', 'User blocked');
              handleClose();
            } catch (error: any) {
              console.error('Block user error:', error);
              console.error('Error response:', error.response?.data);
              console.error('User ID:', userId, 'Type:', typeof userId);
              const errorMessage = error.response?.data?.message || 
                                  error.response?.data?.blocked_user?.[0] ||
                                  error.response?.data?.blocked_user_id?.[0] ||
                                  'Failed to block user';
              Alert.alert('Error', errorMessage);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const displayName = profile?.user?.username ||
    `${profile?.user?.first_name} ${profile?.user?.last_name}`.trim() ||
    'User';

  const avatarUri = profile?.user?.profile_image_url
    ? resolveRemoteUrl(profile.user.profile_image_url)
    : null;
  const avatarSource = avatarUri ? { uri: avatarUri } : DEFAULT_AVATAR;

  const styles = StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    bottomSheet: {
      height: SCREEN_HEIGHT,
      width: '100%',
      backgroundColor: colors.background,
      borderTopLeftRadius: 25,
      borderTopRightRadius: 25,
      position: 'absolute',
      top: SCREEN_HEIGHT,
      left: 0,
      right: 0,
    },
    dragIndicator: {
      width: 40,
      height: 5,
      backgroundColor: colors.border,
      borderRadius: 3,
      alignSelf: 'center',
      marginVertical: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    closeButton: {
      padding: 8,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
    },
    profileHeader: {
      alignItems: 'center',
      marginBottom: 24,
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.border,
      marginBottom: 16,
    },
    name: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    username: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    bio: {
      fontSize: 14,
      color: colors.text,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },
    actionsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    actionButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 24,
      backgroundColor: colors.primary,
    },
    actionButtonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionButtonDanger: {
      backgroundColor: '#FF4D4F',
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    actionButtonTextSecondary: {
      color: colors.text,
    },
    tabsContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 20,
    },
    tab: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    tabTextActive: {
      color: '#FFFFFF',
    },
    statsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
    statCard: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 20,
    },
    postsContainer: {
      gap: 16,
    },
    postCard: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.border,
    },
    postContent: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
      marginBottom: 12,
    },
    postFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    postDate: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    seePostButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    seePostButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    photosGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    photoImage: {
      width: (Dimensions.get('window').width - 64) / 3,
      height: (Dimensions.get('window').width - 64) / 3,
      borderRadius: 8,
    },
  });

  const renderActions = () => {
    const relationship = profile?.relationship;
    if (!relationship || relationship.is_self) return null;

    if (relationship.viewer_has_blocked) {
      return (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            disabled={actionLoading}
          >
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
              Blocked
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (relationship.blocked_by_target) {
      return (
        <Text style={styles.emptyText}>You have been blocked by this user</Text>
      );
    }

    return (
      <View style={styles.actionsContainer}>
        {relationship.is_friend && (
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonDanger]}
            onPress={handleUnfriend}
            disabled={actionLoading}
          >
            <Text style={styles.actionButtonText}>Unfriend</Text>
          </TouchableOpacity>
        )}

        {relationship.incoming_request && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleAcceptRequest}
            disabled={actionLoading}
          >
            <Text style={styles.actionButtonText}>Accept Request</Text>
          </TouchableOpacity>
        )}

        {relationship.outgoing_request && (
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={handleCancelRequest}
            disabled={actionLoading}
          >
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
              Cancel Request
            </Text>
          </TouchableOpacity>
        )}

        {relationship.can_send_friend_request && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleSendFriendRequest}
            disabled={actionLoading}
          >
            <Text style={styles.actionButtonText}>Add Friend</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={handleBlock}
          disabled={actionLoading}
        >
          <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
            Block
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={handleClose}
        >
          <View style={{ flex: 1 }} />
        </TouchableOpacity>
        
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.bottomSheet, rBottomSheetStyle]}>
            <View style={styles.dragIndicator} />
              <View style={styles.header}>
                <Text style={styles.name}>{displayName}</Text>
                <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                ) : profile ? (
                  <>
                    <View style={styles.profileHeader}>
                      <Image source={avatarSource} style={styles.avatar} />
                      {profile.user.username && (
                        <Text style={styles.username}>@{profile.user.username}</Text>
                      )}
                      {profile.user.bio && (
                        <Text style={styles.bio}>{profile.user.bio}</Text>
                      )}
                      {renderActions()}
                    </View>

                    <View style={styles.tabsContainer}>
                      <TouchableOpacity
                        style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
                        onPress={() => setActiveTab('overview')}
                      >
                        <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
                          Overview
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
                        onPress={() => setActiveTab('posts')}
                        disabled={!profile.can_view_posts}
                      >
                        <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
                          Posts
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.tab, activeTab === 'photos' && styles.tabActive]}
                        onPress={() => setActiveTab('photos')}
                        disabled={!profile.can_view_posts}
                      >
                        <Text style={[styles.tabText, activeTab === 'photos' && styles.tabTextActive]}>
                          Photos
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {activeTab === 'overview' && (
                      <View style={styles.statsContainer}>
                        <View style={styles.statCard}>
                          <Text style={styles.statValue}>
                            {profile.can_view_posts ? profile.stats.post_count : '—'}
                          </Text>
                          <Text style={styles.statLabel}>Posts</Text>
                        </View>
                        <View style={styles.statCard}>
                          <Text style={styles.statValue}>
                            {profile.can_view_friend_count ? profile.stats.friend_count : '—'}
                          </Text>
                          <Text style={styles.statLabel}>Friends</Text>
                        </View>
                      </View>
                    )}

                    {activeTab === 'posts' && (
                      <View style={styles.postsContainer}>
                        {profile.can_view_posts ? (
                          profile.recent_posts.length > 0 ? (
                            profile.recent_posts.map((post) => {
                              const postDate = post.created_at 
                                ? new Date(post.created_at).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                : '';

                              return (
                                <View key={post.id} style={styles.postCard}>
                                  <Text style={styles.postContent} numberOfLines={3}>
                                    {post.content}
                                  </Text>
                                  <View style={styles.postFooter}>
                                    <Text style={styles.postDate}>{postDate}</Text>
                                    <TouchableOpacity
                                      style={styles.seePostButton}
                                      onPress={() => {
                                        handleClose();
                                        router.push(`/(tabs)/feed/${post.id}`);
                                      }}
                                    >
                                      <Text style={styles.seePostButtonText}>See post</Text>
                                      <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              );
                            })
                          ) : (
                            <Text style={styles.emptyText}>No posts yet</Text>
                          )
                        ) : (
                          <Text style={styles.emptyText}>Posts are private</Text>
                        )}
                      </View>
                    )}

                    {activeTab === 'photos' && (
                      <View style={styles.photosGrid}>
                        {profile.can_view_posts && profile.stats.photos.length > 0 ? (
                          profile.stats.photos.map((url, index) => (
                            <Image
                              key={index}
                              source={{ uri: resolveRemoteUrl(url) }}
                              style={styles.photoImage}
                            />
                          ))
                        ) : (
                          <Text style={styles.emptyText}>
                            {profile.can_view_posts ? 'No photos yet' : 'Photos are private'}
                          </Text>
                        )}
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={styles.emptyText}>Profile not available</Text>
                )}
            </ScrollView>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

