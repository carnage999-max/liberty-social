import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  ImageSourcePropType,
  Share,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { apiClient } from '../../utils/api';
import { Post, PaginatedResponse, User, Reaction, ReactionType } from '../../types';
import {
  AmericanBackground,
  ChristmasBackground,
  CloudsBackground,
  SpaceBackground,
  HalloweenBackground,
  OceanBackground,
  NatureBackground,
  ForestBackground,
  StarsBackground,
  ButterfliesBackground,
  DragonsBackground,
  ChristmasTreesBackground,
  MusicNotesBackground,
  PixelHeartsBackground,
  SunsetBackground,
} from '../../components/feed/AnimatedBackgrounds';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import AppNavbar from '../../components/layout/AppNavbar';
import PostActionsMenu from '../../components/feed/PostActionsMenu';
import AdvancedEmojiPicker from '../../components/feed/AdvancedEmojiPicker';
import UserProfileBottomSheet from '../../components/profile/UserProfileBottomSheet';
import { SkeletonPost, Skeleton } from '../../components/common/Skeleton';
import ImageGallery from '../../components/common/ImageGallery';
import FeedBackgroundModal from '../../components/feed/FeedBackgroundModal';
import FeedFilterModal from '../../components/feed/FeedFilterModal';
import { useFeedBackground } from '../../hooks/useFeedBackground';
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
  const { showError, showInfo } = useAlert();
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
  const [advancedEmojiPickerVisible, setAdvancedEmojiPickerVisible] = useState(false);
  const [advancedEmojiPickerPostId, setAdvancedEmojiPickerPostId] = useState<number | null>(null);
  const [profileBottomSheetVisible, setProfileBottomSheetVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | number | null>(null);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [showStickyButtons, setShowStickyButtons] = useState(false);
  const [stickyButtonsHidden, setStickyButtonsHidden] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  
  // Background and Filter states
  const { theme: feedBackgroundTheme, changeTheme, mounted } = useFeedBackground();
  const [backgroundModalVisible, setBackgroundModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [showFriendPosts, setShowFriendPosts] = useState(true);
  const [showPagePosts, setShowPagePosts] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

  // Background image mapping
  const BACKGROUND_IMAGES: Record<string, any> = useMemo(() => ({
    '/backgrounds/american-flag.gif': require('../../assets/backgrounds/american-flag.gif'),
    '/backgrounds/nyan-cat.gif': require('../../assets/backgrounds/nyan-cat.gif'),
    '/backgrounds/christmas-tree.gif': require('../../assets/backgrounds/christmas-tree.gif'),
    '/backgrounds/sunset.gif': require('../../assets/backgrounds/sunset.gif'),
    '/backgrounds/shooting-star.gif': require('../../assets/backgrounds/shooting-star.gif'),
    '/backgrounds/minions-dance.gif': require('../../assets/backgrounds/minions-dance.gif'),
    '/backgrounds/frog-chilling-under-sunset.gif': require('../../assets/backgrounds/frog-chilling-under-sunset.gif'),
    '/backgrounds/cat-lanterns.gif': require('../../assets/backgrounds/cat-lanterns.gif'),
    '/backgrounds/ghost.gif': require('../../assets/backgrounds/ghost.gif'),
    '/backgrounds/dark-stars.png': require('../../assets/backgrounds/dark-stars.png'),
    '/backgrounds/cat-eyes.png': require('../../assets/backgrounds/cat-eyes.png'),
    '/backgrounds/spider-webs.png': require('../../assets/backgrounds/spider-webs.png'),
    '/backgrounds/spider.png': require('../../assets/backgrounds/spider.png'),
    '/backgrounds/gothic-skulls.jpeg': require('../../assets/backgrounds/gothic-skulls.jpeg'),
    '/backgrounds/dragon-chinese-myth.jpeg': require('../../assets/backgrounds/dragon-chinese-myth.jpeg'),
    '/backgrounds/demon-slayer-flame-hashira.jpeg': require('../../assets/backgrounds/demon-slayer-flame-hashira.jpeg'),
    '/backgrounds/nyan-cat-purple.jpeg': require('../../assets/backgrounds/nyan-cat-purple.jpeg'),
    '/backgrounds/green-lightning.jpeg': require('../../assets/backgrounds/green-lightning.jpeg'),
    '/backgrounds/bat-sign.png': require('../../assets/backgrounds/bat-sign.png'),
    '/backgrounds/emojis.png': require('../../assets/backgrounds/emojis.png'),
    '/backgrounds/green-corridor.png': require('../../assets/backgrounds/green-corridor.png'),
    '/backgrounds/illusion.png': require('../../assets/backgrounds/illusion.png'),
    '/backgrounds/kaleidoscope.png': require('../../assets/backgrounds/kaleidoscope.png'),
  }), []);

  // Check if background is an image - recalculate when theme changes
  const isImageBackground = useMemo(() => 
    feedBackgroundTheme.startsWith('/backgrounds/') && BACKGROUND_IMAGES[feedBackgroundTheme],
    [feedBackgroundTheme, BACKGROUND_IMAGES]
  );

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

      // If url is a full URL (absolute), extract just the path and query string
      let endpoint = url || '/feed/';
      
      // If no URL provided, build with filters
      if (!url) {
        const params = new URLSearchParams();
        
        // Add filter params if not at default (showFriend=true, showPage=true, no category)
        if (showFriendPosts !== true || showPagePosts !== true || selectedCategory) {
          params.append('show_friend_posts', showFriendPosts.toString());
          params.append('show_page_posts', showPagePosts.toString());
          if (selectedCategory) {
            params.append('preferred_categories', selectedCategory);
          }
        }
        
        endpoint = `/feed/${params.toString() ? '?' + params.toString() : ''}`;
        console.log('[MOBILE FEED] Loading with filters:', { showFriendPosts, showPagePosts, selectedCategory, endpoint });
      } else if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        try {
          const urlObj = new URL(url);
          endpoint = urlObj.pathname + urlObj.search;
          // Remove /api prefix if present (since baseURL already includes it)
          if (endpoint.startsWith('/api')) {
            endpoint = endpoint.substring(4);
          }
        } catch (e) {
          // If URL parsing fails, try to extract path manually
          const match = url.match(/\/api(\/.*)/);
          if (match) {
            endpoint = match[1];
          } else {
            // Fallback: use the original url but ensure it starts with /
            endpoint = url.startsWith('/') ? url : `/${url}`;
          }
        }
      }

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
  }, [showFriendPosts, showPagePosts, selectedCategory]);

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

  const handleReactionLongPress = (post: FeedPost, event: any) => {
    if (!user) {
      showInfo('Please log in to react to posts.', 'Sign in required');
      return;
    }
    // Open advanced emoji picker directly
    setAdvancedEmojiPickerPostId(post.id);
    setAdvancedEmojiPickerVisible(true);
  };

  // Map reaction types to emojis (for backward compatibility)
  const REACTION_TYPE_TO_EMOJI: Record<string, string> = {
    "like": "👍",
    "love": "❤️",
    "haha": "😂",
    "sad": "😢",
    "angry": "😠",
  };

  // Convert reaction type to emoji (handles both old text types and new emoji types)
  const getReactionEmoji = (reactionType: string): string => {
    if (REACTION_TYPE_TO_EMOJI[reactionType]) {
      return REACTION_TYPE_TO_EMOJI[reactionType];
    }
    return reactionType; // Already an emoji
  };

  const handleReactionSelect = async (postId: number, reactionType: ReactionType) => {
    if (!user) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    // Convert reaction type to emoji
    const emoji = getReactionEmoji(reactionType);

    const existingReaction = (post.reactions || []).find(
      (reaction) => reaction.user?.id === user.id
    );

    setReactionBusy((prev) => ({ ...prev, [postId]: true }));

    const previousPosts = posts;
    const optimisticReactionId = -Math.floor(Math.random() * 1_000_000) - 1;

    if (existingReaction) {
      if (getReactionEmoji(existingReaction.reaction_type) === emoji) {
        // Remove reaction if same emoji
        setPosts((prev) =>
          prev.map((item) =>
            item.id === postId
              ? {
                  ...item,
                  reactions: (item.reactions || []).filter(
                    (reaction) => reaction.id !== existingReaction.id
                  ),
                }
              : item
          )
        );
        animateLikeState(postId, false);
      } else {
        // Update reaction type
        const optimisticReaction: Reaction = {
          ...existingReaction,
          id: optimisticReactionId,
          reaction_type: emoji as ReactionType,
        };
        setPosts((prev) =>
          prev.map((item) =>
            item.id === postId
              ? {
                  ...item,
                  reactions: [
                    ...((item.reactions || []).filter(
                      (reaction) => reaction.id !== existingReaction.id
                    ) || []),
                    optimisticReaction,
                  ],
                }
              : item
          )
        );
        animateLikeState(postId, true);
      }
    } else {
      // Add new reaction
      const optimisticReaction: Reaction = {
        id: optimisticReactionId,
        reaction_type: emoji as ReactionType,
        created_at: new Date().toISOString(),
        user,
      };
      setPosts((prev) =>
        prev.map((item) =>
          item.id === postId
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
      animateLikeState(postId, true);
    }

    try {
      if (existingReaction) {
        if (getReactionEmoji(existingReaction.reaction_type) === emoji) {
          // Remove reaction - try to delete, but handle 404 gracefully
          // The 404 can occur if the reaction was already deleted or doesn't exist
          try {
            if (existingReaction.id && existingReaction.id > 0) {
          await apiClient.delete(`/reactions/${existingReaction.id}/`);
            }
          } catch (deleteError: any) {
            // If 404, the reaction might have already been deleted or doesn't exist
            // This is fine - the optimistic update already removed it from the UI
            if (deleteError?.response?.status !== 404) {
              // Only throw if it's not a 404 - other errors should be handled
              console.warn('Error deleting reaction (non-404):', deleteError);
            }
            // For 404, we silently continue as the reaction is already removed from UI
          }
        } else {
          // Update reaction type - POST will handle deletion of old reaction
          const savedReaction = await apiClient.post<Reaction>('/reactions/', {
            post: postId,
            reaction_type: emoji,
          });
          setPosts((prev) =>
            prev.map((item) =>
              item.id === postId
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
      } else {
        const savedReaction = await apiClient.post<Reaction>('/reactions/', {
          post: postId,
          reaction_type: emoji,
        });
        setPosts((prev) =>
          prev.map((item) =>
            item.id === postId
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
      showError('Please try again in a moment.', 'Unable to update reaction');
      setPosts(previousPosts);
    } finally {
      setReactionBusy((prev) => ({ ...prev, [postId]: false }));
    }
  };

  // Handle custom emoji reaction selection (from advanced picker)
  const handleEmojiReactionSelect = async (postId: number, emoji: string) => {
    if (!user) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const existingReaction = (post.reactions || []).find(
      (reaction) => reaction.user?.id === user.id
    );

    setReactionBusy((prev) => ({ ...prev, [postId]: true }));

    const previousPosts = posts;
    const optimisticReactionId = -Math.floor(Math.random() * 1_000_000) - 1;

    if (existingReaction) {
      if (existingReaction.reaction_type === emoji) {
        // Remove reaction if same emoji
        setPosts((prev) =>
          prev.map((item) =>
            item.id === postId
              ? {
                  ...item,
                  reactions: (item.reactions || []).filter(
                    (reaction) => reaction.id !== existingReaction.id
                  ),
                }
              : item
          )
        );
        animateLikeState(postId, false);
      } else {
        // Update reaction type
        const optimisticReaction: Reaction = {
          ...existingReaction,
          id: optimisticReactionId,
          reaction_type: emoji as ReactionType,
        };
        setPosts((prev) =>
          prev.map((item) =>
            item.id === postId
              ? {
                  ...item,
                  reactions: [
                    ...((item.reactions || []).filter(
                      (reaction) => reaction.id !== existingReaction.id
                    ) || []),
                    optimisticReaction,
                  ],
                }
              : item
          )
        );
        animateLikeState(postId, true);
      }
    } else {
      // Add new reaction
      const optimisticReaction: Reaction = {
        id: optimisticReactionId,
        reaction_type: emoji as ReactionType,
        created_at: new Date().toISOString(),
        user,
      };
      setPosts((prev) =>
        prev.map((item) =>
          item.id === postId
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
      animateLikeState(postId, true);
    }

    try {
      if (existingReaction) {
        if (existingReaction.reaction_type === emoji) {
          await apiClient.delete(`/reactions/${existingReaction.id}/`);
        } else {
          await apiClient.delete(`/reactions/${existingReaction.id}/`);
          const savedReaction = await apiClient.post<Reaction>('/reactions/', {
            post: postId,
            reaction_type: emoji,
          });
          setPosts((prev) =>
            prev.map((item) =>
              item.id === postId
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
      } else {
        const savedReaction = await apiClient.post<Reaction>('/reactions/', {
          post: postId,
          reaction_type: emoji,
        });
        setPosts((prev) =>
          prev.map((item) =>
            item.id === postId
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
      showError('Please try again in a moment.', 'Unable to update reaction');
      setPosts(previousPosts);
    } finally {
      setReactionBusy((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleToggleLike = async (post: FeedPost) => {
    if (!user) {
      showInfo('Please log in to react to posts.', 'Sign in required');
      return;
    }

    const existingReaction = (post.reactions || []).find(
      (reaction) => reaction.user?.id === user.id
    );

    if (existingReaction) {
      // Remove reaction
      const currentEmoji = getReactionEmoji(existingReaction.reaction_type);
      // Convert emoji back to type for the handler
      const reactionType = Object.keys(REACTION_TYPE_TO_EMOJI).find(
        key => REACTION_TYPE_TO_EMOJI[key] === currentEmoji
      ) || 'like';
      await handleReactionSelect(post.id, reactionType as ReactionType);
    } else {
      // Add like reaction
      await handleReactionSelect(post.id, 'like');
    }
  };

  // Handle double-tap to like
  const [doubleTapAnimation, setDoubleTapAnimation] = useState<{ postId: number; show: boolean } | null>(null);
  const lastTapRef = useRef<{ postId: number; time: number } | null>(null);
  const doubleTapAnimationsRef = useRef<Record<number, Animated.Value>>({});

  const getDoubleTapAnimation = useCallback(
    (postId: number) => {
      if (!doubleTapAnimationsRef.current[postId]) {
        doubleTapAnimationsRef.current[postId] = new Animated.Value(0);
      }
      return doubleTapAnimationsRef.current[postId];
    },
    []
  );

  const handleDoubleTap = useCallback(
    (postId: number) => {
      if (!user) {
        showInfo('Please log in to react to posts.', 'Sign in required');
        return;
      }

      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      // Check if user already has a reaction
      const existingReaction = (post.reactions || []).find(
        (reaction) => reaction.user?.id === user.id
      );

      // Show animation
      const anim = getDoubleTapAnimation(postId);
      setDoubleTapAnimation({ postId, show: true });
      
      Animated.sequence([
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 7,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setDoubleTapAnimation((prev) => prev?.postId === postId ? { postId, show: false } : prev);
      });

      // If user already has a 'like' reaction, remove it; otherwise add it
      if (existingReaction) {
        const existingEmoji = getReactionEmoji(existingReaction.reaction_type);
        const likeEmoji = getReactionEmoji('like');
        if (existingEmoji === likeEmoji) {
          // Remove the reaction
      handleReactionSelect(postId, 'like');
        } else {
          // Change to like
          handleReactionSelect(postId, 'like');
        }
      } else {
        // Add like reaction
        handleReactionSelect(postId, 'like');
      }
    },
    [user, handleReactionSelect, getDoubleTapAnimation, posts]
  );

  const handlePostPress = useCallback(
    (postId: number) => {
      const now = Date.now();
      const lastTap = lastTapRef.current;

      if (lastTap && lastTap.postId === postId && now - lastTap.time < 400) {
        // Double tap detected
        handleDoubleTap(postId);
        lastTapRef.current = null;
      } else {
        // Single tap - store for potential double tap
        lastTapRef.current = { postId, time: now };
        setTimeout(() => {
          if (lastTapRef.current?.postId === postId) {
            lastTapRef.current = null;
          }
        }, 400);
      }
    },
    [handleDoubleTap]
  );

  const handleSharePost = async (post: FeedPost) => {
    try {
      const shareUrl = `https://mylibertysocial.com/app/feed/${post.slug ?? post.id}`;
      const shareMessage = [post.content, shareUrl]
        .filter(Boolean)
        .join('\n\n');

      await Share.share({
        message: shareMessage,
        title: 'Share post',
      });
    } catch (error) {
      console.error('Error sharing post:', error);
      showError('Please try again later.', 'Unable to share');
    }
  };

  const handlePostUpdated = (nextPost: FeedPost) => {
    const normalized = normalizePost(nextPost);
    setPosts((prev) => prev.map((item) => (item.id === normalized.id ? normalized : item)));
  };

  const handlePostDeleted = (postId: number) => {
    setPosts((prev) => prev.filter((item) => String(item.id) !== String(postId)));
  };

  useEffect(() => {
    loadFeed();
    loadSuggestions();
  }, [loadFeed, loadSuggestions]);

  useEffect(() => {
    const listener = (navigation as any)?.addListener?.('tabPress', () => {
      // Scroll to top
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      // Refresh feed
      triggerRefresh();
    });
    return typeof listener === 'function' ? listener : undefined;
  }, [navigation, triggerRefresh]);

  // Debug log for background theme changes
  useEffect(() => {
    const isImage = feedBackgroundTheme.startsWith('/backgrounds/');
    const hasMapping = isImage && BACKGROUND_IMAGES[feedBackgroundTheme];
    console.log('Feed background theme:', feedBackgroundTheme, 'mounted:', mounted, 'isImage:', isImage, 'hasMapping:', hasMapping);
  }, [feedBackgroundTheme, mounted]);

  // Swipe gesture to open messages - Pan gesture from left edge
  const swipeGesture = Gesture.Pan()
    .activeOffsetX(20) // Activate when moving right at least 20px
    .onEnd((event) => {
      // Swipe right from left edge to open messages
      // Must swipe at least 80px to the right with positive velocity
      if (event.translationX > 80 && event.velocityX > 100) {
        console.log('Swipe right detected - navigating to messages');
        router.push('/(tabs)/messages');
      }
    });

  const renderPost = ({ item }: { item: FeedPost }) => {
    // For page posts, show page name instead of author name
    const isPagePost = (item as any).author_type === 'page' || (item as any).page !== null && (item as any).page !== undefined;
    const displayName = isPagePost && (item as any).page
      ? (item as any).page.name
      : buildDisplayName(item.author);
    
    // For page posts, use page profile image; for user posts, use author avatar
    const avatarUrl = isPagePost && (item as any).page?.profile_image_url
      ? resolveRemoteUrl((item as any).page.profile_image_url)
      : null;
    const avatarSource = avatarUrl ? { uri: avatarUrl } : item.authorAvatar;

    const galleryUrls: string[] =
      item.mediaUrls && item.mediaUrls.length
        ? item.mediaUrls
        : resolveMediaUrls(Array.isArray(item.media) ? (item.media as any) : []);

    const reactionCount = (item.reactions || []).length;
    const commentCount = item.comments?.length || 0;
    const currentUserReaction = user
      ? (item.reactions || []).find((reaction) => reaction.user?.id === user.id)
      : null;
    const hasReacted = !!currentUserReaction;
    const reactionEmoji = currentUserReaction ? getReactionEmoji(currentUserReaction.reaction_type) : null;
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
        {/* Double-tap like animation */}
        {doubleTapAnimation?.postId === item.id && doubleTapAnimation.show && (
          <View style={styles.doubleTapAnimationContainer} pointerEvents="none">
            <Animated.Text
              style={[
                styles.doubleTapEmoji,
                {
                  transform: [
                    {
                      scale: getDoubleTapAnimation(item.id).interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 1.3, 1],
                      }),
                    },
                  ],
                  opacity: getDoubleTapAnimation(item.id).interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 1, 0],
                  }),
                },
              ]}
            >
              👍
            </Animated.Text>
          </View>
        )}
        <View style={styles.postHeaderRow}>
          <TouchableOpacity
            style={styles.postHeader}
            onPress={() => {
              if (isPagePost && (item as any).page) {
                router.push(`/pages/${(item as any).page.slug ?? (item as any).page.id}`);
              } else {
              setSelectedUserId(item.author.id);
              setProfileBottomSheetVisible(true);
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

        <TouchableOpacity
          activeOpacity={1}
          onPress={() => handlePostPress(item.id)}
          style={styles.postContentWrapper}
        >
        {item.content && (
          <Text style={[styles.postContent, { color: colors.text }]}>{item.content}</Text>
        )}

        {galleryUrls.length > 0 && (
          <View
            style={[
              styles.mediaGrid,
              galleryUrls.length === 1
                ? styles.mediaGridSingle
                : galleryUrls.length === 2
                ? styles.mediaGridDouble
                : styles.mediaGridTriple,
            ]}
          >
            {galleryUrls.slice(0, 9).map((url, index) => (
              <TouchableOpacity
                key={`${item.id}-media-${index}`}
                style={[
                  styles.mediaImageWrapper,
                  galleryUrls.length === 1
                    ? styles.mediaImageSingle
                    : galleryUrls.length === 2
                    ? styles.mediaImageDouble
                    : styles.mediaImageTriple,
                ]}
                onPress={() => {
                  setGalleryImages(galleryUrls);
                  setGalleryIndex(index);
                  setGalleryVisible(true);
                }}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: url }}
                  style={styles.mediaImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                  placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
        </TouchableOpacity>

        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleToggleLike(item)}
            onLongPress={(e) => handleReactionLongPress(item, e)}
            disabled={likeProcessing}
          >
            {hasReacted && reactionEmoji ? (
              <Text style={styles.reactionEmoji}>{reactionEmoji}</Text>
            ) : (
              <Ionicons
                name="heart-outline"
                size={20}
                color={colors.textSecondary}
              />
            )}
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>
              {reactionCount}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/(tabs)/feed/${item.slug ?? item.id}`)}
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

          {item.bookmarked && (
            <View style={styles.actionButton}>
              <Ionicons name="bookmark" size={20} color="#C8A25F" />
            </View>
          )}
        </View>
      </View>
    );
  };

  const handleDismissSuggestion = async (userId: string | number) => {
    try {
      await apiClient.post('/auth/dismissed-suggestions/', {
        dismissed_user_id: userId,
      });
      // Remove from local suggestions
      setSuggestions((prev) => prev.filter((user) => user.id !== userId));
    } catch (error) {
      // Silently fail - suggestion will be filtered out on next load
    }
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
              <Ionicons name="add" size={24} color="#C8A25F" />
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
      <View style={styles.storyItem}>
        <TouchableOpacity
          onPress={() => {
            setSelectedUserId(item.user.id);
            setProfileBottomSheetVisible(true);
          }}
        >
          <Image 
            source={avatarSource} 
            style={styles.storyAvatar} 
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
          <Text style={[styles.storyName, { color: colors.text }]} numberOfLines={1}>
            {displayName}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={() => handleDismissSuggestion(item.user.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    imageBackgroundContainer: {
      backgroundColor: 'transparent',
    },
    gradientBackgroundContainer: {
      backgroundColor: 'transparent',
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
      gap: 12,
      paddingBottom: 8,
      flex: 0,
    },
    storyList: {
      paddingVertical: 8,
      paddingLeft: 12,
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
      textShadowColor: 'rgba(0, 0, 0, 0.8)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    dismissButton: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderRadius: 12,
      padding: 2,
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
    postContentWrapper: {
      marginBottom: 0,
    },
    postContent: {
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 12,
    },
    mediaGrid: {
      gap: 8,
      marginBottom: 12,
    },
    mediaGridSingle: {
      flexDirection: 'row',
    },
    mediaGridDouble: {
      flexDirection: 'row',
    },
    mediaGridTriple: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    mediaImageWrapper: {
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.border,
    },
    mediaImageSingle: {
      width: '100%',
      aspectRatio: 16 / 9,
    },
    mediaImageDouble: {
      flex: 1,
      aspectRatio: 1,
      marginRight: 8,
    },
    mediaImageTriple: {
      width: '31%',
      aspectRatio: 1,
    },
    mediaImage: {
      width: '100%',
      height: '100%',
    },
    reactionEmoji: {
      fontSize: 20,
    },
    doubleTapAnimationContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    doubleTapEmoji: {
      fontSize: 64,
    },
    suggestionsHeader: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
    },
    suggestionsTitle: {
      fontSize: 18,
      fontWeight: '700',
      textShadowColor: 'rgba(0, 0, 0, 0.8)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    suggestionsList: {
      paddingBottom: 8,
      height: 'auto',
      flexShrink: 1,
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
      marginVertical: 8,
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
    // Filter buttons row in header
    filterButtonsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    // Sticky buttons container
    stickyButtonsContainer: {
      position: 'absolute',
      top: 102, // Navbar height: ~44 (status bar) + 8 (padding) + 40 (content) + 12 (bottom padding) - 2 (border)
      right: 12,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      zIndex: 999,
      paddingTop: 6,
      paddingBottom: 4,
    },
    metallicButton: {
      width: 110,
      height: 34,
      borderRadius: 10,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 5,
    },
    metallicButtonGradient: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(0, 0, 0, 0.25)',
    },
    metallicButtonText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#192A4A',
      letterSpacing: 0.2,
      textShadowColor: 'rgba(255, 255, 255, 0.6)',
      textShadowOffset: { width: 0, height: 0.5 },
      textShadowRadius: 1,
    },
    hideButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(25, 42, 74, 0.9)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#C8A25F',
      marginLeft: 4,
    },
    // Background styles
    backgroundImage: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
      zIndex: -1,
    },
    backgroundGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
      zIndex: -1,
    },
    backgroundOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 300,
      zIndex: -1,
    },
  });

  if (loading && posts.length === 0) {
    return (
      <View style={styles.container}>
        <AppNavbar showProfileImage={false} />
        <FlatList
          data={[1, 2, 3, 4, 5]}
          renderItem={() => <SkeletonPost />}
          keyExtractor={(item) => item.toString()}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  const renderListHeader = () => (
    <View style={styles.listHeaderWrapper}>
      <View style={styles.suggestionsHeader}>
        <Text style={[styles.suggestionsTitle, { color: colors.text }]}>People you may know</Text>
      </View>
      <View style={styles.suggestionsList}>
        <FlatList
          horizontal
          scrollEnabled={true}
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
                <Skeleton width={60} height={60} borderRadius={30} />
              </View>
            ) : null
          }
        />
        {!loadingSuggestions && suggestions.length === 0 ? (
          <Text style={[styles.storyEmptyText, { color: colors.textSecondary }]}>
            No suggestions yet—invite friends to get started.
          </Text>
        ) : null}
      </View>

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
              style={[
                styles.engagementButton, 
                styles.engagementPrimaryButton,
                {
                  backgroundColor: '#192A4A',
                  borderWidth: 1,
                  borderColor: '#C8A25F',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.4,
                  shadowRadius: 4,
                  elevation: 4,
                },
              ]}
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
        </View>
      </LinearGradient>
      
      {/* Background and Filter Buttons - Hide when scrolled */}
      <Animated.View 
        style={[
          styles.filterButtonsRow,
          {
            opacity: scrollY.interpolate({
              inputRange: [0, 300, 350],
              outputRange: [1, 1, 0],
              extrapolate: 'clamp',
            }),
          },
        ]}
        pointerEvents={!showStickyButtons ? 'auto' : 'none'}
      >
        <TouchableOpacity
          style={styles.metallicButton}
          onPress={() => setBackgroundModalVisible(true)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#a8862a', '#d7b756', '#a8862a']}
            style={styles.metallicButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="color-palette" size={16} color="#192A4A" />
            <Text style={styles.metallicButtonText}>Background</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.metallicButton}
          onPress={() => setFilterModalVisible(true)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#a8862a', '#d7b756', '#a8862a']}
            style={styles.metallicButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="funnel" size={16} color="#192A4A" />
            <Text style={styles.metallicButtonText}>Filters</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  // Get background colors for themed backgrounds
  const getBackgroundColors = (): [string, string, string] => {
    switch (feedBackgroundTheme) {
      case 'clouds':
        return ['#E3F2FD', '#BBDEFB', '#90CAF9'] as const;
      case 'nature':
        return ['#F1F8E9', '#DCEDC8', '#C5E1A5'] as const;
      case 'space':
        return ['#1A237E', '#283593', '#3949AB'] as const;
      case 'ocean':
        return ['#E1F5FE', '#B3E5FC', '#81D4FA'] as const;
      case 'forest':
        return ['#E8F5E9', '#C8E6C9', '#A5D6A7'] as const;
      case 'sunset':
        return ['#FFF3E0', '#FFCCBC', '#FFAB91'] as const;
      case 'stars':
        return ['#0D1B2A', '#1B263B', '#415A77'] as const;
      case 'american':
        return ['#B22234', '#FFFFFF', '#3C3B6E'] as const;
      case 'christmas':
        return ['#165B33', '#BB2528', '#F8F8F8'] as const;
      case 'halloween':
        return ['#FF6600', '#1A1A1A', '#FFA500'] as const;
      case 'butterflies':
        return ['#FFF0F5', '#FFE4E1', '#FFB6C1'] as const;
      case 'dragons':
        return ['#2C1810', '#8B4513', '#CD853F'] as const;
      case 'christmas-trees':
        return ['#0B6623', '#228B22', '#32CD32'] as const;
      case 'music-notes':
        return ['#663399', '#9370DB', '#BA55D3'] as const;
      case 'pixel-hearts':
        return ['#FF1744', '#F50057', '#C51162'] as const;
      default:
        return [colors.background, colors.background, colors.background] as const;
    }
  };

  // Apply background based on theme
  const containerStyle = [
    styles.container,
    mounted && isImageBackground && styles.imageBackgroundContainer,
    mounted && !isImageBackground && feedBackgroundTheme !== 'default' && styles.gradientBackgroundContainer,
  ];

  // Check if theme has animated background (all themes now have animations!)
  const hasAnimatedBackground = [
    'american',
    'christmas',
    'halloween',
    'clouds',
    'nature',
    'space',
    'ocean',
    'forest',
    'sunset',
    'stars',
    'butterflies',
    'dragons',
    'christmas-trees',
    'music-notes',
    'pixel-hearts',
  ].includes(feedBackgroundTheme);

  // Render animated background component
  const renderAnimatedBackground = () => {
    if (!mounted || feedBackgroundTheme === 'default') return null;

    switch (feedBackgroundTheme) {
      case 'american':
        return <AmericanBackground />;
      case 'christmas':
        return <ChristmasBackground />;
      case 'clouds':
        return <CloudsBackground />;
      case 'space':
        return <SpaceBackground />;
      case 'halloween':
        return <HalloweenBackground />;
      case 'ocean':
        return <OceanBackground />;
      case 'nature':
        return <NatureBackground />;
      case 'forest':
        return <ForestBackground />;
      case 'stars':
        return <StarsBackground />;
      case 'butterflies':
        return <ButterfliesBackground />;
      case 'dragons':
        return <DragonsBackground />;
      case 'christmas-trees':
        return <ChristmasTreesBackground />;
      case 'music-notes':
        return <MusicNotesBackground />;
      case 'pixel-hearts':
        return <PixelHeartsBackground />;
      case 'sunset':
        return <SunsetBackground />;
      default:
        return null;
    }
  };

  return (
      <View style={containerStyle}>
        {/* Image Background Layer */}
        {mounted && isImageBackground && (
          <Image
            source={BACKGROUND_IMAGES[feedBackgroundTheme]}
            style={styles.backgroundImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        )}
        
        {/* Animated Background Layer (for specific themes) */}
        {mounted && !isImageBackground && hasAnimatedBackground && renderAnimatedBackground()}
        
        {/* Gradient Background Layer (for themes without animations) */}
        {mounted && !isImageBackground && !hasAnimatedBackground && feedBackgroundTheme !== 'default' && (
          <>
            <LinearGradient
              colors={getBackgroundColors()}
              style={styles.backgroundGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            {/* Dark overlay at top for text visibility */}
            <LinearGradient
              colors={['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.2)', 'transparent']}
              style={styles.backgroundOverlay}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              locations={[0, 0.3, 0.6]}
            />
          </>
        )}

        {/* Left Edge Swipe Detector for Messages */}
        <GestureDetector gesture={swipeGesture}>
          <View style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 40,
            zIndex: 1000,
          }} />
        </GestureDetector>
        
        <AppNavbar />
      
      {/* Sticky Buttons - Show when scrolled past the header buttons */}
      {!stickyButtonsHidden && (
        <Animated.View
          style={[
            styles.stickyButtonsContainer,
            {
              opacity: scrollY.interpolate({
                inputRange: [0, 350, 400],
                outputRange: [0, 0, 1],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  translateY: scrollY.interpolate({
                    inputRange: [0, 350, 400],
                    outputRange: [-40, -40, 0],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
          pointerEvents={showStickyButtons ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={styles.metallicButton}
            onPress={() => setBackgroundModalVisible(true)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#a8862a', '#d7b756', '#a8862a']}
              style={styles.metallicButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="color-palette" size={16} color="#192A4A" />
              <Text style={styles.metallicButtonText}>Background</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metallicButton}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#a8862a', '#d7b756', '#a8862a']}
              style={styles.metallicButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="funnel" size={16} color="#192A4A" />
              <Text style={styles.metallicButtonText}>Filters</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.hideButton}
            onPress={() => setStickyButtonsHidden(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle" size={20} color="#C8A25F" />
          </TouchableOpacity>
        </Animated.View>
      )}
      
      <AdvancedEmojiPicker
        visible={advancedEmojiPickerVisible}
        onClose={() => {
          setAdvancedEmojiPickerVisible(false);
          setAdvancedEmojiPickerPostId(null);
        }}
        onSelect={(emoji) => {
          if (advancedEmojiPickerPostId) {
            handleEmojiReactionSelect(advancedEmojiPickerPostId, emoji);
          }
        }}
        currentReaction={
          advancedEmojiPickerPostId
            ? (posts.find((p) => p.id === advancedEmojiPickerPostId)?.reactions || []).find(
                (r) => r.user?.id === user?.id
              )?.reaction_type || null
            : null
        }
      />
      <FlatList<FeedPost>
        ref={flatListRef}
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#C8A25F"
          />
        }
        onScroll={(event) => {
          const currentScrollY = event.nativeEvent.contentOffset.y;
          scrollY.setValue(currentScrollY);
          // Show sticky buttons when scrolled past the engagement card and filter buttons
          setShowStickyButtons(currentScrollY > 350);
        }}
        scrollEventThrottle={16}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={
          loadingMore || reachedEnd ? (
            <View style={styles.footerContainer}>
              {loadingMore ? (
                <SkeletonPost />
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
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 0 }}
        removeClippedSubviews={true}
        windowSize={10}
        initialNumToRender={8}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
      />

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

      {/* Background Modal */}
      <FeedBackgroundModal
        visible={backgroundModalVisible}
        onClose={() => setBackgroundModalVisible(false)}
        currentTheme={feedBackgroundTheme}
        onThemeChange={(theme: string) => {
          changeTheme(theme);
          setBackgroundModalVisible(false);
        }}
      />

      {/* Filter Modal */}
      <FeedFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        currentShowFriendPosts={showFriendPosts}
        currentShowPagePosts={showPagePosts}
        currentSelectedCategory={selectedCategory}
        onFiltersChange={(filters: { showFriendPosts: boolean; showPagePosts: boolean; selectedCategory?: string }) => {
          setShowFriendPosts(filters.showFriendPosts);
          setShowPagePosts(filters.showPagePosts);
          setSelectedCategory(filters.selectedCategory);
          setFilterModalVisible(false);
          // Refresh feed with new filters
          loadFeed();
        }}
      />
      </View>
  );
}
