import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { apiClient } from '../../../utils/api';
import { Post, Comment } from '../../../types';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../../../components/layout/ScreenHeader';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPost();
  }, [id]);

  const loadPost = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<Post>(`/posts/${id}/`);
      setPost(data);
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

  const renderComment = (comment: Comment, depth = 0) => {
    const displayName = comment.author.username || 
      `${comment.author.first_name} ${comment.author.last_name}` || 
      comment.author.email || 
      'User';

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
        <Image
          source={{
            uri: comment.author.profile_image_url || 'https://via.placeholder.com/32',
          }}
          style={styles.commentAvatar}
        />
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
    postHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
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
    postMedia: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 12,
      backgroundColor: colors.border,
      marginBottom: 12,
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
      color: colors.text,
    },
    commentsHeader: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    commentsTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    commentContainer: {
      flexDirection: 'row',
      padding: 12,
      marginBottom: 8,
      borderRadius: 12,
      borderWidth: 1,
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
    },
    commentText: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 4,
    },
    commentTime: {
      fontSize: 12,
    },
    repliesContainer: {
      marginTop: 8,
    },
    commentInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    commentInput: {
      flex: 1,
      backgroundColor: isDark ? colors.background : '#F6F7FB',
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      marginRight: 8,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
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

  const displayName = post.author.username || 
    `${post.author.first_name} ${post.author.last_name}` || 
    post.author.email || 
    'User';

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

      <ScrollView style={{ flex: 1 }}>
        <View style={styles.postContainer}>
          <TouchableOpacity
            style={styles.postHeader}
            onPress={() => router.push(`/(tabs)/users/${post.author.id}`)}
          >
            <Image
              source={{
                uri: post.author.profile_image_url || 'https://via.placeholder.com/48',
              }}
              style={styles.avatar}
            />
            <View style={styles.postHeaderText}>
              <Text style={styles.authorName}>{displayName}</Text>
              <Text style={styles.postTime}>
                {new Date(post.created_at).toLocaleString()}
              </Text>
            </View>
          </TouchableOpacity>

          {post.content && (
            <Text style={styles.postContent}>{post.content}</Text>
          )}

          {post.media && post.media.length > 0 && (
            <Image
              source={{ uri: post.media[0] }}
              style={styles.postMedia}
              resizeMode="cover"
            />
          )}

          <View style={styles.postActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="heart-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.actionText}>{post.reactions?.length || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.actionText}>{post.comments?.length || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.commentsHeader}>
          <Text style={styles.commentsTitle}>
            Comments ({post.comments?.length || 0})
          </Text>
          {post.comments?.map((comment) => renderComment(comment))}
        </View>
      </ScrollView>

      <View style={styles.commentInputContainer}>
        <TextInput
          style={styles.commentInput}
          placeholder="Write a comment..."
          placeholderTextColor={colors.textSecondary}
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmitComment}
          disabled={submitting || !commentText.trim()}
        >
          <Ionicons name="send" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
