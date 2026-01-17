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

type ViewMode = 'all' | 'folders';

interface SaveFolder {
  id: number;
  name: string;
  item_count: number;
  items?: Array<{ id: number; post: number | Post; folder: number; created_at: string }>;
}

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
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [folders, setFolders] = useState<SaveFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [loadingFolders, setLoadingFolders] = useState(false);

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
    loadFolders();
  }, []);

  const loadFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const response = await apiClient.get<SaveFolder[] | { results: SaveFolder[] }>('/save-folders/');
      const folderList = Array.isArray(response) ? response : response.results || [];
      console.log('Loaded folders:', folderList);
      setFolders(folderList);
      if (folderList.length > 0 && !selectedFolderId) {
        setSelectedFolderId(folderList[0].id);
      }

      // Fetch posts for folder items
      const folderPostIds: number[] = [];
      folderList.forEach((folder) => {
        if (folder.items) {
          folder.items.forEach((item) => {
            folderPostIds.push(item.post);
          });
        }
      });

      const uniqueFolderPostIds = [...new Set(folderPostIds)];
      const postPromises = uniqueFolderPostIds.map(async (postId) => {
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
      console.error('Failed to load folders:', error);
    } finally {
      setLoadingFolders(false);
    }
  }, [selectedFolderId]);

  const loadFolderDetails = useCallback(async (folderId: number) => {
    try {
      const response = await apiClient.get<SaveFolder>(`/save-folders/${folderId}/`);
      console.log('Loaded folder details:', response);
      
      // Update the folder with the full details including items
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? response : f))
      );
    } catch (error) {
      console.error('Failed to load folder details:', error);
    }
  }, []);

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
          onPress={() => router.push(`/(tabs)/feed/${post.slug ?? post.id}`)}
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
    tabContainer: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      paddingHorizontal: 0,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activeTab: {
      borderBottomWidth: 2,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabIndicator: {
      height: 2,
      marginTop: 12,
    },
    folderContainer: {
      marginHorizontal: 16,
      marginVertical: 8,
      borderWidth: 1,
      borderRadius: 8,
      overflow: 'hidden',
    },
    folderHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    folderInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    folderName: {
      fontSize: 15,
      fontWeight: '600',
    },
    folderCount: {
      fontSize: 12,
      marginTop: 4,
    },
    folderItems: {
      borderTopWidth: 1,
    },
    folderItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderTopWidth: 1,
    },
    folderItemText: {
      fontSize: 13,
      flex: 1,
      marginRight: 8,
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

      {/* Tab Navigation */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'all' && { borderBottomWidth: 2, borderBottomColor: colors.primary }]}
          onPress={() => setViewMode('all')}
        >
          <Text style={[styles.tabText, viewMode === 'all' && { color: colors.primary, fontWeight: '700' }]}>
            All Posts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'folders' && { borderBottomWidth: 2, borderBottomColor: colors.primary }]}
          onPress={() => setViewMode('folders')}
        >
          <Text style={[styles.tabText, viewMode === 'folders' && { color: colors.primary, fontWeight: '700' }]}>
            Folders {folders.length > 0 && `(${folders.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'all' ? (
        bookmarks.length === 0 ? (
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
        )
      ) : (
        <FlatList
          data={folders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item: folder }) => {
            const isExpanded = expandedFolders.has(folder.id);
            return (
              <View key={folder.id} style={[styles.folderContainer, { borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.folderHeader, { backgroundColor: isDark ? colors.backgroundSecondary : '#F9F9F9' }]}
                  onPress={() => {
                    const willExpand = !expandedFolders.has(folder.id);
                    setExpandedFolders((prev) => {
                      const next = new Set(prev);
                      if (next.has(folder.id)) {
                        next.delete(folder.id);
                      } else {
                        next.add(folder.id);
                      }
                      return next;
                    });
                    // Load full folder details when expanding
                    if (willExpand) {
                      loadFolderDetails(folder.id);
                    }
                  }}
                >
                  <View style={styles.folderInfo}>
                    <Ionicons name="folder" size={20} color={colors.primary} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={[styles.folderName, { color: colors.text }]}>{folder.name}</Text>
                      <Text style={[styles.folderCount, { color: colors.textSecondary }]}>
                        {folder.item_count} item{folder.item_count !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
                {isExpanded && (
                  <View style={styles.folderItems}>
                    {folder.items && folder.items.length > 0 ? (
                      folder.items.map((folderItem) => {
                        // Handle both cases: post as ID (from initial load) or post as object (from API)
                        const postData = typeof folderItem.post === 'number' 
                          ? posts[folderItem.post]
                          : folderItem.post as Post;
                        
                        if (!postData) {
                          return (
                            <View
                              key={folderItem.id}
                              style={[styles.folderItem, { borderTopColor: colors.border }]}
                            >
                              <Text style={[styles.folderItemText, { color: colors.textSecondary }]}>
                                Post not available
                              </Text>
                            </View>
                          );
                        }
                        return (
                          <TouchableOpacity
                            key={folderItem.id}
                            style={[styles.folderItem, { borderTopColor: colors.border }]}
                            onPress={() => router.push(`/(tabs)/feed/${postData.slug ?? postData.id}`)}
                          >
                            <Text style={[styles.folderItemText, { color: colors.text }]} numberOfLines={2}>
                              {postData.content || 'Untitled Post'}
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <View style={[styles.folderItem, { borderTopColor: colors.border }]}>
                        <Text style={[styles.folderItemText, { color: colors.textSecondary }]}>
                          No posts in this folder
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          }}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 100 }}
        />
      )}

      <SavePostToFolderModal
        visible={saveModalVisible}
        postId={selectedPostId || 0}
        onClose={() => setSaveModalVisible(false)}
        onSaved={() => {
          showSuccess('Post saved to folder');
          loadFolders();
        }}
      />
    </View>
  );
}
