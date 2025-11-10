import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
  Alert,
  ActionSheetIOS,
  Animated,
  FlatList,
  RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { apiClient } from '../../../utils/api';
import { Post, Comment, Reaction } from '../../../types';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../../../components/layout/ScreenHeader';
import PostActionsMenu from '../../../components/feed/PostActionsMenu';
import {
  resolveMediaUrls,
  resolveRemoteUrl,
  DEFAULT_AVATAR,
} from '../../../utils/url';
import { API_BASE } from '../../../constants/API';
import type { ImageSourcePropType } from 'react-native';
import AppNavbar from '../../../components/layout/AppNavbar';
import ReactionPicker from '../../../components/feed/ReactionPicker';
import CommentActionsMenu from '../../../components/feed/CommentActionsMenu';
import type { ReactionType } from '../../../types';
import UserProfileBottomSheet from '../../../components/profile/UserProfileBottomSheet';
import { SkeletonPost } from '../../../components/common/Skeleton';

type NormalizedPost = Post & {
  mediaUrls: string[];
  authorAvatar: ImageSourcePropType;
};

type CommentSort = 'recent' | 'oldest' | 'popular';

const buildDisplayName = (user: Post['author']) =>
  user.username ||
  [user.first_name, user.last_name].filter(Boolean).join(' ') ||
  user.email ||
  'User';

