import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  FlatList,
  TextInput,
  Share,
  KeyboardAvoidingView,
  Platform,
  Animated,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { resolveRemoteUrl, DEFAULT_AVATAR, resolveMediaUrls } from '../../utils/url';
import ImageGallery from '../../components/common/ImageGallery';
import ContextMenu from '../../components/common/ContextMenu';
import { Modal } from 'react-native';
import InviteUsersModal from '../../components/pages/InviteUsersModal';
import CreatePagePostModal from '../../components/pages/CreatePagePostModal';
import SendAdminInviteModal from '../../components/pages/SendAdminInviteModal';
import * as ImagePicker from 'expo-image-picker';
import { getApiBase } from '../../constants/API';
import { storage } from '../../utils/storage';
import { Post, PaginatedResponse, Reaction, ReactionType } from '../../types';
import PostActionsMenu from '../../components/feed/PostActionsMenu';
import AdvancedEmojiPicker from '../../components/feed/AdvancedEmojiPicker';
import UserProfileBottomSheet from '../../components/profile/UserProfileBottomSheet';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE } from '../../constants/API';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TabType = 'overview' | 'about' | 'contact' | 'photos';

interface BusinessPage {
  id: number;
  name: string;
  description?: string;
  category?: string;
  profile_image_url?: string;
  cover_image_url?: string;
  followers_count?: number;
  follower_count?: number; // API returns this field
  is_following: boolean;
  is_verified?: boolean;
  website_url?: string;
  phone?: string;
  email?: string;
  created_at: string;
  owner?: {
    id: string;
  };
  can_manage?: boolean;
  user_role?: 'owner' | 'admin' | 'moderator' | 'editor';
}

