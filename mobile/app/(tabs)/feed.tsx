import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ImageSourcePropType,
  Share,
  Animated,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../utils/api';
import { Post, PaginatedResponse, User, Reaction } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import MaskedView from '@react-native-masked-view/masked-view';
import ScreenHeader from '../../components/layout/ScreenHeader';
import PostActionsMenu from '../../components/feed/PostActionsMenu';
import {
  resolveMediaUrls,
  resolveRemoteUrl,
  DEFAULT_AVATAR,
} from '../../utils/url';
import { API_BASE } from '../../constants/API';
const GRADIENT_COLORS = ['#4F8EF7', '#7A6AF5', '#FF5C8A'] as const;
const PLACEHOLDER_AVATAR = DEFAULT_AVATAR;

type FeedPost = Post & {
  mediaUrls: string[];
  authorAvatar: ImageSourcePropType;
};

const buildDisplayName = (u: User) =>
  u.username || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'User';

const normalizePost = (post: Post | FeedPost): FeedPost => {
  const candidateSources: (string | null | undefined)[] = [];

  const appendCandidate = (value?: string | null) => {
    if (!value) return;
    candidateSources.push(value);
  };

  if (Array.isArray((post as any)?.media_urls)) {
    (post as any).media_urls.forEach((value: any) => appendCandidate(String(value)));
  }

  if (Array.isArray(post.media)) {
    post.media.forEach((entry: any) => {
      if (!entry) {
        return;
      }

      if (typeof entry === 'string') {
        appendCandidate(entry);
        return;
      }

      if (typeof entry === 'object') {
        if (Array.isArray(entry)) {
          entry.forEach((nested) => appendCandidate(resolveRemoteUrl(nested)));
          return;
        }

        appendCandidate(entry.url || entry.uri || entry.path || entry.src);
      }
    });
  }

  appendCandidate((post as any)?.media_url);
  appendCandidate((post as any)?.media);

  const mediaArray = candidateSources.filter(Boolean);

  const mediaUrls = resolveMediaUrls(mediaArray);
  const resolvedAvatar = resolveRemoteUrl(post.author?.profile_image_url);
  const authorAvatar: ImageSourcePropType = resolvedAvatar
    ? { uri: resolvedAvatar }
    : PLACEHOLDER_AVATAR;

  return {
    ...post,
    media: mediaUrls,
    mediaUrls,
    author: {
      ...post.author,
      profile_image_url: post.author?.profile_image_url || null,
    },
    authorAvatar,
  };
};

