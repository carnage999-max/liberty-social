import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { apiClient } from '../../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppNavbar from '../../../components/layout/AppNavbar';
import { resolveRemoteUrl, DEFAULT_AVATAR, resolveMediaUrls } from '../../../utils/url';
import { Post, Bookmark, PaginatedResponse } from '../../../types';
import { SkeletonPost } from '../../../components/common/Skeleton';
import SavePostToFolderModal from '../../../components/SavePostToFolderModal';

export default function SavedPostsScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [posts, setPosts] = useState<Record<number, Post>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

  const loadBookmarks = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await apiClient.get<PaginatedResponse<Bookmark>>('/bookmarks/');
      setBookmarks(response.results || []);
      setNext(response.next);

      // Fetch posts for bookmarks
      const postIds = response.results.map((b) => b.post);
      const uniquePostIds = [...new Set(postIds)];
      
      const postPromises = uniquePostIds.map(async (postId) => {
        try {
          const post = await apiClient.get<Post>(`/posts/${postId}/`);
          return { id: postId, post };
        } catch (error) {
          return { id: postId, post: null };
        }
      });

      const postResults = await Promise.all(postPromises);
      const postsMap: Record<number, Post> = {};
      postResults.forEach(({ id, post }) => {
        if (post) postsMap[id] = post;
      });
      setPosts((prev) => ({ ...prev, ...postsMap }));
    } catch (error) {
      if (!silent) showError('Failed to load saved posts');
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadBookmarks(true);
  }, [loadBookmarks]);

  const handleRemove = async (bookmarkId: number) => {
    try {
      setRemovingId(bookmarkId);
      await apiClient.delete(`/bookmarks/${bookmarkId}/`);
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
      showSuccess('Post removed from saved');
    } catch (error) {
      showError('Failed to remove bookmark');
    } finally {
      setRemovingId(null);
    }
  };

  const renderBookmark = useCallback(({ item }: { item: Bookmark }) => {
    const post = posts[item.post];
    
    if (!post) {
      return (
        <View
          style={[
            styles.bookmarkCard,
            {
              backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.unavailableText, { color: colors.textSecondary }]}>
            This post is no longer available
          </Text>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemove(item.id)}
            disabled={removingId === item.id}
          >
            <Text style={[styles.removeButtonText, { color: colors.textSecondary }]}>
              Remove
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    const authorLabel =
      post.author.username ||
      `${post.author.first_name || ''} ${post.author.last_name || ''}`.trim() ||
      post.author.email ||
      'User';

    const avatarUrl = post.author.profile_image_url
      ? resolveRemoteUrl(post.author.profile_image_url)
      : null;
    const avatarSource = avatarUrl ? { uri: avatarUrl } : DEFAULT_AVATAR;

    const mediaUrls = resolveMediaUrls(post.media || []);
    const firstMediaUrl = mediaUrls[0];

    return (
      <View
        style={[
          styles.bookmarkCard,
          {
            backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.bookmarkHeader}>
          <View style={styles.bookmarkHeaderLeft}>
            <Image 
              source={avatarSource} 
              style={styles.avatar}
              defaultSource={DEFAULT_AVATAR}
            />
            <View>
              <Text style={[styles.authorName, { color: colors.text }]}>{authorLabel}</Text>
              <Text style={[styles.savedDate, { color: colors.textSecondary }]}>
                Saved {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => {
              setSelectedPostId(item.post);
              setSaveModalVisible(true);
            }}
            disabled={removingId === item.id}
          >
            {removingId === item.id ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Ionicons name="bookmark" size={20} color="#C8A25F" />
            )}
          </TouchableOpacity>
        </View>

        {post.content && (
          <Text style={[styles.postContent, { color: colors.text }]} numberOfLines={3}>
            {post.content}
          </Text>
        )}

        {firstMediaUrl && (
          <Image
            source={{ uri: firstMediaUrl }}
            style={styles.postImage}
            resizeMode="cover"
            defaultSource={DEFAULT_AVATAR}
          />
        )}

        <TouchableOpacity
          style={styles.viewPostButton}
          onPress={() => router.push(`/(tabs)/feed/${post.id}`)}
        >
          <Text style={styles.viewPostButtonText}>View Post</Text>
          <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  }, [posts, isDark, colors, handleRemove, removingId, router]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    bookmarkCard: {
      marginHorizontal: 16,
      marginVertical: 8,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
    },
    bookmarkHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    bookmarkHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
    },
    authorName: {
      fontSize: 15,
      fontWeight: '600',
    },
    savedDate: {
      fontSize: 12,
      marginTop: 2,
    },
    removeButton: {
      padding: 8,
    },
    removeButtonText: {
      fontSize: 14,
    },
    postContent: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
    },
    postImage: {
      width: '100%',
      height: 200,
      borderRadius: 8,
      marginBottom: 12,
    },
    viewPostButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      gap: 6,
    },
    viewPostButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    unavailableText: {
      fontSize: 14,
      textAlign: 'center',
      padding: 16,
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
      marginTop: 16,
    },
  });

  if (loading && bookmarks.length === 0) {
    return (
      <View style={styles.container}>
        <AppNavbar
          title="Saved Posts"
          showLogo={false}
          showProfileImage={false}
          showBackButton={true}
          onBackPress={() => router.push('/(tabs)/settings')}
        />
        <FlatList
          data={[1, 2, 3, 4, 5]}
          renderItem={() => <SkeletonPost />}
          keyExtractor={(item) => item.toString()}
          contentContainerStyle={{ padding: 16 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
        <AppNavbar
          title="Saved Posts"
          showLogo={false}
          showProfileImage={false}
          showBackButton={true}
          onBackPress={() => router.push('/(tabs)/settings')}
        />
      {bookmarks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No saved posts yet</Text>
          <Text style={[styles.emptyText, { fontSize: 14, marginTop: 8 }]}>
            Bookmark posts to revisit them later
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookmarks}
          renderItem={renderBookmark}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 100 }}
        />
      )}
      <SavePostToFolderModal
        visible={saveModalVisible}
        postId={selectedPostId || 0}
        onClose={() => setSaveModalVisible(false)}
        onSaved={() => {
          showSuccess('Post saved to folder');
        }}
      />
    </View>
  );
}