export default function PageDetailScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [page, setPage] = useState<BusinessPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryPhotoToPostMap, setGalleryPhotoToPostMap] = useState<Record<string, number>>({});
  const [galleryPostId, setGalleryPostId] = useState<number | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [canPost, setCanPost] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showAdminInviteModal, setShowAdminInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [nextPosts, setNextPosts] = useState<string | null>(null);
  const [postContent, setPostContent] = useState('');
  const [postImages, setPostImages] = useState<Array<{ uri: string }>>([]);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [reactingPosts, setReactingPosts] = useState<Record<number, boolean>>({});
  const [reactionBusy, setReactionBusy] = useState<Record<number, boolean>>({});
  const [doubleTapAnimation, setDoubleTapAnimation] = useState<{ postId: number; show: boolean } | null>(null);
  const lastTapRef = useRef<{ postId: number; time: number } | null>(null);
  const likeAnimationsRef = useRef<Record<number, Animated.Value>>({});
  const doubleTapAnimationsRef = useRef<Record<number, Animated.Value>>({});
  const [advancedEmojiPickerVisible, setAdvancedEmojiPickerVisible] = useState(false);
  const [advancedEmojiPickerPostId, setAdvancedEmojiPickerPostId] = useState<number | null>(null);
  const [profileBottomSheetVisible, setProfileBottomSheetVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | number | null>(null);

  const handleOpenLink = async (url: string) => {
    if (!url) return;
    // Ensure URL has a scheme
    const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    try {
      await WebBrowser.openBrowserAsync(fullUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        toolbarColor: colors.background,
        controlsColor: colors.primary,
      });
    } catch (error) {
      showError('Could not open link');
      console.error('Error opening link:', error);
    }
  };

  useEffect(() => {
    loadPage();
  }, [id]);

  useEffect(() => {
    if (page) {
      checkCanManage();
      if (activeTab === 'overview' || activeTab === 'photos') {
        loadPosts();
      }
    }
  }, [page, activeTab]);

  const loadPage = async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      const response = await apiClient.get<any>(`/pages/${id}/`);
      // API returns follower_count, map it to followers_count for consistency
      const pageData: BusinessPage = {
        ...response,
        followers_count: response.follower_count || response.followers_count || 0,
      };
      setPage(pageData);
      // Set canPost based on user_role or can_manage - this is the primary check
      const canPostValue = pageData.user_role === 'owner' || pageData.user_role === 'admin' || pageData.user_role === 'moderator' || pageData.can_manage;
      console.log('Page data:', { user_role: pageData.user_role, can_manage: pageData.can_manage, canPost: canPostValue, followers_count: pageData.followers_count });
      setCanPost(canPostValue);
      if (activeTab === 'overview') {
        loadPosts();
      }
    } catch (error) {
      showError('Failed to load page');
      console.error(error);
      if (!isRefresh) {
        router.push('/(tabs)/pages');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await apiClient.get<any>(`/pages/${id}/`);
      const pageData: BusinessPage = {
        ...response,
        followers_count: response.follower_count || response.followers_count || 0,
      };
      setPage(pageData);
      const canPostValue = pageData.user_role === 'owner' || pageData.user_role === 'admin' || pageData.user_role === 'moderator' || pageData.can_manage;
      setCanPost(canPostValue);
      if (activeTab === 'overview' || activeTab === 'photos') {
        // Reload posts
        setLoadingPosts(true);
        try {
          const postsResponse = await apiClient.get<PaginatedResponse<Post>>(`/pages/${id}/posts/`);
          setPosts(postsResponse.results || []);
          setNextPosts(postsResponse.next || null);
        } catch (error) {
          console.error('Failed to load posts:', error);
        } finally {
          setLoadingPosts(false);
        }
      }
    } catch (error) {
      showError('Failed to refresh page');
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  }, [id, activeTab, showError]);

  const checkCanManage = async () => {
    if (!page || !user) {
      setCanManage(false);
      // Don't reset canPost here - it's already set in loadPage
      return;
    }
    try {
      await apiClient.get(`/pages/${page.id}/admins/`);
      setCanManage(true);
      // Ensure canPost is set if user can manage
      if (!canPost && (page.user_role === 'owner' || page.user_role === 'admin' || page.user_role === 'moderator' || page.can_manage)) {
        setCanPost(true);
      }
    } catch (error) {
      setCanManage(false);
      // Don't reset canPost - keep the value from loadPage
      // Only set it if user_role clearly allows posting
      if (page.user_role === 'owner' || page.user_role === 'admin' || page.user_role === 'moderator') {
        setCanPost(true);
      }
    }
  };

  const loadPosts = async (append = false) => {
    if (!page) return;
    try {
      if (!append) {
        setLoadingPosts(true);
      }
      const url = append && nextPosts ? nextPosts : `/pages/${page.id}/posts/`;
      const response = await apiClient.get<PaginatedResponse<Post>>(url);
      if (append) {
        setPosts((prev) => [...prev, ...(response.results || [])]);
      } else {
        setPosts(response.results || []);
      }
      setNextPosts(response.next);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoadingPosts(false);
    }
  };

  const loadMorePosts = useCallback(() => {
    if (nextPosts && !loadingPosts && page) {
      loadPosts(true);
    }
  }, [nextPosts, loadingPosts, page]);

  const handleFollowToggle = async () => {
    if (!page) return;
    try {
      const response = await apiClient.post<{ following: boolean; follower_count: number }>(`/pages/${page.id}/follow/`, {});
      const newFollowingState = response.following;
      showSuccess(newFollowingState ? 'Following page' : 'Unfollowed page');
      // Reload page to get updated followers_count
      await loadPage();
    } catch (error) {
      showError('Failed to update follow status');
      console.error(error);
    }
  };

  const handleShare = async () => {
    if (!page) return;
    try {
      const pageUrl = `https://mylibertysocial.com/app/pages/${page.id}`;
      await Share.share({
        message: `Check out ${page.name} on Liberty Social: ${pageUrl}`,
        title: page.name,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handlePickImages = async () => {
    if (postImages.length >= 6) {
      showError('You can upload up to 6 images per post.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 6 - postImages.length,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => ({
          uri: asset.uri,
        }));
        setPostImages(prev => [...prev, ...newImages]);
      }
    } catch (error) {
      showError('Failed to pick images');
    }
  };

  const handleRemoveImage = (index: number) => {
    setPostImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitPost = async () => {
    if (!page || !postContent.trim()) return;

    setSubmittingPost(true);
    try {
      // Upload images if any
      const uploadedUrls: string[] = [];
      if (postImages.length > 0) {
        for (const image of postImages) {
          try {
            // Use fetch directly like profile image upload (axios has issues with React Native FormData)
            const base = getApiBase();
            const url = `${base.replace(/\/+$/, '')}/uploads/images/`;
            const accessToken = await storage.getAccessToken();
            
            // Create FormData fresh for each upload
            const formData = new FormData();
            const filename = image.uri.split('/').pop() || 'image.jpg';
            formData.append('file', {
              uri: image.uri,
              type: 'image/jpeg',
              name: filename,
            } as any);

            const response = await fetch(url, {
              method: 'POST',
              headers: accessToken ? {
                Authorization: `Bearer ${accessToken}`,
              } : {},
              body: formData,
            });

            if (!response.ok) {
              throw new Error('Upload failed');
            }

            const uploadResponse = await response.json();
            if (uploadResponse.url) {
              uploadedUrls.push(uploadResponse.url);
            } else if (uploadResponse.urls && Array.isArray(uploadResponse.urls) && uploadResponse.urls.length > 0) {
              uploadedUrls.push(...uploadResponse.urls);
            }
          } catch (uploadError) {
            console.error('Upload error:', uploadError);
            showError('Failed to upload some images. Please try again.');
            setSubmittingPost(false);
            return;
          }
        }
      }

      const payload: any = {
        content: postContent.trim(),
        page_id: page.id, // API expects page_id, not page
        // visibility is optional - backend will use default if not provided
      };

      if (uploadedUrls.length > 0) {
        payload.media_urls = uploadedUrls;
      }

      console.log('Creating post with payload:', payload);
      const response = await apiClient.post('/posts/', payload);
      console.log('Post creation response:', response);

      setPostContent('');
      setPostImages([]);
      showSuccess('Post created successfully!');
      loadPosts();
    } catch (error: any) {
      console.error('Post creation error:', error);
      console.error('Error response data:', error?.response?.data);
      console.error('Error response status:', error?.response?.status);
      const detail = error?.response?.data?.detail || error?.response?.data?.message || error?.response?.data?.error || 'Failed to create post';
      showError(detail);
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleDelete = async () => {
    if (!page) return;
    try {
      setDeleting(true);
      await apiClient.delete(`/pages/${page.id}/`);
      showSuccess('Page deleted successfully');
      router.push('/(tabs)/pages');
    } catch (error) {
      showError('Failed to delete page');
      console.error(error);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Helper functions for reactions and animations
  const REACTION_TYPE_TO_EMOJI: Record<string, string> = {
    "like": "👍",
    "love": "❤️",
    "haha": "😂",
    "sad": "😢",
    "angry": "😠",
  };

  const getReactionEmoji = (reactionType: string): string => {
    if (REACTION_TYPE_TO_EMOJI[reactionType]) {
      return REACTION_TYPE_TO_EMOJI[reactionType];
    }
    return reactionType;
  };

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

  const getDoubleTapAnimation = useCallback(
    (postId: number) => {
      if (!doubleTapAnimationsRef.current[postId]) {
        doubleTapAnimationsRef.current[postId] = new Animated.Value(0);
      }
      return doubleTapAnimationsRef.current[postId];
    },
    []
  );

  const buildDisplayName = (author: Post['author']) =>
    author?.username ||
    [author?.first_name, author?.last_name].filter(Boolean).join(' ') ||
    author?.email ||
    'User';

  const handleReactionSelect = async (postId: number, reactionType: ReactionType) => {
    if (!user) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const emoji = getReactionEmoji(reactionType);
    const existingReaction = (post.reactions || []).find(
      (reaction) => reaction.user?.id === user.id
    );

    setReactionBusy((prev) => ({ ...prev, [postId]: true }));
    const previousPosts = posts;
    const optimisticReactionId = -Math.floor(Math.random() * 1_000_000) - 1;

    if (existingReaction) {
      if (getReactionEmoji(existingReaction.reaction_type) === emoji) {
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
        const optimisticReaction: Reaction = {
          ...existingReaction,
          id: optimisticReactionId,
          reaction_type: emoji,
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
      const optimisticReaction: Reaction = {
        id: optimisticReactionId,
        reaction_type: emoji,
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
          try {
            if (existingReaction.id && existingReaction.id > 0) {
              await apiClient.delete(`/reactions/${existingReaction.id}/`);
            }
          } catch (deleteError: any) {
            if (deleteError?.response?.status !== 404) {
              console.warn('Error deleting reaction:', deleteError);
            }
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
        const optimisticReaction: Reaction = {
          ...existingReaction,
          id: optimisticReactionId,
          reaction_type: emoji,
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
      const optimisticReaction: Reaction = {
        id: optimisticReactionId,
        reaction_type: emoji,
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

  const handleToggleLike = async (post: Post) => {
    if (!user) {
      showError('Please log in to react to posts.');
      return;
    }

    const existingReaction = (post.reactions || []).find(
      (reaction) => reaction.user?.id === user.id
    );

    if (existingReaction) {
      const currentEmoji = getReactionEmoji(existingReaction.reaction_type);
      const reactionType = Object.keys(REACTION_TYPE_TO_EMOJI).find(
        key => REACTION_TYPE_TO_EMOJI[key] === currentEmoji
      ) || 'like';
      await handleReactionSelect(post.id, reactionType as ReactionType);
    } else {
      await handleReactionSelect(post.id, 'like');
    }
  };

  const handleDoubleTap = useCallback(
    (postId: number) => {
      if (!user) {
        showError('Please log in to react to posts.');
        return;
      }

      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      const existingReaction = (post.reactions || []).find(
        (reaction) => reaction.user?.id === user.id
      );

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

      if (existingReaction) {
        const existingEmoji = getReactionEmoji(existingReaction.reaction_type);
        const likeEmoji = getReactionEmoji('like');
        if (existingEmoji === likeEmoji) {
          handleReactionSelect(postId, 'like');
        } else {
          handleReactionSelect(postId, 'like');
        }
      } else {
        handleReactionSelect(postId, 'like');
      }
    },
    [user, posts, getDoubleTapAnimation]
  );

  const handlePostPress = useCallback(
    (postId: number) => {
      const now = Date.now();
      const lastTap = lastTapRef.current;

      if (lastTap && lastTap.postId === postId && now - lastTap.time < 400) {
        handleDoubleTap(postId);
        lastTapRef.current = null;
      } else {
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

  const handleReactionLongPress = (post: Post, event: any) => {
    if (!user) {
      showError('Please log in to react to posts.');
      return;
    }
    setAdvancedEmojiPickerPostId(post.id);
    setAdvancedEmojiPickerVisible(true);
  };

  const handleSharePost = async (post: Post) => {
    try {
      const shareUrl = `https://mylibertysocial.com/app/feed/${post.id}`;
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

  const handlePostUpdated = (nextPost: Post) => {
    setPosts((prev) => prev.map((item) => (item.id === nextPost.id ? nextPost : item)));
  };

  const handlePostDeleted = (postId: number) => {
    setPosts((prev) => prev.filter((item) => item.id !== postId));
  };

  const renderPost = ({ item }: { item: Post }) => {
    // For page posts, show page name instead of author name
    const isPagePost = (item as any).author_type === 'page' || (item as any).page !== null && (item as any).page !== undefined;
    const displayName = isPagePost && (item as any).page
      ? (item as any).page.name
      : buildDisplayName(item.author);
    
    // For page posts, use page profile image; for user posts, use author avatar
    const avatarSource = isPagePost && (item as any).page?.profile_image_url
      ? { uri: resolveRemoteUrl((item as any).page.profile_image_url) }
      : item.author?.profile_image_url
      ? { uri: resolveRemoteUrl(item.author.profile_image_url) }
      : DEFAULT_AVATAR;

    const galleryUrls: string[] =
      item.media && Array.isArray(item.media) && item.media.length > 0
        ? resolveMediaUrls(item.media)
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
          styles.postCard,
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
                router.push(`/pages/${(item as any).page.id}`);
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
            normalizePost={(p) => p}
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
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
        </TouchableOpacity>

        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.postActionButton}
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
            style={styles.postActionButton}
            onPress={() => router.push(`/pages/${id}/posts/${item.id}`)}
          >
            <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>{commentCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.postActionButton}
            onPress={() => handleSharePost(item)}
          >
            <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {item.bookmarked && (
            <View style={styles.postActionButton}>
              <Ionicons name="bookmark" size={20} color="#C8A25F" />
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <View>
            {/* Info Card */}
            {(page?.description || page?.website_url || page?.phone || page?.email) && (
              <View style={[styles.infoCard, { backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF', borderColor: colors.border }]}>
                <Text style={[styles.infoCardTitle, { color: colors.text }]}>Page Information</Text>
                {page?.description && (
                  <Text style={[styles.infoCardText, { color: colors.text }]}>{page.description}</Text>
                )}
                {(page?.website_url || page?.phone || page?.email) && (
                  <View style={styles.infoCardContact}>
                    {page?.website_url && (
                      <TouchableOpacity onPress={() => handleOpenLink(page.website_url!)} style={styles.infoCardRow}>
                        <Ionicons name="globe-outline" size={16} color={colors.primary} />
                        <Text style={[styles.infoCardLink, { color: colors.primary }]}>{page.website_url}</Text>
                      </TouchableOpacity>
                    )}
                    {page?.phone && (
                      <View style={styles.infoCardRow}>
                        <Ionicons name="call-outline" size={16} color={colors.primary} />
                        <Text style={[styles.infoCardText, { color: colors.text }]}>{page.phone}</Text>
                      </View>
                    )}
                    {page?.email && (
                      <View style={styles.infoCardRow}>
                        <Ionicons name="mail-outline" size={16} color={colors.primary} />
                        <Text style={[styles.infoCardText, { color: colors.text }]}>{page.email}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Posts */}
            <View style={styles.postsContainer}>
              <Text style={[styles.postsTitle, { color: colors.text }]}>Posts</Text>
              {loadingPosts ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : posts.length > 0 ? (
                <FlatList
                  data={posts}
                  renderItem={renderPost}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={false}
                  onEndReached={loadMorePosts}
                  onEndReachedThreshold={0.5}
                  ListFooterComponent={
                    nextPosts ? (
                      <View style={styles.loadMoreContainer}>
                        <ActivityIndicator size="small" color={colors.primary} />
                      </View>
                    ) : null
                  }
                />
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="newspaper-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No posts yet</Text>
                </View>
              )}
            </View>
          </View>
        );
      case 'about':
        return (
          <View style={styles.tabContent}>
            {page?.description ? (
              <Text style={[styles.descriptionText, { color: colors.text }]}>{page.description}</Text>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No description available</Text>
              </View>
            )}
          </View>
        );
      case 'contact':
        return (
          <View style={styles.tabContent}>
            {page?.website_url || page?.phone || page?.email ? (
              <View style={styles.contactList}>
                {page?.website_url && (
                  <TouchableOpacity onPress={() => handleOpenLink(page.website_url!)} style={[styles.contactItem, { borderColor: colors.border }]}>
                    <Ionicons name="globe-outline" size={24} color={colors.primary} />
                    <Text style={[styles.contactText, { color: colors.text }]}>{page.website_url}</Text>
                  </TouchableOpacity>
                )}
                {page?.phone && (
                  <TouchableOpacity style={[styles.contactItem, { borderColor: colors.border }]}>
                    <Ionicons name="call-outline" size={24} color={colors.primary} />
                    <Text style={[styles.contactText, { color: colors.text }]}>{page.phone}</Text>
                  </TouchableOpacity>
                )}
                {page?.email && (
                  <TouchableOpacity style={[styles.contactItem, { borderColor: colors.border }]}>
                    <Ionicons name="mail-outline" size={24} color={colors.primary} />
                    <Text style={[styles.contactText, { color: colors.text }]}>{page.email}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No contact information available</Text>
              </View>
            )}
          </View>
        );
      case 'photos':
        // Collect all photos from all posts with their post IDs
        const allPhotos: Array<{ url: string; postId: number }> = [];
        posts.forEach((post) => {
          if (post.media && Array.isArray(post.media) && post.media.length > 0) {
            const mediaUrls = resolveMediaUrls(post.media);
            mediaUrls.forEach((url) => {
              allPhotos.push({ url, postId: post.id });
            });
          }
        });

        if (loadingPosts) {
          return (
            <View style={styles.tabContent}>
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Loading photos...</Text>
              </View>
            </View>
          );
        }

        if (allPhotos.length === 0) {
          return (
            <View style={styles.tabContent}>
              <View style={styles.emptyContainer}>
                <Ionicons name="images-outline" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No photos yet</Text>
                <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
                  Photos from posts will appear here
                </Text>
              </View>
            </View>
          );
        }

        return (
          <View style={styles.photosTabContent}>
            <ScrollView 
              contentContainerStyle={styles.photosGridContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.photosGrid}>
                {allPhotos.map((photo, index) => {
                  const resolvedUrl = resolveRemoteUrl(photo.url);
                  if (!resolvedUrl) return null;
                  
                  return (
                    <TouchableOpacity
                      key={`photo-${index}`}
                      style={styles.photoItem}
                      onPress={() => {
                        // Open gallery with all photos, starting at this index
                        const photoUrls = allPhotos.map((p) => p.url).filter((url) => resolveRemoteUrl(url) !== null);
                        const photoToPostMap: Record<string, number> = {};
                        allPhotos.forEach((p) => {
                          if (resolveRemoteUrl(p.url)) {
                            photoToPostMap[p.url] = p.postId;
                          }
                        });
                        const currentIndex = photoUrls.findIndex((url) => url === photo.url);
                        const finalIndex = currentIndex >= 0 ? currentIndex : 0;
                        setGalleryImages(photoUrls);
                        setGalleryIndex(finalIndex);
                        setGalleryPhotoToPostMap(photoToPostMap);
                        // Set initial post ID for the first photo
                        const initialPhotoUrl = photoUrls[finalIndex];
                        if (initialPhotoUrl && photoToPostMap[initialPhotoUrl]) {
                          setGalleryPostId(photoToPostMap[initialPhotoUrl]);
                        }
                        setGalleryVisible(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: resolvedUrl }}
                        style={styles.photoImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={200}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        );
      default:
        return null;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    coverImage: {
      width: SCREEN_WIDTH,
      height: 200,
      backgroundColor: colors.border,
    },
    profileSection: {
      alignItems: 'center',
      marginTop: -50,
      marginBottom: 16,
    },
    profileImageContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 4,
      borderColor: isDark ? colors.background : '#FFFFFF',
      overflow: 'hidden',
      marginBottom: 12,
    },
    profileImage: {
      width: '100%',
      height: '100%',
    },
    verifiedBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: '#4F8EF7',
      borderRadius: 12,
      padding: 2,
    },
    pageName: {
      fontSize: 24,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 8,
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      gap: 8,
    },
    categoryContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    categoryIcon: {
      marginRight: 4,
    },
    categoryText: {
      fontSize: 14,
      color: colors.textSecondary,
      textTransform: 'capitalize',
    },
    followersText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    actionButtonsRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      gap: 12,
      marginBottom: 16,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      gap: 8,
      backgroundColor: '#192A4A',
      borderWidth: 2,
      borderColor: '#C8A25F',
      shadowColor: '#C8A25F',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    followButton: {
      backgroundColor: '#192A4A',
      borderColor: '#C8A25F',
    },
    followingButton: {
      backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    shareButton: {
      backgroundColor: '#192A4A',
      borderColor: '#C8A25F',
    },
    inviteButton: {
      backgroundColor: '#192A4A',
      borderColor: '#C8A25F',
    },
    actionButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
    followingButtonText: {
      color: colors.text,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    tabsContainer: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 16,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: '#C8A25F',
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
    },
    tabContent: {
      padding: 16,
      minHeight: 200,
    },
    photosTabContent: {
      padding: 16,
      minHeight: 200,
      marginBottom: 20,
    },
    createPostContainer: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    createPostInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    createPostInput: {
      flex: 1,
      minHeight: 40,
      maxHeight: 100,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      fontSize: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    createPostImageButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    createPostExpandButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '10',
      alignItems: 'center',
      justifyContent: 'center',
    },
    createPostButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: '#192A4A',
      borderWidth: 1,
      borderColor: '#C8A25F',
    },
    createPostButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    createPostImagesPreview: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    createPostImagePreview: {
      width: 60,
      height: 60,
      borderRadius: 8,
      position: 'relative',
    },
    createPostRemoveImage: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: '#FF4444',
      borderRadius: 12,
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoCard: {
      margin: 16,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
    },
    infoCardTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 12,
    },
    infoCardText: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
    },
    infoCardContact: {
      gap: 8,
    },
    infoCardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    infoCardLink: {
      fontSize: 14,
    },
    postsContainer: {
      paddingHorizontal: 16,
      marginTop: 16,
    },
    postsTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 12,
    },
    postCard: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
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
      marginRight: 12,
    },
    postHeaderText: {
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
    postActions: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    postActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 24,
    },
    actionText: {
      marginLeft: 6,
      fontSize: 14,
    },
    descriptionText: {
      fontSize: 15,
      lineHeight: 22,
    },
    contactList: {
      gap: 12,
    },
    contactItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
    },
    contactText: {
      fontSize: 14,
      flex: 1,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 14,
      marginTop: 12,
    },
    emptySubText: {
      fontSize: 12,
      marginTop: 8,
      textAlign: 'center',
    },
    photosGridContainer: {
      padding: 2,
    },
    photosGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
    },
    photoItem: {
      width: (Dimensions.get('window').width - 4) / 3,
      height: (Dimensions.get('window').width - 4) / 3,
      margin: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    photoImage: {
      width: '100%',
      height: '100%',
    },
    loadingContainer: {
      padding: 32,
      alignItems: 'center',
    },
    loadMoreContainer: {
      padding: 16,
      alignItems: 'center',
    },
    menuButton: {
      padding: 4,
    },
    deleteModalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 16,
    },
    deleteModalContent: {
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderRadius: 16,
      padding: 20,
    },
    deleteModalTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 12,
    },
    deleteModalText: {
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 20,
    },
    deleteModalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    deleteModalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    deleteModalCancel: {
      backgroundColor: colors.border,
    },
    deleteModalDelete: {
      backgroundColor: '#EF4444',
    },
    deleteModalButtonText: {
      fontSize: 15,
      fontWeight: '600',
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <AppNavbar 
          title={page?.name || 'Loading...'} 
          showProfileImage={false} 
          showBackButton={true} 
          onBackPress={() => router.push('/(tabs)/pages')} 
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!page) {
    return (
      <View style={styles.container}>
        <AppNavbar showProfileImage={false} showBackButton={true} onBackPress={() => router.push('/(tabs)/pages')} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
            Page not found
          </Text>
        </View>
      </View>
    );
  }

  const profileImage = page.profile_image_url
    ? resolveRemoteUrl(page.profile_image_url)
    : null;
  const profileSource = profileImage ? { uri: profileImage } : DEFAULT_AVATAR;
  const coverImage = page.cover_image_url ? resolveRemoteUrl(page.cover_image_url) : null;
  const canInvite = canManage || page.is_following;
  
  // Fallback check: if user is the page owner (by owner.id or created_by), allow posting
  const isPageOwner = user && (
    (page.owner && String(page.owner.id) === String(user.id)) ||
    (page as any).created_by?.id === user.id ||
    page.user_role === 'owner'
  );
  
  // Final canPost check - use canPost state OR isPageOwner
  const finalCanPost = canPost || isPageOwner;

  const contextMenuOptions = canManage
    ? [
        {
          label: 'Edit Page',
          icon: 'create-outline' as const,
          onPress: () => router.push(`/pages/${id}/edit`),
        },
        {
          label: 'Send Admin Invite',
          icon: 'person-add-outline' as const,
          onPress: () => {
            setShowContextMenu(false);
            setShowAdminInviteModal(true);
          },
        },
        {
          label: 'Delete Page',
          icon: 'trash-outline' as const,
          onPress: () => setShowDeleteConfirm(true),
          destructive: true,
        },
      ]
    : [];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <AppNavbar 
        title={page.name}
        showProfileImage={false} 
        showBackButton={true} 
        onBackPress={() => router.push('/(tabs)/pages')}
        customRightButton={
          canManage ? (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => setShowContextMenu(true)}
            >
              <Ionicons name="ellipsis-vertical" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ) : undefined
        }
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Cover Image */}
        {coverImage ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              setGalleryImages([coverImage]);
              setGalleryIndex(0);
              setGalleryVisible(true);
            }}
          >
            <Image 
              source={{ uri: coverImage }} 
              style={styles.coverImage} 
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          </TouchableOpacity>
        ) : (
          <View style={[styles.coverImage, { backgroundColor: colors.primary, opacity: 0.3 }]} />
        )}

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.profileImageContainer}
            activeOpacity={0.9}
            onPress={() => {
              if (profileImage) {
                setGalleryImages([profileImage]);
                setGalleryIndex(0);
                setGalleryVisible(true);
              }
            }}
          >
            <Image 
              source={profileSource} 
              style={styles.profileImage} 
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
            {page.is_verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.pageName, { color: colors.text }]}>{page.name}</Text>
          
          {/* Category + Followers */}
          <View style={styles.categoryRow}>
            {page.category && (
              <View style={styles.categoryContainer}>
                <Ionicons name="pricetag-outline" size={14} color={colors.textSecondary} style={styles.categoryIcon} />
                <Text style={styles.categoryText}>{page.category}</Text>
              </View>
            )}
            {page.category && <Text style={styles.followersText}>•</Text>}
            <Text style={styles.followersText}>{page.followers_count || 0} Followers</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.followButton,
              page.is_following && styles.followingButton,
            ]}
            onPress={handleFollowToggle}
          >
            <Ionicons 
              name={page.is_following ? "checkmark-circle" : "add-circle-outline"} 
              size={20} 
              color={page.is_following ? colors.text : '#FFFFFF'} 
            />
            <Text
              style={[
                styles.actionButtonText,
                page.is_following && styles.followingButtonText,
              ]}
            >
              {page.is_following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>

          {canInvite && (
            <TouchableOpacity
              style={[styles.actionButton, styles.inviteButton]}
              onPress={() => setShowInviteModal(true)}
            >
              <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Invite</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {(['overview', 'about', 'contact', 'photos'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, { color: activeTab === tab ? '#C8A25F' : colors.textSecondary }]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Create Post Input (for admins/owners/moderators) */}
        {finalCanPost && activeTab === 'overview' && (
          <View style={styles.createPostContainer}>
            <View style={styles.createPostInputContainer}>
              <TouchableOpacity
                style={styles.createPostImageButton}
                onPress={handlePickImages}
              >
                <Ionicons name="image-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TextInput
                style={[styles.createPostInput, { color: colors.text, backgroundColor: isDark ? colors.backgroundSecondary : '#F8F9FF' }]}
                placeholder="What's on your mind?"
                placeholderTextColor={colors.textSecondary}
                value={postContent}
                onChangeText={setPostContent}
                multiline
                maxLength={500}
                editable={!submittingPost}
              />
              <TouchableOpacity
                style={styles.createPostExpandButton}
                onPress={() => setShowCreatePostModal(true)}
              >
                <Ionicons name="expand-outline" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createPostButton}
                onPress={handleSubmitPost}
                disabled={!postContent.trim() || submittingPost}
              >
                {submittingPost ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.createPostButtonText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
            {postImages.length > 0 && (
              <View style={styles.createPostImagesPreview}>
                {postImages.map((image, index) => (
                  <View key={index} style={styles.createPostImagePreview}>
                    <Image 
                      source={{ uri: image.uri }} 
                      style={styles.createPostImagePreview} 
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={200}
                    />
                    <TouchableOpacity
                      style={styles.createPostRemoveImage}
                      onPress={() => handleRemoveImage(index)}
                    >
                      <Ionicons name="close" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Tab Content */}
        {renderTabContent()}
      </ScrollView>

      <ImageGallery
        visible={galleryVisible}
        onClose={() => {
          setGalleryVisible(false);
          setGalleryPhotoToPostMap({});
        }}
        images={galleryImages}
        initialIndex={galleryIndex}
        title={page.name}
        onIndexChange={(index) => {
          const currentPhotoUrl = galleryImages[index];
          if (currentPhotoUrl && galleryPhotoToPostMap[currentPhotoUrl]) {
            setGalleryPostId(galleryPhotoToPostMap[currentPhotoUrl]);
          }
        }}
        actionButton={
          galleryPostId
            ? {
                label: 'View post',
                onPress: () => {
                  setGalleryVisible(false);
                  router.push(`/pages/${id}/posts/${galleryPostId}`);
                  setGalleryPostId(null);
                  setGalleryPhotoToPostMap({});
                },
              }
            : undefined
        }
      />

      <ContextMenu
        visible={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        options={contextMenuOptions}
      />

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
          advancedEmojiPickerPostId && posts.find(p => p.id === advancedEmojiPickerPostId)
            ? (posts.find(p => p.id === advancedEmojiPickerPostId)?.reactions || []).find(r => r.user?.id === user?.id)?.reaction_type || null
            : null
        }
      />

      <UserProfileBottomSheet
        visible={profileBottomSheetVisible}
        userId={selectedUserId}
        onClose={() => {
          setProfileBottomSheetVisible(false);
          setSelectedUserId(null);
        }}
      />

      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.deleteModalContainer}>
          <View style={styles.deleteModalContent}>
            <Text style={[styles.deleteModalTitle, { color: colors.text }]}>
              Delete Page?
            </Text>
            <Text style={[styles.deleteModalText, { color: colors.text }]}>
              This action cannot be undone. The page will be permanently deleted.
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalCancel]}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                <Text style={[styles.deleteModalButtonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalDelete]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.deleteModalButtonText, { color: '#FFFFFF' }]}>
                    Delete
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <InviteUsersModal
        visible={showInviteModal}
        pageId={page?.id || 0}
        onClose={() => setShowInviteModal(false)}
        onInvitesSent={() => {
          loadPage();
        }}
      />

      <CreatePagePostModal
        visible={showCreatePostModal}
        pageId={page?.id || 0}
        onClose={() => setShowCreatePostModal(false)}
        onPostCreated={() => {
          loadPosts();
        }}
      />

      <SendAdminInviteModal
        visible={showAdminInviteModal}
        pageId={page?.id || 0}
        onClose={() => setShowAdminInviteModal(false)}
        onInviteSent={() => {
          loadPage();
        }}
      />
    </KeyboardAvoidingView>
  );
}