export default function FeedScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [reactionBusy, setReactionBusy] = useState<Record<number, boolean>>({});
  const [reachedEnd, setReachedEnd] = useState(false);
  const likeAnimationsRef = useRef<Record<number, Animated.Value>>({});

  type SuggestionItem =
    | { type: 'create' }
    | { type: 'user'; user: User };

  const suggestionItems = useMemo<SuggestionItem[]>(() => {
    const items: SuggestionItem[] = [{ type: 'create' }];

    suggestions.forEach((user) => {
      items.push({ type: 'user', user });
    });

    return items;
  }, [suggestions]);

  const loadFeed = useCallback(async (url?: string, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setReachedEnd(false);
        setLoading(true);
      }

      const endpoint = url || '/feed/';
      const response = await apiClient.get<PaginatedResponse<Post>>(endpoint);
      
      const rawResults = Array.isArray(response?.results)
        ? response.results
        : Array.isArray(response)
        ? (response as unknown as Post[])
        : [];
      const normalizedResults = rawResults.map(normalizePost);
      if (append) {
        setPosts((prev) => [...prev, ...normalizedResults]);
      } else {
        setPosts(normalizedResults);
      }
      
      setNext(response.next);
      if (!response.next) {
        setReachedEnd(true);
      }
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    try {
      const response = await apiClient.get<PaginatedResponse<User>>('/auth/friends/suggestions/');
      const results = (response as any)?.results ?? (Array.isArray(response) ? response : []);
      setSuggestions(Array.isArray(results) ? results.slice(0, 12) : []);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const getLikeAnimation = useCallback(
    (postId: number) => {
      if (!likeAnimationsRef.current[postId]) {
        likeAnimationsRef.current[postId] = new Animated.Value(1);
      }
      return likeAnimationsRef.current[postId];
    },
    []
  );

  const animateLikeState = useCallback(
    (postId: number, liked: boolean) => {
      const animation = getLikeAnimation(postId);
      animation.stopAnimation();
      Animated.sequence([
        Animated.spring(animation, {
          toValue: liked ? 1.3 : 0.9,
          useNativeDriver: true,
          stiffness: 260,
          damping: 16,
          mass: 0.7,
        }),
        Animated.spring(animation, {
          toValue: 1,
          useNativeDriver: true,
          stiffness: 220,
          damping: 14,
          mass: 0.7,
        }),
      ]).start();
    },
    [getLikeAnimation]
  );

  const navigation = useNavigation<NavigationProp<Record<string, object | undefined>>>();

  const triggerRefresh = useCallback(() => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    Promise.all([loadFeed(), loadSuggestions()]).finally(() => setRefreshing(false));
  }, [refreshing, loadFeed, loadSuggestions]);

  const onRefresh = useCallback(() => {
    triggerRefresh();
  }, [triggerRefresh]);

  const loadMore = () => {
    if (!next || reachedEnd) {
      setReachedEnd(true);
      return;
    }
    if (loadingMore) {
      return;
    }
    loadFeed(next, true);
  };

  const handleToggleLike = async (post: FeedPost) => {
    if (!user) {
      Alert.alert('Sign in required', 'Please log in to react to posts.');
      return;
    }

    const existingReaction = (post.reactions || []).find(
      (reaction) => reaction.user?.id === user.id && reaction.reaction_type === 'like'
    );

    setReactionBusy((prev) => ({ ...prev, [post.id]: true }));

    const previousPosts = posts;
    const optimisticReactionId = -Math.floor(Math.random() * 1_000_000) - 1;

    if (existingReaction) {
      setPosts((prev) =>
        prev.map((item) =>
          item.id === post.id
            ? {
                ...item,
                reactions: (item.reactions || []).filter(
                  (reaction) => reaction.id !== existingReaction.id
                ),
              }
            : item
        )
      );
      animateLikeState(post.id, false);
    } else {
      const optimisticReaction: Reaction = {
        id: optimisticReactionId,
        reaction_type: 'like',
        created_at: new Date().toISOString(),
        user,
      };

      setPosts((prev) =>
        prev.map((item) =>
          item.id === post.id
            ? {
                ...item,
                reactions: [
                  ...((item.reactions || []).filter(
                    (reaction) => reaction.user?.id !== user.id
                  ) || []),
                  optimisticReaction,
                ],
              }
            : item
        )
      );
      animateLikeState(post.id, true);
    }

    try {
      if (existingReaction) {
        await apiClient.delete(`/reactions/${existingReaction.id}/`);
      } else {
        const savedReaction = await apiClient.post<Reaction>('/reactions/', {
          post: post.id,
          reaction_type: 'like',
        });
        setPosts((prev) =>
          prev.map((item) =>
            item.id === post.id
              ? {
                  ...item,
                  reactions: [
                    ...((item.reactions || []).filter(
                      (reaction) => reaction.id !== optimisticReactionId
                    ) || []),
                    savedReaction,
                  ],
                }
              : item
          )
        );
      }
    } catch (error) {
      console.error('Error updating reaction:', error);
      Alert.alert('Unable to update reaction', 'Please try again in a moment.');
      setPosts(previousPosts);
    } finally {
      setReactionBusy((prev) => ({ ...prev, [post.id]: false }));
    }
  };

  const handleSharePost = async (post: FeedPost) => {
    try {
      const shareMessage = [post.content, `${API_BASE.replace(/\/api\/?$/, '')}/feed/${post.id}`]
        .filter(Boolean)
        .join('\n\n');

      await Share.share({
        message: shareMessage,
        title: 'Share post',
      });
    } catch (error) {
      console.error('Error sharing post:', error);
      Alert.alert('Unable to share', 'Please try again later.');
    }
  };

  const handlePostUpdated = (nextPost: FeedPost) => {
    const normalized = normalizePost(nextPost);
    setPosts((prev) => prev.map((item) => (item.id === normalized.id ? normalized : item)));
  };

  const handlePostDeleted = (postId: number) => {
    setPosts((prev) => prev.filter((item) => item.id !== postId));
  };

  useEffect(() => {
    loadFeed();
    loadSuggestions();
  }, [loadFeed, loadSuggestions]);

  useEffect(() => {
    const listener = (navigation as any)?.addListener?.('tabPress', () => {
      triggerRefresh();
    });
    return typeof listener === 'function' ? listener : undefined;
  }, [navigation, triggerRefresh]);

  const renderPost = ({ item }: { item: FeedPost }) => {
    const displayName = buildDisplayName(item.author);

    const galleryUrls: string[] =
      item.mediaUrls && item.mediaUrls.length
        ? item.mediaUrls
        : resolveMediaUrls(Array.isArray(item.media) ? (item.media as any) : []);

    const likeCount = (item.reactions || []).filter(
      (reaction) => reaction.reaction_type === 'like').length;
    const commentCount = item.comments?.length || 0;
    const hasLiked = !!user && (item.reactions || []).some(
      (reaction) => reaction.user?.id === user.id && reaction.reaction_type === 'like'
    );
    const likeProcessing = !!reactionBusy[item.id];
    const likeAnimation = getLikeAnimation(item.id);

    return (
      <View
        style={[
          styles.postContainer,
          {
            backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.postHeaderRow}>
          <TouchableOpacity
            style={styles.postHeader}
            onPress={() => router.push(`/(tabs)/users/${item.author.id}`)}
          >
            <Image source={item.authorAvatar} style={styles.avatar} />
            <View style={styles.postHeaderText}>
              <Text style={[styles.authorName, { color: colors.text }]}>{displayName}</Text>
              <Text style={[styles.postTime, { color: colors.textSecondary }]}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          </TouchableOpacity>
          <PostActionsMenu
            post={item}
            currentUserId={user?.id ?? null}
            onPostUpdated={handlePostUpdated}
            onPostDeleted={handlePostDeleted}
            normalizePost={normalizePost}
          />
        </View>

        {item.content && (
          <Text style={[styles.postContent, { color: colors.text }]}>{item.content}</Text>
        )}

        {galleryUrls.length > 0 && (
          <View style={styles.mediaContainer}>
            {galleryUrls.slice(0, 3).map((url, index) => (
              <Image
                key={`${item.id}-media-${index}`}
                source={{ uri: url }}
                style={styles.mediaImage}
                resizeMode="contain"
              />
            ))}
          </View>
        )}

        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleToggleLike(item)}
            disabled={likeProcessing}
          >
            <Ionicons
              name={hasLiked ? 'heart' : 'heart-outline'}
              size={20}
              color={hasLiked ? '#FF4D6D' : colors.textSecondary}
            />
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>{likeCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/(tabs)/feed/${item.id}`)}
          >
            <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>{commentCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleSharePost(item)}
          >
            <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSuggestion = ({ item }: { item: SuggestionItem }) => {
    if (item.type === 'create') {
      return (
        <TouchableOpacity
          style={styles.storyItem}
          onPress={() => router.push('/(tabs)/create-post')}
        >
          <LinearGradient
            colors={GRADIENT_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.storyCreateGradient}
          >
            <View
              style={[
                styles.storyCreateInner,
                { borderColor: isDark ? colors.backgroundSecondary : '#FFFFFF' },
              ]}
            >
              <Ionicons name="add" size={24} color={colors.primary} />
            </View>
          </LinearGradient>
          <Text style={[styles.storyName, { color: colors.text }]}>New Post</Text>
        </TouchableOpacity>
      );
    }

    const displayName = buildDisplayName(item.user);

    const userAvatar = resolveRemoteUrl(item.user.profile_image_url);
    const avatarSource: ImageSourcePropType = userAvatar
      ? { uri: userAvatar }
      : PLACEHOLDER_AVATAR;

    return (
      <TouchableOpacity
        style={styles.storyItem}
        onPress={() => router.push(`/(tabs)/users/${item.user.id}`)}
      >
        <Image source={avatarSource} style={styles.storyAvatar} />
        <Text style={[styles.storyName, { color: colors.text }]} numberOfLines={1}>
          {displayName}
        </Text>
      </TouchableOpacity>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerTitleWrapper: {
      height: 44,
      justifyContent: 'center',
    },
    gradientFill: {
      width: 320,
      height: 48,
    },
    headerTitleText: {
      fontSize: 32,
      fontWeight: '800',
      letterSpacing: -0.8,
      color: '#000000',
    },
    headerSubtitle: {
      fontSize: 14,
      fontWeight: '500',
      marginTop: 6,
    },
    listHeaderWrapper: {
      gap: 16,
      paddingBottom: 16,
    },
    storyList: {
      paddingVertical: 4,
      paddingLeft: 4,
      paddingRight: 20,
    },
    storyItem: {
      width: 76,
      alignItems: 'center',
      marginRight: 14,
    },
    storyAvatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      marginBottom: 6,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
    },
    storyCreateGradient: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    storyCreateInner: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 2,
    },
    storyName: {
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    storyEmptyText: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '500',
    },
    storyLoading: {
      paddingRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    postContainer: {
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
    },
    postHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 12,
      gap: 12,
    },
    postHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.border,
    },
    postHeaderText: {
      marginLeft: 12,
      flex: 1,
    },
    authorName: {
      fontSize: 16,
      fontWeight: '600',
    },
    postTime: {
      fontSize: 12,
      marginTop: 2,
    },
    postContent: {
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 12,
    },
    mediaContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    mediaImage: {
      width: '30%',
      aspectRatio: 1,
      borderRadius: 8,
      backgroundColor: colors.border,
    },
    postActions: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 24,
    },
    actionText: {
      marginLeft: 6,
      fontSize: 14,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    footerContainer: {
      paddingVertical: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerText: {
      fontSize: 12,
      fontWeight: '500',
      opacity: 0.6,
    },
    engagementCard: {
      borderRadius: 20,
      marginHorizontal: 20,
      padding: 20,
    },
    engagementContent: {
      gap: 16,
    },
    engagementTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: -0.3,
    },
    engagementSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
      color: '#E5E8FF',
    },
    engagementActions: {
      flexDirection: 'row',
      gap: 12,
    },
    engagementButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 14,
    },
    engagementPrimaryButton: {
      backgroundColor: '#1F2ABF',
      shadowColor: '#1F2ABF',
      shadowOpacity: 0.28,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    engagementPrimaryText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    engagementSecondaryButton: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
    },
    engagementSecondaryButtonLight: {
      backgroundColor: 'rgba(63,75,191,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(63,75,191,0.35)',
    },
    engagementSecondaryText: {
      fontSize: 14,
      fontWeight: '600',
    },
    engagementTitleLight: {
      color: '#1B195D',
    },
    engagementSubtitleLight: {
      color: '#6F6D8F',
    },
    engagementHighlights: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
    },
    highlightItem: {
      flex: 1,
      alignItems: 'center',
    },
    highlightValue: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    highlightValueLight: {
      color: '#1F2ABF',
    },
    highlightLabel: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: '500',
      color: '#E0E3FF',
    },
    highlightLabelLight: {
      color: '#5A5D7A',
    },
    highlightDivider: {
      width: 1,
      height: 32,
      backgroundColor: 'rgba(255,255,255,0.35)',
      marginHorizontal: 12,
    },
    highlightDividerLight: {
      backgroundColor: 'rgba(63,75,191,0.2)',
    },
  });

  if (loading && posts.length === 0) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderListHeader = () => (
    <View style={styles.listHeaderWrapper}>
      <ScreenHeader
        title={
          <MaskedView
            style={styles.headerTitleWrapper}
            maskElement={<Text style={styles.headerTitleText}>Liberty Social</Text>}
          >
            <LinearGradient
              colors={GRADIENT_COLORS}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientFill}
            />
          </MaskedView>
        }
        subtitle={<Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>People you may know</Text>}
        containerStyle={{ paddingBottom: 14 }}
      >
        <FlatList
          horizontal
          data={suggestionItems}
          keyExtractor={(item, index) =>
            item.type === 'create' ? 'create-post' : `${item.user.id}-${index}`
          }
          renderItem={renderSuggestion}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storyList}
          ListFooterComponent={
            loadingSuggestions ? (
              <View style={styles.storyLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
        />
        {!loadingSuggestions && suggestions.length === 0 ? (
          <Text style={[styles.storyEmptyText, { color: colors.textSecondary }]}>
            No suggestions yet—invite friends to get started.
          </Text>
        ) : null}
      </ScreenHeader>

      <LinearGradient
        colors={
          isDark
            ? (['#1E2244', '#151627'] as const)
            : (['#EEF3FF', '#F8F9FF'] as const)
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.engagementCard}
      >
        <View style={styles.engagementContent}>
          <Text style={[styles.engagementTitle, isDark ? null : styles.engagementTitleLight]}>
            Hey {user?.first_name || user?.username || 'there'} 👋
          </Text>
          <Text
            style={[
              styles.engagementSubtitle,
              isDark ? null : styles.engagementSubtitleLight,
            ]}
          >
            Share a moment or catch up with friends right now.
          </Text>
          <View style={styles.engagementActions}>
            <TouchableOpacity
              style={[styles.engagementButton, styles.engagementPrimaryButton]}
              onPress={() => router.push('/(tabs)/create-post')}
            >
              <Ionicons name="create-outline" size={18} color="#FFFFFF" />
              <Text style={styles.engagementPrimaryText}>New Post</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.engagementButton,
                styles.engagementSecondaryButton,
                isDark ? null : styles.engagementSecondaryButtonLight,
              ]}
              onPress={() => router.push('/(tabs)/friends')}
            >
              <Ionicons
                name="people-outline"
                size={18}
                color={isDark ? '#D6DBFF' : '#4650A0'}
              />
              <Text
                style={[
                  styles.engagementSecondaryText,
                  { color: isDark ? '#D6DBFF' : '#4650A0' },
                ]}
              >
                Find Friends
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.engagementHighlights}>
            <View style={styles.highlightItem}>
              <Text
                style={[
                  styles.highlightValue,
                  isDark ? null : styles.highlightValueLight,
                ]}
              >
                {posts.length}
              </Text>
              <Text
                style={[
                  styles.highlightLabel,
                  isDark ? null : styles.highlightLabelLight,
                ]}
              >
                Stories today
              </Text>
            </View>
            <View
              style={[styles.highlightDivider, isDark ? null : styles.highlightDividerLight]}
            />
            <View style={styles.highlightItem}>
              <Text
                style={[
                  styles.highlightValue,
                  isDark ? null : styles.highlightValueLight,
                ]}
              >
                {suggestions.length > 0 ? suggestions.length : '+'}
              </Text>
              <Text
                style={[
                  styles.highlightLabel,
                  isDark ? null : styles.highlightLabelLight,
                ]}
              >
                New connections
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList<FeedPost>
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={
          loadingMore || reachedEnd ? (
            <View style={styles.footerContainer}>
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.footerText, { color: colors.textSecondary }]}>Refresh to see new stuff</Text>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No posts yet. Start following people to see their posts!</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 64, paddingTop: 0 }}
      />
    </View>
  );
}
