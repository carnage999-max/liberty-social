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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
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
  const router = useRouter();
  const [post, setPost] = useState<NormalizedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reactionPending, setReactionPending] = useState(false);
  const [commentSort, setCommentSort] = useState<CommentSort>('recent');
  const likeAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadPost();
  }, [id]);

  const loadPost = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<Post>(`/posts/${id}/`);
      setPost(ensureNormalizedPost(data));
    } catch (error) {
      console.error('Error loading post:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !post) return;

    setSubmitting(true);
    try {
      const comment = await apiClient.post<Comment>('/comments/', {
        post: post.id,
        content: commentText.trim(),
      });
      setPost((prev) => ({
        ...prev!,
        comments: [...(prev?.comments || []), comment],
      }));
      setCommentText('');
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const commentCount = post?.comments?.length ?? 0;

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
      console.error('Error sharing post:', error);
      Alert.alert('Unable to share', 'Please try again later.');
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

  const handleToggleReaction = useCallback(async () => {
    if (!post || !user || reactionPending) {
      if (!user) {
        Alert.alert('Sign in required', 'Please sign in to react to posts.');
      }
      return;
    }

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
      console.error('Error updating reaction:', error);
      Alert.alert('Unable to react', 'Please try again later.');
      setPost(previousPost);
    } finally {
      setReactionPending(false);
    }
  }, [post, user, reactionPending, animateLikeState]);

  const handlePostMenuUpdated = useCallback((updated: Post) => {
    setPost((prev) => ensureNormalizedPost({ ...(prev || updated), ...updated }));
  }, []);

  const handlePostMenuDeleted = useCallback((postId: number) => {
    setPost((prev) => (prev && prev.id === postId ? null : prev));
    router.back();
  }, [router]);

  const handleAddAttachment = useCallback(() => {
    Alert.alert('Coming soon', 'Image and GIF attachments are coming soon.');
  }, []);

  const renderCommentComposer = useCallback(() => (
    <View style={styles.commentInputContainer}>
      <TouchableOpacity
        style={styles.commentAttachmentButton}
        onPress={handleAddAttachment}
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
        style={[styles.commentSendButton, submitting || !commentText.trim() ? styles.commentSendDisabled : null]}
        onPress={handleSubmitComment}
        disabled={submitting || !commentText.trim()}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name="send" size={18} color="#FFFFFF" />
        )}
      </TouchableOpacity>
    </View>
  ), [colors.primary, colors.textSecondary, commentText, submitting, handleAddAttachment, handleSubmitComment]);

  const renderComment = (comment: Comment, depth = 0) => {
    const displayName = buildDisplayName(comment.author);
    const avatarSource: ImageSourcePropType = resolveRemoteUrl(comment.author.profile_image_url)
      ? { uri: resolveRemoteUrl(comment.author.profile_image_url)! }
      : DEFAULT_AVATAR;

    return (
      <View
        key={comment.id}
        style={[
          styles.commentContainer,
          { 
            backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
            marginLeft: depth * 16,
            borderColor: colors.border,
          }
        ]}
      >
        <Image source={avatarSource} style={styles.commentAvatar} />
        <View style={styles.commentContent}>
          <Text style={[styles.commentAuthor, { color: colors.text }]}>{displayName}</Text>
          <Text style={[styles.commentText, { color: colors.text }]}>{comment.content}</Text>
          <Text style={[styles.commentTime, { color: colors.textSecondary }]}>
            {new Date(comment.created_at).toLocaleString()}
          </Text>
          {comment.replies && comment.replies.length > 0 && (
            <View style={styles.repliesContainer}>
              {comment.replies.map((reply) => renderComment(reply, depth + 1))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingBottom: 36,
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
      margin: 16,
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
    postMediaMultiple: {
      justifyContent: 'flex-start',
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
    commentsSection: {
      paddingHorizontal: 16,
      paddingBottom: 40,
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
      padding: 12,
      marginBottom: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
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
    commentAuthor: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
      color: colors.text,
    },
    commentText: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 4,
      color: colors.text,
    },
    commentTime: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    repliesContainer: {
      marginTop: 8,
    },
    commentInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 16,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
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
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
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
  const likeCount = (post.reactions || []).filter(
    (reaction) => reaction.reaction_type === 'like'
  ).length;
  const likedByUser = (post.reactions || []).some(
    (reaction) => reaction.user?.id === user?.id && reaction.reaction_type === 'like'
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <ScreenHeader
        title="Post"
        leftContent={
          <TouchableOpacity
            style={styles.headerBackButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </TouchableOpacity>
        }
        containerStyle={{ paddingBottom: 12 }}
      />

      <View style={styles.pageContent}>
        <View style={styles.postStickyContainer}>
          <View style={styles.postContainer}>
            <View style={styles.postHeaderRow}>
              <TouchableOpacity
                style={styles.postHeaderContent}
                onPress={() => router.push(`/(tabs)/users/${post.author.id}`)}
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
                mediaUrls.length === 1 ? styles.postMediaSingle : styles.postMediaMultiple,
              ]}
            >
              {mediaUrls.map((url: string, index: number) => (
                <Image
                  key={`post-media-${index}`}
                  source={{ uri: url }}
                  style={styles.postMediaImage}
                  resizeMode="cover"
                />
              ))}
            </View>
          )}

          <View style={styles.postActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleToggleReaction}
              disabled={reactionPending}
            >
              <Animated.View style={{ transform: [{ scale: likeAnimation }] }}>
                <Ionicons
                  name={likedByUser ? 'heart' : 'heart-outline'}
                  size={22}
                  color={likedByUser ? '#FF4D6D' : colors.textSecondary}
                />
              </Animated.View>
              <Text style={styles.actionText}>{likeCount}</Text>
            </TouchableOpacity>

            <View style={styles.actionButton}>
              <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.actionText}>{commentCount}</Text>
            </View>

            <TouchableOpacity style={styles.actionButton} onPress={handleSharePost}>
              <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.commentComposerWrapper}>{renderCommentComposer()}</View>
        </View>

        <ScrollView
          style={styles.commentsScroll}
          contentContainerStyle={styles.commentsScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.commentsSection}>
            <View style={styles.commentsHeaderRow}>
              <Text style={styles.commentsTitle}>Comments ({commentCount})</Text>
              <TouchableOpacity style={styles.sortButton} onPress={handleChangeSort}>
                <Text style={[styles.sortButtonText, { color: colors.textSecondary }]}>
                  Sort: {formatSortLabel(commentSort)}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {sortedComments.length === 0 ? (
              <Text style={[styles.emptyCommentsText, { color: colors.textSecondary }]}>
                Be the first to comment.
              </Text>
            ) : (
              sortedComments.map((comment) => renderComment(comment))
            )}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
