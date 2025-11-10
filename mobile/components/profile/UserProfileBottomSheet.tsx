import React, { useState, useEffect, useRef } from 'react';
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
  TouchableWithoutFeedback,
  Animated as RNAnimated,
  PanResponder,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { Conversation, PaginatedResponse } from '../../types';
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
  const { showError: showAlertError, showConfirm } = useAlert();
  const { showSuccess, showError } = useToast();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'photos'>('overview');
  const [actionLoading, setActionLoading] = useState(false);
  const [startingConversation, setStartingConversation] = useState(false);
  const [optionsMenuVisible, setOptionsMenuVisible] = useState(false);
  const optionsMenuTranslateY = useRef(new RNAnimated.Value(0)).current;

  const translateY = useSharedValue(0);
  const context = useSharedValue({ y: 0 });

  const optionsMenuPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 12,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          optionsMenuTranslateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 100) {
          toggleOptionsMenu(false);
        } else {
          RNAnimated.spring(optionsMenuTranslateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const toggleOptionsMenu = (visible: boolean) => {
    if (visible) {
      setOptionsMenuVisible(true);
      RNAnimated.spring(optionsMenuTranslateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    } else {
      RNAnimated.timing(optionsMenuTranslateY, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setOptionsMenuVisible(false);
        optionsMenuTranslateY.setValue(0);
      });
    }
  };

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
      showAlertError('Failed to load user profile');
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
      showSuccess('Friend request sent');
      loadProfile();
    } catch (error) {
      showError('Failed to send friend request');
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
      showSuccess('Friend request cancelled');
      loadProfile();
    } catch (error) {
      showError('Failed to cancel request');
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
      showSuccess('You are now friends');
      loadProfile();
    } catch (error) {
      showError('Failed to accept request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!userId) return;
    
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
        onClose();
        router.push(`/(tabs)/messages/${existing.id}`);
        return;
      }

      // Create new conversation
      const conversation = await apiClient.post<Conversation>('/conversations/', {
        is_group: false,
        participant_ids: [friendId],
      });

      onClose();
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
      showError(errorMessage);
    } finally {
      setStartingConversation(false);
    }
  };

  const handleUnfriend = () => {
    toggleOptionsMenu(false);
    const friendId = profile?.relationship?.friend_entry_id;
    if (!friendId) return;
    showConfirm(
      'Are you sure you want to unfriend this user?',
      async () => {
        try {
          setActionLoading(true);
          await apiClient.delete(`/auth/friends/${friendId}/`);
          showSuccess('Friend removed');
          loadProfile();
        } catch (error) {
          showError('Failed to unfriend user');
        } finally {
          setActionLoading(false);
        }
      },
      undefined,
      'Unfriend User',
      true // destructive action
    );
  };

  const handleBlock = () => {
    toggleOptionsMenu(false);
    if (!userId) return;
    showConfirm(
      'Are you sure you want to block this user?',
      async () => {
        try {
          setActionLoading(true);
          // Backend expects blocked_user as string UUID (matches frontend and README)
          const userIdString = String(userId);
          await apiClient.post('/auth/blocks/', { blocked_user: userIdString });
          showSuccess('User blocked');
          handleClose();
        } catch (error: any) {
          console.error('Block user error:', error);
          console.error('Error response:', error.response?.data);
          console.error('User ID:', userId, 'Type:', typeof userId);
          const errorMessage = error.response?.data?.message || 
                              error.response?.data?.blocked_user?.[0] ||
                              error.response?.data?.blocked_user_id?.[0] ||
                              'Failed to block user';
          showError(errorMessage);
        } finally {
          setActionLoading(false);
        }
      },
      undefined,
      'Block User',
      true // destructive action
    );
  };

  // Prioritize first name + last name, fall back to username if unavailable
  const fullName = `${profile?.user?.first_name || ''} ${profile?.user?.last_name || ''}`.trim();
  const displayName = fullName || profile?.user?.username || 'User';

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
      paddingTop: 8,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    closeButton: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 20,
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
    profileInfo: {
      flex: 1,
      paddingTop: 8,
    },
    name: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
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
    actionsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 24,
      backgroundColor: colors.primary,
      gap: 8,
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
      gap: 12,
    },
    postCard: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
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
    optionsBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    optionsSheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 26,
      paddingHorizontal: 20,
      borderTopWidth: 1,
      borderTopColor: 'rgba(0, 0, 0, 0.1)',
    },
    optionsSheetHandle: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    optionsSheetContent: {
      gap: 10,
    },
    optionsSheetTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 10,
    },
    optionsSheetAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
    },
    optionsSheetActionDestructive: {
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 77, 79, 0.2)',
      marginTop: 6,
      paddingTop: 18,
    },
    optionsSheetActionText: {
      fontSize: 15,
      fontWeight: '600',
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

    const hasDangerousActions = relationship.is_friend || true; // Always show options menu if we can block

    return (
      <View style={styles.actionsContainer}>
        {relationship.is_friend && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleSendMessage}
            disabled={startingConversation || actionLoading}
          >
            <Ionicons name="chatbubbles-outline" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Send Message</Text>
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

        {hasDangerousActions && (
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => toggleOptionsMenu(true)}
            disabled={actionLoading}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
          </TouchableOpacity>
        )}
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
                      <View style={styles.profileTopSection}>
                        <View style={styles.avatarContainer}>
                          <Image source={avatarSource} style={styles.avatar} />
                        </View>
                        <View style={styles.profileInfo}>
                          <Text style={styles.name}>{displayName}</Text>
                          {profile.user.username && (
                            <Text style={styles.username}>@{profile.user.username}</Text>
                          )}
                          {profile.user.date_joined && (
                            <View style={styles.infoRow}>
                              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                              <Text style={styles.infoText}>
                                {new Date(profile.user.date_joined).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                })}
                              </Text>
                            </View>
                          )}
                          {profile.user.bio && (
                            <Text style={styles.bio}>{profile.user.bio}</Text>
                          )}
                        </View>
                      </View>
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

                    <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                      {activeTab === 'overview' && (
                        <>
                          <Text style={[styles.emptyText, { textAlign: 'left', marginTop: 0, marginBottom: 12, fontSize: 16, fontWeight: '600' }]}>
                            Recent Activity
                          </Text>
                          {profile.recent_posts && profile.recent_posts.length > 0 ? (
                            <View style={styles.postsContainer}>
                              {profile.recent_posts.slice(0, 3).map((post) => {
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
                              })}
                            </View>
                          ) : (
                            <Text style={styles.emptyText}>No recent activity</Text>
                          )}
                        </>
                      )}

                      {activeTab === 'posts' && (
                        <>
                          {profile.can_view_posts ? (
                            profile.recent_posts.length > 0 ? (
                              <View style={styles.postsContainer}>
                                {profile.recent_posts.map((post) => {
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
                                })}
                              </View>
                            ) : (
                              <Text style={styles.emptyText}>No posts yet</Text>
                            )
                          ) : (
                            <Text style={styles.emptyText}>Posts are private</Text>
                          )}
                        </>
                      )}

                      {activeTab === 'photos' && (
                        <>
                          {profile.can_view_posts && profile.stats.photos.length > 0 ? (
                            <View style={styles.photosGrid}>
                              {profile.stats.photos.map((url, index) => {
                                const photoUri = resolveRemoteUrl(url);
                                return photoUri ? (
                                  <Image
                                    key={index}
                                    source={{ uri: photoUri }}
                                    style={styles.photoImage}
                                  />
                                ) : null;
                              })}
                            </View>
                          ) : (
                            <Text style={styles.emptyText}>
                              {profile.can_view_posts ? 'No photos yet' : 'Photos are private'}
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                  </>
                ) : (
                  <Text style={styles.emptyText}>Profile not available</Text>
                )}
            </ScrollView>
          </Animated.View>
        </GestureDetector>

        {/* Options Menu Modal */}
        <Modal
          transparent
          visible={optionsMenuVisible}
          animationType="fade"
          onRequestClose={() => toggleOptionsMenu(false)}
        >
          <TouchableWithoutFeedback onPress={() => toggleOptionsMenu(false)}>
            <View style={styles.optionsBackdrop} />
          </TouchableWithoutFeedback>
          <RNAnimated.View
            style={[
              styles.optionsSheet,
              {
                transform: [{ translateY: optionsMenuTranslateY }],
                backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
              },
            ]}
            accessibilityViewIsModal
            {...optionsMenuPanResponder.panHandlers}
          >
            <TouchableOpacity
              style={styles.optionsSheetHandle}
              activeOpacity={0.8}
              onPress={() => toggleOptionsMenu(false)}
            >
              <View style={[styles.dragIndicator, { backgroundColor: colors.border }]} />
            </TouchableOpacity>
            <View style={styles.optionsSheetContent}>
              <Text style={[styles.optionsSheetTitle, { color: colors.text }]}>Options</Text>
              
              {profile?.relationship?.is_friend && (
                <TouchableOpacity
                  style={styles.optionsSheetAction}
                  onPress={handleUnfriend}
                  disabled={actionLoading}
                >
                  <Ionicons name="person-remove-outline" size={20} color={colors.secondary} />
                  <Text style={[styles.optionsSheetActionText, { color: colors.secondary }]}>
                    Unfriend
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.optionsSheetAction, styles.optionsSheetActionDestructive]}
                onPress={handleBlock}
                disabled={actionLoading}
              >
                <Ionicons name="ban-outline" size={20} color={colors.secondary} />
                <Text style={[styles.optionsSheetActionText, { color: colors.secondary }]}>
                  Block User
                </Text>
              </TouchableOpacity>
            </View>
          </RNAnimated.View>
        </Modal>
      </GestureHandlerRootView>
    </Modal>
  );
}