const ensureNormalizedPost = (incoming: Post | NormalizedPost): NormalizedPost => {
  const candidateSources: (string | null | undefined)[] = [];

  const appendCandidate = (value?: string | null) => {
    if (!value) return;
    candidateSources.push(value);
  };

  if (Array.isArray((incoming as any)?.media_urls)) {
    (incoming as any).media_urls.forEach((value: any) => appendCandidate(String(value)));
  }

  if (Array.isArray(incoming.media)) {
    incoming.media.forEach((entry: any) => {
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

  appendCandidate((incoming as any)?.media_url);
  appendCandidate((incoming as any)?.media);

  const mediaArray = candidateSources.filter(Boolean);
  const mediaUrls = resolveMediaUrls(mediaArray);
  const resolvedAvatar = resolveRemoteUrl(incoming.author?.profile_image_url);
  const authorAvatar: ImageSourcePropType = resolvedAvatar
    ? { uri: resolvedAvatar }
    : DEFAULT_AVATAR;

  return {
    ...(incoming as Post),
    media: mediaUrls,
    mediaUrls,
    author: {
      ...incoming.author,
      profile_image_url: incoming.author?.profile_image_url || null,
    },
    authorAvatar,
  };
};

const formatSortLabel = (sort: CommentSort) => {
  switch (sort) {
    case 'recent':
      return 'Recent';
    case 'oldest':
      return 'Oldest';
    case 'popular':
      return 'Popular';
    default:
      return 'Recent';
  }
};

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showError, showSuccess, showInfo } = useToast();
  const router = useRouter();
  const [post, setPost] = useState<NormalizedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reactionPending, setReactionPending] = useState(false);
  const [commentSort, setCommentSort] = useState<CommentSort>('recent');
  const [replyingToCommentId, setReplyingToCommentId] = useState<number | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replySubmitting, setReplySubmitting] = useState<Record<number, boolean>>({});
  const [expandedReplies, setExpandedReplies] = useState<number[]>([]);
  const [commentMedias, setCommentMedias] = useState<Record<number | 'new', Array<{ formData: FormData; uri: string }>>>({ new: [] });
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [reactionPickerPosition, setReactionPickerPosition] = useState<{ x: number; y: number } | undefined>(undefined);
  const [commentReactionPickerVisible, setCommentReactionPickerVisible] = useState(false);
  const [commentReactionPickerCommentId, setCommentReactionPickerCommentId] = useState<number | null>(null);
  const [commentReactionPickerPosition, setCommentReactionPickerPosition] = useState<{ x: number; y: number } | undefined>(undefined);
  const [profileBottomSheetVisible, setProfileBottomSheetVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | number | null>(null);
  const likeAnimation = useRef(new Animated.Value(1)).current;

  const loadPost = useCallback(async () => {
    try {
      if (!refreshing) {
        setLoading(true);
      }
      const data = await apiClient.get<Post>(`/posts/${id}/`);
      setPost(ensureNormalizedPost(data));
    } catch (error) {
      // Error loading post - user will see empty state
    } finally {
      setLoading(false);
    }
  }, [id, refreshing]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPost().finally(() => {
      setRefreshing(false);
    });
  }, [loadPost]);

  const handleSubmitComment = async () => {
    if (!post) return;
    const hasText = commentText.trim();
    const hasAttachments = commentMedias.new && commentMedias.new.length > 0;
    if (!hasText && !hasAttachments) return;

    setSubmitting(true);
    try {
      const hasAttachments = commentMedias.new && commentMedias.new.length > 0;
      let comment: Comment;

      if (hasAttachments) {
        // Step 1: Upload images first
        const uploadedUrls: string[] = [];
        for (const media of commentMedias.new) {
          try {
            const uploadResponse = await apiClient.postFormData('/uploads/images/', media.formData);
            if (uploadResponse.url) {
              uploadedUrls.push(uploadResponse.url);
            } else if (uploadResponse.urls && Array.isArray(uploadResponse.urls) && uploadResponse.urls.length > 0) {
              uploadedUrls.push(...uploadResponse.urls);
            }
          } catch (uploadError) {
            showError('Failed to upload image. Please try again.');
          }
        }

        // Step 2: Create comment with uploaded media URLs
        comment = await apiClient.post<Comment>('/comments/', {
          post: post.id,
          content: commentText.trim() || '(media attachment)',
          media_urls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
        });
      } else {
        comment = await apiClient.post<Comment>('/comments/', {
          post: post.id,
          content: commentText.trim(),
        });
      }
      // Normalize media URLs for the new comment
      // If API doesn't return media yet, use the uploaded URLs
      let normalizedMedia: string[] = [];
      if (comment.media && Array.isArray(comment.media) && comment.media.length > 0) {
        normalizedMedia = resolveMediaUrls(comment.media);
      } else if (hasAttachments && uploadedUrls.length > 0) {
        // Use uploaded URLs if API didn't return media
        normalizedMedia = resolveMediaUrls(uploadedUrls);
      }
      
      const normalizedComment: Comment = {
        ...comment,
        media: normalizedMedia,
        reactions: comment.reactions ?? [],
        replies: comment.replies ?? [],
        replies_count: comment.replies_count ?? comment.replies?.length ?? 0,
      };
      
      setPost((prev) =>
        prev
          ? ensureNormalizedPost({
              ...(prev as Post),
              comments: [...(prev.comments || []), normalizedComment],
            })
          : prev
      );
      setCommentText('');
      setCommentMedias(prev => ({ ...prev, new: [] }));
    } catch (error) {
      showError('Failed to post comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalComments = useMemo((): string => {
    if (!post?.comments) {
      return '0';
    }
    const countAll = (items: Comment[]): number =>
      items.reduce(
        (total, item) => total + 1 + (item.replies && item.replies.length > 0 ? countAll(item.replies) : 0),
        0
      );
    return String(countAll(post.comments));
  }, [post?.comments]);

  const sortedComments = useMemo(() => {
    if (!post?.comments) {
      return [] as Comment[];
    }
    const topLevel = post.comments.filter((comment) => !comment.parent);
    const sorted = [...topLevel];

    if (commentSort === 'recent') {
      sorted.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (commentSort === 'oldest') {
      sorted.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } else {
      sorted.sort((a, b) =>
        (b.reactions?.length || 0) - (a.reactions?.length || 0)
      );
    }

    return sorted;
  }, [post?.comments, commentSort]);

  const handleChangeSort = useCallback(() => {
    const options: { label: string; value: CommentSort }[] = [
      { label: 'Recent', value: 'recent' },
      { label: 'Oldest', value: 'oldest' },
      { label: 'Popular', value: 'popular' },
    ];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options.map((opt) => opt.label), 'Cancel'],
          cancelButtonIndex: options.length,
          title: 'Sort comments',
        },
        (selectedIndex) => {
          if (selectedIndex === undefined || selectedIndex >= options.length) {
            return;
          }
          setCommentSort(options[selectedIndex].value);
        }
      );
    } else {
      Alert.alert(
        'Sort comments',
        undefined,
        options.map((opt) => ({
          text: opt.label,
          onPress: () => setCommentSort(opt.value),
        })),
        { cancelable: true }
      );
    }
  }, []);

  const handleSharePost = useCallback(() => {
    if (!post) return;
    const shareMessage = [
      post.content,
      `${API_BASE.replace(/\/api\/?$/, '')}/feed/${post.id}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    Share.share({
      message: shareMessage,
      title: 'Share post',
    }).catch((error) => {
      showError('Unable to share. Please try again later.');
    });
  }, [post]);

  const animateLikeState = useCallback(
    (liked: boolean) => {
      likeAnimation.stopAnimation();
      Animated.sequence([
        Animated.spring(likeAnimation, {
          toValue: liked ? 1.25 : 0.9,
          useNativeDriver: true,
          damping: 16,
          stiffness: 260,
          mass: 0.6,
        }),
        Animated.spring(likeAnimation, {
          toValue: 1,
          useNativeDriver: true,
          damping: 14,
          stiffness: 220,
          mass: 0.6,
        }),
      ]).start();
    },
    [likeAnimation]
  );

  const handleToggleReaction = useCallback(async (commentId?: number) => {
    if (!post || !user || reactionPending) {
      if (!user) {
        showInfo('Please sign in to react.');
      }
      return;
    }

    if (commentId !== undefined) {
      // Handle comment reaction
      let targetComment: Comment | undefined;
      let parentComment: Comment | undefined;
      let isReply = false;

      // Find the comment and determine if it's a reply
      for (const comment of post.comments || []) {
        if (comment.id === commentId) {
          targetComment = comment;
          break;
        }
        const reply = (comment.replies || []).find((r) => r.id === commentId);
        if (reply) {
          targetComment = reply;
          parentComment = comment;
          isReply = true;
          break;
        }
      }

      if (!targetComment) return;

      const existingReaction = (targetComment.reactions || []).find(
        (reaction) => reaction.user?.id === user.id && reaction.reaction_type === 'like'
      );

      setReactionPending(true);
      const previousPost = post;

      // Optimistic update
      setPost((prev) => {
        if (!prev) return prev;
        const updateComment = (comment: Comment): Comment => ({
          ...comment,
          reactions: existingReaction
            ? (comment.reactions || []).filter((r) => r.id !== existingReaction.id)
            : [
                ...(comment.reactions || []),
                {
                  id: -Math.floor(Math.random() * 1_000_000) - 1,
                  reaction_type: 'like',
                  created_at: new Date().toISOString(),
                  user,
                } as Reaction,
              ],
        });

        const updateComments = (comments: Comment[]): Comment[] =>
          comments.map((c) => {
            if (c.id === commentId) {
              return updateComment(c);
            }
            if (c.replies) {
              return {
                ...c,
                replies: c.replies.map((r) =>
                  r.id === commentId ? updateComment(r) : r
                ),
              };
            }
            return c;
          });

        return {
          ...prev,
          comments: updateComments(prev.comments || []),
        };
      });

      try {
        if (existingReaction) {
          await apiClient.delete(`/reactions/${existingReaction.id}/`);
        } else {
          const savedReaction = await apiClient.post<Reaction>('/reactions/', {
            comment: commentId,
            reaction_type: 'like',
          });
          // Update with the real reaction data
          setPost((prev) => {
            if (!prev) return prev;
            const updateComment = (comment: Comment): Comment => ({
              ...comment,
              reactions: [
                ...(comment.reactions || []).filter((r) => 
                  !(r.user?.id === user.id && r.reaction_type === 'like')
                ),
                savedReaction,
              ],
            });

            const updateComments = (comments: Comment[]): Comment[] =>
              comments.map((c) => {
                if (c.id === commentId) {
                  return updateComment(c);
                }
                if (c.replies) {
                  return {
                    ...c,
                    replies: c.replies.map((r) =>
                      r.id === commentId ? updateComment(r) : r
                    ),
                  };
                }
                return c;
              });

            return {
              ...prev,
              comments: updateComments(prev.comments || []),
            };
          });
        }
      } catch (error) {
        showError('Unable to react. Please try again later.');
        setPost(previousPost);
      } finally {
        setReactionPending(false);
      }
      return;
    }

    // Handle post reaction
    const existingReaction = (post.reactions || []).find(
      (reaction) => reaction.user?.id === user.id && reaction.reaction_type === 'like'
    );

    setReactionPending(true);
    const previousPost = post;

    if (existingReaction) {
      setPost((prev) =>
        prev
          ? ensureNormalizedPost({
              ...prev,
              reactions: (prev.reactions || []).filter(
                (reaction) => reaction.id !== existingReaction.id
              ),
            })
          : prev
      );
      animateLikeState(false);
    } else {
      const optimisticReaction: Reaction = {
        id: -Math.floor(Math.random() * 1_000_000) - 1,
        reaction_type: 'like',
        created_at: new Date().toISOString(),
        user,
      };

      setPost((prev) =>
        prev
          ? ensureNormalizedPost({
              ...prev,
              reactions: [
                ...((prev.reactions || []).filter((reaction) => reaction.user?.id !== user.id) || []),
                optimisticReaction,
              ],
            })
          : prev
      );
      animateLikeState(true);
    }

    try {
      if (existingReaction) {
        await apiClient.delete(`/reactions/${existingReaction.id}/`);
      } else {
        const savedReaction = await apiClient.post<Reaction>('/reactions/', {
          post: post.id,
          reaction_type: 'like',
        });
        setPost((prev) =>
          prev
            ? ensureNormalizedPost({
                ...prev,
                reactions: [
                  ...((prev.reactions || []).filter((reaction) => reaction.user?.id !== user.id) || []),
                  savedReaction,
                ],
              })
            : prev
        );
      }
    } catch (error) {
      showError('Unable to react. Please try again later.');
      setPost(previousPost);
    } finally {
      setReactionPending(false);
    }
  }, [post, user, reactionPending, animateLikeState]);

  const handleCommentReactionLongPress = (commentId: number, event: any) => {
    if (!user) {
      showInfo('Please log in to react to comments.');
      return;
    }
    const { pageX, pageY } = event.nativeEvent;
    setCommentReactionPickerPosition({ x: pageX, y: pageY - 60 });
    setCommentReactionPickerCommentId(commentId);
    setCommentReactionPickerVisible(true);
  };

  const handlePostReactionLongPress = (event: any) => {
    if (!user) {
      showInfo('Please log in to react to posts.');
      return;
    }
    const { pageX, pageY } = event.nativeEvent;
    setReactionPickerPosition({ x: pageX, y: pageY - 60 });
    setReactionPickerVisible(true);
  };

  const handlePostReactionSelect = async (reactionType: ReactionType) => {
    if (!post || !user) return;

    const existingReaction = (post.reactions || []).find(
      (reaction) => reaction.user?.id === user.id
    );

    setReactionPending(true);
    const previousPost = post;

    try {
      if (existingReaction && existingReaction.reaction_type === reactionType) {
        // Remove reaction if same type
        await apiClient.delete(`/reactions/${existingReaction.id}/`);
      } else {
        // Delete old reaction if exists and add new one
        if (existingReaction) {
          await apiClient.delete(`/reactions/${existingReaction.id}/`);
        }
        await apiClient.post('/reactions/', {
          post: post.id,
          reaction_type: reactionType,
        });
      }
      // Reload post to get updated reactions
      const data = await apiClient.get<Post>(`/posts/${id}/`);
      setPost(ensureNormalizedPost(data));
      animateLikeState();
    } catch (error) {
      showError('Unable to react. Please try again later.');
      setPost(previousPost);
    } finally {
      setReactionPending(false);
      setReactionPickerVisible(false);
      setReactionPickerPosition(undefined);
    }
  };

  const handleCommentReactionSelect = async (commentId: number, reactionType: ReactionType) => {
    if (!post || !user) return;

    // Find the comment
    let targetComment: Comment | undefined;
    for (const comment of post.comments || []) {
      if (comment.id === commentId) {
        targetComment = comment;
        break;
      }
      const reply = (comment.replies || []).find((r) => r.id === commentId);
      if (reply) {
        targetComment = reply;
        break;
      }
    }

    if (!targetComment) return;

    const existingReaction = (targetComment.reactions || []).find(
      (reaction) => reaction.user?.id === user.id
    );

    setReactionPending(true);
    const previousPost = post;

    try {
      if (existingReaction && existingReaction.reaction_type === reactionType) {
        // Remove reaction if same type
        await apiClient.delete(`/reactions/${existingReaction.id}/`);
      } else {
        // Delete old reaction if exists and add new one
        if (existingReaction) {
          await apiClient.delete(`/reactions/${existingReaction.id}/`);
        }
        await apiClient.post('/reactions/', {
          comment: commentId,
          reaction_type: reactionType,
        });
      }
      // Reload post to get updated reactions
      const data = await apiClient.get<Post>(`/posts/${id}/`);
      setPost(ensureNormalizedPost(data));
    } catch (error) {
      showError('Unable to react. Please try again later.');
      setPost(previousPost);
    } finally {
      setReactionPending(false);
      setCommentReactionPickerVisible(false);
      setCommentReactionPickerCommentId(null);
      setCommentReactionPickerPosition(undefined);
    }
  };

  const handlePostMenuUpdated = useCallback((updated: Post) => {
    setPost((prev) => ensureNormalizedPost({ ...(prev || updated), ...updated }));
  }, []);

  const handlePostMenuDeleted = useCallback((postId: number) => {
    setPost((prev) => (prev && prev.id === postId ? null : prev));
    router.back();
  }, [router]);

  const handleToggleReplies = useCallback((commentId: number) => {
    setExpandedReplies((prev) =>
      prev.includes(commentId) ? prev.filter((id) => id !== commentId) : [...prev, commentId]
    );
  }, []);

  const handleStartReply = useCallback(
    (commentId: number) => {
      if (!user) {
        showInfo('Please sign in to reply to comments.');
        return;
      }
      // Only allow replying to top-level comments
      const comment = post?.comments?.find(c => c.id === commentId);
      if (!comment) {
        return;
      }
      setReplyingToCommentId(commentId);
      setReplyDrafts((prev) => {
        if (prev[commentId] !== undefined) {
          return prev;
        }
        return { ...prev, [commentId]: '' };
      });
      setExpandedReplies((prev) => (prev.includes(commentId) ? prev : [...prev, commentId]));
    },
    [user, post]
  );

  const handleCancelReply = useCallback((commentId: number) => {
    setReplyingToCommentId((prev) => (prev === commentId ? null : prev));
    setReplyDrafts((prev) => {
      if (prev[commentId] === undefined) {
        return prev;
      }
      const next = { ...prev };
      delete next[commentId];
      return next;
    });
    setReplySubmitting((prev) => {
      if (prev[commentId] === undefined) {
        return prev;
      }
      const next = { ...prev };
      delete next[commentId];
      return next;
    });
  }, []);

  const handleSubmitReply = useCallback(
    async (parentCommentId: number) => {
      if (!post) {
        return;
      }
      if (!user) {
        showInfo('Please sign in to reply to comments.');
        return;
      }
      const draft = (replyDrafts[parentCommentId] || '').trim();
      const hasAttachments = (commentMedias[parentCommentId] || []).length > 0;
      if (!draft && !hasAttachments) {
        showInfo('Share a thought before sending your reply.');
        return;
      }
      if (replySubmitting[parentCommentId]) {
        return;
      }

      setReplySubmitting((prev) => ({ ...prev, [parentCommentId]: true }));
      try {
        let created: Comment;
        const uploadedUrls: string[] = [];

        const attachments = commentMedias[parentCommentId] || [];
        if (attachments.length > 0) {
          // Step 1: Upload images first
          for (const media of attachments) {
            try {
              const uploadResponse = await apiClient.postFormData('/uploads/images/', media.formData);
              if (uploadResponse.url) {
                uploadedUrls.push(uploadResponse.url);
              } else if (uploadResponse.urls && Array.isArray(uploadResponse.urls) && uploadResponse.urls.length > 0) {
                uploadedUrls.push(...uploadResponse.urls);
              }
            } catch (uploadError) {
              showError('Failed to upload image. Please try again.');
            }
          }

          // Step 2: Create reply with uploaded media URLs
          created = await apiClient.post<Comment>('/comments/', {
            post: post.id,
            parent: parentCommentId,
            content: draft || '(media attachment)',
            media_urls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
          });
        } else {
          created = await apiClient.post<Comment>('/comments/', {
            post: post.id,
            parent: parentCommentId,
            content: draft,
            media_urls: [],
          });
        }

        // Normalize media URLs for the new reply
        // If API doesn't return media yet, use the uploaded URLs
        let normalizedReplyMedia: string[] = [];
        if (created.media && Array.isArray(created.media) && created.media.length > 0) {
          normalizedReplyMedia = resolveMediaUrls(created.media);
        } else if (attachments.length > 0 && uploadedUrls.length > 0) {
          // Use uploaded URLs if API didn't return media
          normalizedReplyMedia = resolveMediaUrls(uploadedUrls);
        }
        
        const normalizedReply: Comment = {
          ...created,
          media: normalizedReplyMedia,
          reactions: created.reactions ?? [],
          replies: created.replies ?? [],
          replies_count: created.replies_count ?? created.replies?.length ?? 0,
        };
        setPost((prev) => {
          if (!prev) {
            return prev;
          }
          const appendReply = (comments: Comment[]): Comment[] =>
            comments.map((item) => {
              if (item.id === parentCommentId) {
                const existingReplies = item.replies ?? [];
                return {
                  ...item,
                  replies: [...existingReplies, normalizedReply],
                  replies_count: (item.replies_count ?? existingReplies.length) + 1,
                };
              }
              if (item.replies && item.replies.length > 0) {
                return {
                  ...item,
                  replies: appendReply(item.replies),
                };
              }
              return item;
            });
          return ensureNormalizedPost({
            ...(prev as Post),
            comments: appendReply(prev.comments || []),
          });
        });
        setExpandedReplies((prev) => (prev.includes(parentCommentId) ? prev : [...prev, parentCommentId]));
        setCommentMedias(prev => {
          const next = { ...prev };
          delete next[parentCommentId];
          return next;
        });
        handleCancelReply(parentCommentId);
      } catch (error) {
        showError('Unable to reply. Please try again later.');
      } finally {
        setReplySubmitting((prev) => {
          if (prev[parentCommentId] === undefined) {
            return prev;
          }
          const next = { ...prev };
          delete next[parentCommentId];
          return next;
        });
      }
    },
    [post, replyDrafts, replySubmitting, user, handleCancelReply]
  );

  const handleAddAttachment = useCallback(async (commentId: number | 'new' = 'new') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showInfo('Please grant camera roll permissions to add images.');
        return;
      }

      // Use the new ImagePicker.MediaType when available, fall back to MediaTypeOptions for older SDKs.
      // Cast to any to avoid TypeScript issues across different expo-image-picker versions.
      // Prefer the new MediaType enum when available. If it's not present
      // avoid passing the deprecated MediaTypeOptions to prevent the deprecation warning.
      const mediaTypesOption: any = (ImagePicker as any).MediaType
        ? [(ImagePicker as any).MediaType.Images]
        : undefined;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaTypesOption,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        // Ensure we only accept images. Different SDKs expose different fields.
        const isImage = (asset as any).type === 'image' || (asset as any).mediaType === 'image' || /\.(jpe?g|png|gif|webp)$/i.test(asset.uri || '');
        if (!isImage) {
          showInfo('Please select an image file.');
          return;
        }
        const formData = new FormData();
        const file = {
          uri: asset.uri,
          type: 'image/jpeg',
          name: 'upload.jpg',
        } as any;
        formData.append('file', file);

        setCommentMedias((prev) => {
          // sanitize keys: keep only 'new' and numeric keys
          const safePrev: Record<number | 'new', Array<{ formData: FormData; uri: string }>> = {
            new: (prev as any).new || [],
          };
          Object.keys(prev || {}).forEach((k) => {
            if (/^\d+$/.test(k)) {
              // numeric key
              (safePrev as any)[k] = (prev as any)[k];
            }
          });

          const key = String(commentId);
          const existing = (safePrev as any)[key] || [];
          const next: Record<number | 'new', Array<{ formData: FormData; uri: string }>> = {
            ...(safePrev as any),
            [key]: [...existing, { formData, uri: asset.uri }],
          } as any;
          return next;
        });
      }
    } catch (error) {
      showError('Failed to pick image. Please try again.');
    }
  }, []);

  const renderCommentComposer = useCallback((): React.ReactElement => (
    <View>
      <View style={styles.commentInputContainer}>
        <TouchableOpacity
          style={styles.commentAttachmentButton}
          onPress={() => handleAddAttachment('new')}
          accessibilityLabel="Add media"
        >
          <Ionicons name="add-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TextInput
          style={styles.commentInput}
          placeholder="Write a comment..."
          placeholderTextColor={colors.textSecondary}
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        <TouchableOpacity
          style={[styles.commentSendButton, (submitting || (!(commentText.trim()) && !(commentMedias.new && commentMedias.new.length > 0))) ? styles.commentSendDisabled : null]}
          onPress={handleSubmitComment}
          disabled={submitting || (!(commentText.trim()) && !(commentMedias.new && commentMedias.new.length > 0))}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
      {commentMedias.new && commentMedias.new.length > 0 && (
        <ScrollView 
          horizontal 
          style={styles.mediaPreviewContainer}
          showsHorizontalScrollIndicator={false}
        >
          {commentMedias.new.map((media, index) => (
            <View key={index} style={styles.mediaPreviewWrapper}>
              <Image
                source={{ uri: media.uri }}
                style={styles.mediaPreview}
              />
              <TouchableOpacity
                style={styles.removeMediaButton}
                onPress={() => {
                  setCommentMedias(prev => ({
                    ...prev,
                    new: prev.new.filter((_, i) => i !== index)
                  }));
                }}
              >
                <Ionicons name="close-circle" size={20} color="#FF4D4D" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  ), [colors.primary, colors.textSecondary, commentText, submitting, handleAddAttachment, handleSubmitComment, commentMedias]);

    const renderComment = (comment: Comment, depth = 0): React.ReactElement | null => {
    if (!comment) return null;
    
    const displayName = buildDisplayName(comment.author);
    const avatarSource: ImageSourcePropType = resolveRemoteUrl(comment.author.profile_image_url)
      ? { uri: resolveRemoteUrl(comment.author.profile_image_url)! }
      : DEFAULT_AVATAR;
    
    // Get current user's reaction
    const currentUserReaction = (comment.reactions || []).find(
      (reaction) => reaction.user?.id === user?.id
    );
    const currentReactionType = currentUserReaction?.reaction_type || null;
    
    // Get total reaction count
    const totalReactionCount = (comment.reactions || []).length;
    
    // Reaction emoji mapping
    const reactionEmojis: Record<string, string> = {
      like: '👍',
      love: '❤️',
      haha: '😂',
      sad: '😢',
      angry: '😡',
    };

    const isTopLevelComment = depth === 0;

    return (
      <View
        key={comment.id}
        style={[
          styles.commentContainer,
          { 
            backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
            marginLeft: depth * 16,
          }
        ]}
      >
        <View style={{ flexDirection: 'row', flex: 1 }}>
          <TouchableOpacity
            onPress={() => {
              setSelectedUserId(comment.author.id);
              setProfileBottomSheetVisible(true);
            }}
          >
            <Image source={avatarSource} style={styles.commentAvatar} />
          </TouchableOpacity>
          <View style={styles.commentContent}>
            <View style={styles.commentHeaderRow}>
              <Text style={[styles.commentAuthor, { color: colors.text }]}>{displayName}</Text>
              <CommentActionsMenu
                comment={comment}
                currentUserId={user?.id ?? null}
                onCommentUpdated={(updated) => {
                  setPost((prev) => {
                    if (!prev) return prev;
                    const updateComment = (comments: Comment[]): Comment[] =>
                      comments.map((item) => {
                        if (item.id === updated.id) {
                          return updated;
                        }
                        if (item.replies && item.replies.length > 0) {
                          return { ...item, replies: updateComment(item.replies) };
                        }
                        return item;
                      });
                    return ensureNormalizedPost({
                      ...prev,
                      comments: updateComment(prev.comments || []),
                    });
                  });
                }}
                onCommentDeleted={(commentId) => {
                  setPost((prev) => {
                    if (!prev) return prev;
                    const removeComment = (comments: Comment[]): Comment[] =>
                      comments
                        .filter((item) => item.id !== commentId)
                        .map((item) => {
                          if (item.replies && item.replies.length > 0) {
                            const updatedReplies = removeComment(item.replies);
                            return {
                              ...item,
                              replies: updatedReplies,
                              replies_count: updatedReplies.length,
                            };
                          }
                          return item;
                        });
                    return ensureNormalizedPost({
                      ...prev,
                      comments: removeComment(prev.comments || []),
                    });
                  });
                }}
              />
            </View>
            <Text style={[styles.commentText, { color: colors.text }]}>{comment.content || ''}</Text>
            {comment.media && comment.media.length > 0 && (
              <View style={styles.commentMediaGrid}>
                {comment.media.map((url, index) => (
                  <Image
                    key={`comment-media-${index}`}
                    source={{ uri: url }}
                    style={[
                      styles.commentMediaImage,
                      comment.media.length === 1 && styles.commentMediaImageSingle,
                      comment.media.length === 2 && styles.commentMediaImageDouble,
                      comment.media.length >= 3 && styles.commentMediaImageTriple,
                    ]}
                    resizeMode="cover"
                  />
                ))}
              </View>
            )}
            {/* Show thumbnails for images attached to replies so images on replies are visible
                in the parent comment area (useful when replies are collapsed). */}
            {isTopLevelComment && comment.replies && comment.replies.length > 0 && (() => {
              const replyMedia: string[] = [];
              comment.replies.forEach((r) => {
                if (r.media && r.media.length > 0) {
                  replyMedia.push(...r.media);
                }
              });
              if (replyMedia.length === 0) return null;
              const preview = replyMedia.slice(0, 3);
              return (
                <View style={styles.replySummaryContainer}>
                  {preview.map((uri, i) => (
                    <Image key={`reply-summary-${i}`} source={{ uri }} style={styles.replySummaryImage} />
                  ))}
                  {replyMedia.length > preview.length && (
                    <View style={styles.replySummaryMore}>
                      <Text style={styles.replySummaryMoreText}>+{replyMedia.length - preview.length}</Text>
                    </View>
                  )}
                </View>
              );
            })()}
            <View style={styles.commentActions}>
              <View>
                <TouchableOpacity
                  style={styles.commentActionButton}
                  onPress={() => handleToggleReaction(comment.id)}
                  onLongPress={(event) => handleCommentReactionLongPress(comment.id, event)}
                  disabled={reactionPending}
                >
                  {currentReactionType ? (
                    <Text style={styles.commentReactionEmoji}>{reactionEmojis[currentReactionType] || '👍'}</Text>
                  ) : (
                    <Ionicons
                      name="heart-outline"
                      size={18}
                      color={colors.textSecondary}
                    />
                  )}
                  {totalReactionCount > 0 && (
                    <Text style={styles.commentActionText}>{String(totalReactionCount)}</Text>
                  )}
                </TouchableOpacity>
              </View>
              {isTopLevelComment && (
                <TouchableOpacity
                  style={styles.commentActionButton}
                  onPress={() => handleStartReply(comment.id)}
                >
                  <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
              <View>
                <Text style={[styles.commentTime, { color: colors.textSecondary }]}>
                  {new Date(comment.created_at).toLocaleString()}
                </Text>
              </View>
            </View>

            {isTopLevelComment && comment.replies && comment.replies.length > 0 && (
              <View style={styles.repliesSection}>
                <TouchableOpacity
                  style={styles.repliesToggleButton}
                  onPress={() => handleToggleReplies(comment.id)}
                >
                  <View>
                    <Text style={styles.repliesToggleText}>
                      {`${expandedReplies.includes(comment.id) ? 'Hide' : 'Show'} ${comment.replies.length} ${comment.replies.length === 1 ? 'reply' : 'replies'}`}
                    </Text>
                  </View>
                </TouchableOpacity>
                {expandedReplies.includes(comment.id) && (
                  <View style={styles.repliesContainer}>
                    {comment.replies.map((reply) => renderComment(reply, 1))}
                  </View>
                )}
              </View>
            )}

            {replyingToCommentId === comment.id && (
              <View style={styles.replyComposer}>
                <View style={styles.commentInputContainer}>
                  <TouchableOpacity
                    style={styles.commentAttachmentButton}
                    onPress={() => handleAddAttachment(comment.id)}
                    accessibilityLabel="Add media"
                  >
                    <Ionicons name="add-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Write a reply..."
                    placeholderTextColor={colors.textSecondary}
                    value={replyDrafts[comment.id] || ''}
                    onChangeText={(text) => setReplyDrafts(prev => ({ ...prev, [comment.id]: text }))}
                    multiline
                  />
                  <TouchableOpacity
                    style={[
                      styles.commentSendButton,
                      ((!(replyDrafts[comment.id]?.trim()) && !((commentMedias[comment.id] || []).length)) || replySubmitting[comment.id]) ? styles.commentSendDisabled : null,
                    ]}
                    onPress={() => handleSubmitReply(comment.id)}
                    disabled={(!(replyDrafts[comment.id]?.trim()) && !((commentMedias[comment.id] || []).length)) || replySubmitting[comment.id]}
                  >
                    {replySubmitting[comment.id] ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="send" size={18} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                </View>
                {(commentMedias[comment.id] || []).length > 0 && (
                  <View style={styles.replyMediaPreview}>
                    <FlatList
                      horizontal
                      data={commentMedias[comment.id] || []}
                      keyExtractor={(item, index) => `reply-media-${index}`}
                      renderItem={({ item, index }) => (
                        <View key={index} style={styles.mediaPreviewWrapper}>
                          <Image
                            source={{ uri: item.uri }}
                            style={styles.replyMediaThumbnail}
                            resizeMode="cover"
                          />
                          <TouchableOpacity
                            style={styles.removeMediaButton}
                            onPress={() => {
                              setCommentMedias(prev => {
                                const next = { ...(prev as any) };
                                const arr = (next as any)[String(comment.id)] || [];
                                next[String(comment.id)] = arr.filter((_: any, i: number) => i !== index);
                                return next;
                              });
                            }}
                          >
                            <Ionicons name="close-circle" size={20} color="#FF4D4D" />
                          </TouchableOpacity>
                        </View>
                      )}
                      showsHorizontalScrollIndicator={false}
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    pageContent: {
      flex: 1,
    },
    postStickyContainer: {
      paddingBottom: 16,
      paddingTop: 16,
      marginTop: 16,
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingHorizontal: 16,
    },
    commentMediaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginVertical: 8,
      width: '100%',
    },
    commentMediaImage: {
      borderRadius: 8,
      backgroundColor: colors.border,
    },
    commentMediaImageSingle: {
      width: '100%',
      maxWidth: '100%',
      aspectRatio: 1.2,
      minHeight: 250,
    },
    commentMediaImageDouble: {
      width: '48%',
      aspectRatio: 1,
      minHeight: 150,
    },
    commentMediaImageTriple: {
      width: '31%',
      aspectRatio: 1,
      minHeight: 100,
    },
    repliesSection: {
      marginTop: 4,
    },
    repliesToggleButton: {
      paddingVertical: 4,
    },
    repliesToggleText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.primary,
    },
    replyComposer: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    replyMediaPreview: {
      marginTop: 8,
      flexDirection: 'row',
    },
    replyMediaThumbnail: {
      width: 80,
      height: 80,
      borderRadius: 8,
      marginRight: 8,
      backgroundColor: colors.border,
    },
    replySummaryContainer: {
      flexDirection: 'row',
      marginTop: 8,
      alignItems: 'center',
    },
    replySummaryImage: {
      width: 44,
      height: 44,
      borderRadius: 6,
      marginRight: 6,
      backgroundColor: colors.border,
    },
    replySummaryMore: {
      width: 44,
      height: 44,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.border,
    },
    replySummaryMoreText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    headerBackButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.backgroundSecondary : '#EEF0FF',
    },
    postContainer: {
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    postHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 12,
      gap: 12,
    },
    postHeaderContent: {
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
      color: colors.text,
    },
    postTime: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    postContent: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
      marginBottom: 12,
    },
    postMediaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    postMediaSingle: {
      justifyContent: 'center',
    },
    postMediaDouble: {
      justifyContent: 'space-between',
    },
    postMediaTriple: {
      justifyContent: 'space-between',
    },
    postMediaImage: {
      flexGrow: 1,
      minWidth: '48%',
      aspectRatio: 1,
      borderRadius: 12,
      backgroundColor: colors.border,
    },
    postActions: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 18,
    },
    contentScroll: {
      flex: 1,
    },
    contentScrollContent: {
      paddingBottom: 80,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    actionText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    reactionEmoji: {
      fontSize: 22,
    },
    commentsSection: {
      paddingTop: 8,
      paddingBottom: 40,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    commentsStickyHeader: {
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      zIndex: 2,
    },
    commentsHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    commentsTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    sortButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
    },
    sortButtonText: {
      fontSize: 12,
      fontWeight: '600',
    },
    commentContainer: {
      flexDirection: 'row',
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    commentAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.border,
      marginRight: 8,
    },
    commentContent: {
      flex: 1,
    },
    commentHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    commentAuthor: {
      fontSize: 14,
      fontWeight: '600',
      flex: 1,
      color: colors.text,
    },
    commentReactionEmoji: {
      fontSize: 18,
    },
    commentText: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 2,
      color: colors.text,
    },
    commentTime: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    repliesContainer: {
      marginTop: 4,
      marginLeft: 16,
      paddingLeft: 12,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
    },
    commentInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
    },
    commentComposerWrapper: {
      marginTop: 12,
    },
    commentAttachmentButton: {
      marginRight: 8,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.background : '#EEF1FF',
    },
    commentInput: {
      flex: 1,
      backgroundColor: isDark ? colors.background : '#F6F7FB',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 8,
      fontSize: 14,
      color: colors.text,
    },
    commentActions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
      gap: 16,
    },
    commentActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    commentActionText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    commentSendButton: {
      marginLeft: 10,
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentSendDisabled: {
      opacity: 0.5,
    },
    emptyCommentsText: {
      fontSize: 13,
      marginTop: 12,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    mediaPreviewContainer: {
      marginTop: 8,
      paddingHorizontal: 12,
    },
    mediaPreviewWrapper: {
      position: 'relative',
      marginRight: 8,
    },
    mediaPreview: {
      width: 80,
      height: 80,
      borderRadius: 8,
      backgroundColor: colors.border,
    },
    removeMediaButton: {
      position: 'absolute',
      top: -8,
      right: -8,
      backgroundColor: 'white',
      borderRadius: 10,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
    },
    mediaImageWrapper: {
      width: '32%', // Adjust as needed for 3 columns
      aspectRatio: 1,
      borderRadius: 8,
      backgroundColor: colors.border,
    },
    mediaImageSingle: {
      width: '100%',
      height: '100%',
    },
    mediaImageDouble: {
      width: '50%',
      height: '50%',
    },
    mediaImageTriple: {
      width: '33.33%',
      height: '33.33%',
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <AppNavbar showBackButton={true} showLogo={false} showProfileImage={false} />
        <ScrollView
          style={[styles.contentScroll, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.contentScrollContent}
        >
          <SkeletonPost />
        </ScrollView>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.text, textAlign: 'center', marginTop: 32 }}>
          Post not found
        </Text>
      </View>
    );
  }

  const displayName = buildDisplayName(post.author);
  const mediaUrls = post.mediaUrls;
  
  const currentReaction = (post.reactions || []).find(
    (reaction) => reaction.user?.id === user?.id
  );
  const hasReacted = !!currentReaction;
  const reactionType = currentReaction?.reaction_type;
  
  const reactionEmojis: Record<string, string> = {
    like: '👍',
    love: '❤️',
    haha: '😂',
    wow: '😮',
    sad: '😢',
    angry: '😠',
  };
  
  const totalReactions = (post.reactions || []).length;
  const likeCount = (post.reactions || []).filter(
    (reaction) => reaction.reaction_type === 'like'
  ).length;
  const likedByUser = (post.reactions || []).some(
    (reaction) => reaction.user?.id === user?.id && reaction.reaction_type === 'like'
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <AppNavbar showBackButton={true} showLogo={false} showProfileImage={false} />

      <View style={styles.pageContent}>
        <ScrollView
          style={[styles.contentScroll, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.contentScrollContent}
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <View style={styles.postStickyContainer}>
            <View style={styles.postContainer}>
              <View style={styles.postHeaderRow}>
                <TouchableOpacity
                  style={styles.postHeaderContent}
                  onPress={() => {
                    setSelectedUserId(post.author.id);
                    setProfileBottomSheetVisible(true);
                  }}
                >
                  <Image source={post.authorAvatar} style={styles.avatar} />
                  <View style={styles.postHeaderText}>
                    <Text style={styles.authorName}>{displayName}</Text>
                    <Text style={styles.postTime}>
                      {new Date(post.created_at).toLocaleString()}
                    </Text>
                  </View>
                </TouchableOpacity>
                <PostActionsMenu
                  post={post}
                  currentUserId={user?.id ?? null}
                  onPostUpdated={handlePostMenuUpdated}
                  onPostDeleted={handlePostMenuDeleted}
                  normalizePost={ensureNormalizedPost}
                />
              </View>

              {post.content ? (
                <Text style={styles.postContent}>{post.content}</Text>
              ) : null}

              {mediaUrls.length > 0 && (
                <View
                  style={[
                    styles.postMediaGrid,
                    mediaUrls.length === 1
                      ? styles.postMediaSingle
                      : mediaUrls.length === 2
                      ? styles.postMediaDouble
                      : styles.postMediaTriple,
                  ]}
                >
                  {mediaUrls.slice(0, 9).map((url: string, index: number) => (
                    <View
                      key={`post-media-${index}`}
                      style={[
                        styles.mediaImageWrapper,
                        mediaUrls.length === 1
                          ? styles.mediaImageSingle
                          : mediaUrls.length === 2
                          ? styles.mediaImageDouble
                          : styles.mediaImageTriple,
                      ]}
                    >
                      <Image
                        source={{ uri: url }}
                        style={styles.postMediaImage}
                        resizeMode="cover"
                      />
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.postActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleToggleReaction}
                  onLongPress={handlePostReactionLongPress}
                  disabled={reactionPending}
                >
                  {hasReacted && reactionType ? (
                    <Animated.View style={{ transform: [{ scale: likeAnimation }] }}>
                      <Text style={styles.reactionEmoji}>{reactionEmojis[reactionType] || '👍'}</Text>
                    </Animated.View>
                  ) : (
                    <Animated.View style={{ transform: [{ scale: likeAnimation }] }}>
                      <Ionicons
                        name="heart-outline"
                        size={22}
                        color={colors.textSecondary}
                      />
                    </Animated.View>
                  )}
                  <Text style={[styles.actionText, { color: colors.textSecondary }]}>
                    {totalReactions > 0 ? String(totalReactions) : '0'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.actionButton}>
                  <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
                  <Text style={[styles.actionText, { color: colors.textSecondary }]}>{String(totalComments)}</Text>
                </View>

                <TouchableOpacity style={styles.actionButton} onPress={handleSharePost}>
                  <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.commentsStickyHeader}>
            <View style={styles.commentsHeaderRow}>
              <Text style={styles.commentsTitle}>
                {`Comments (${totalComments})`}
              </Text>
              <TouchableOpacity style={styles.sortButton} onPress={handleChangeSort}>
                <Text style={[styles.sortButtonText, { color: colors.textSecondary }]}>
                  Sort: {formatSortLabel(commentSort)}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.commentComposerWrapper}>{renderCommentComposer()}</View>
          </View>

          <View style={styles.commentsSection}>
            {sortedComments.length === 0 ? (
              <Text style={[styles.emptyCommentsText, { color: colors.textSecondary }]}>
                Be the first to comment.
              </Text>
            ) : (
              <>
                {sortedComments.map((comment) => renderComment(comment))}
              </>
            )}
          </View>
        </ScrollView>
      </View>

      <ReactionPicker
        visible={reactionPickerVisible}
        onClose={() => {
          setReactionPickerVisible(false);
          setReactionPickerPosition(undefined);
        }}
        onSelect={handlePostReactionSelect}
        currentReaction={post?.reactions?.find(r => r.user?.id === user?.id)?.reaction_type || null}
        position={reactionPickerPosition}
      />

      <ReactionPicker
        visible={commentReactionPickerVisible}
        onClose={() => {
          setCommentReactionPickerVisible(false);
          setCommentReactionPickerCommentId(null);
          setCommentReactionPickerPosition(undefined);
        }}
        onSelect={(reactionType) => {
          if (commentReactionPickerCommentId) {
            handleCommentReactionSelect(commentReactionPickerCommentId, reactionType);
          }
        }}
        currentReaction={
          commentReactionPickerCommentId && post
            ? (() => {
                // Find the comment and get its current reaction
                for (const comment of post.comments || []) {
                  if (comment.id === commentReactionPickerCommentId) {
                    return comment.reactions?.find(r => r.user?.id === user?.id)?.reaction_type || null;
                  }
                  const reply = comment.replies?.find(r => r.id === commentReactionPickerCommentId);
                  if (reply) {
                    return reply.reactions?.find(r => r.user?.id === user?.id)?.reaction_type || null;
                  }
                }
                return null;
              })()
            : null
        }
        position={commentReactionPickerPosition}
      />

      <UserProfileBottomSheet
        visible={profileBottomSheetVisible}
        userId={selectedUserId}
        onClose={() => {
          setProfileBottomSheetVisible(false);
          setSelectedUserId(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}
