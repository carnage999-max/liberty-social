import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';
import ImageGallery from '../../components/common/ImageGallery';

interface BusinessPage {
  id: number;
  name: string;
  description?: string;
  category?: string;
  profile_image_url?: string;
  cover_image_url?: string;
  followers_count?: number;
  follower_count?: number;
  is_following: boolean;
  is_verified?: boolean;
}

type TabType = 'discover' | 'following' | 'manage';

export default function PagesScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const [pages, setPages] = useState<BusinessPage[]>([]);
  const [managedPages, setManagedPages] = useState<BusinessPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('discover');
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadPages = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load all pages
      const response = await apiClient.get<any>('/pages/');
      setPages(response.results || []);
      
      // Load managed pages
      const mine = await apiClient.get<any>('/pages/mine/');
      setManagedPages(mine || []);
    } catch (error) {
      showError('Failed to load pages');
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPages();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPages();
  }, [loadPages]);

  const handleFollowToggle = async (pageId: number) => {
    try {
      const page = pages.find((p) => p.id === pageId);
      if (!page) return;

      const response = await apiClient.post<{ following: boolean; follower_count: number }>(`/pages/${pageId}/follow/`, {});
      const newFollowingState = response.following;
      showSuccess(newFollowingState ? 'Following page' : 'Unfollowed page');

      // Update local state
      setPages((prev) =>
        prev.map((p) =>
          p.id === pageId ? { 
            ...p, 
            is_following: newFollowingState,
            followers_count: response.follower_count || p.followers_count || p.follower_count,
            follower_count: response.follower_count || p.follower_count || p.followers_count
          } : p
        )
      );
    } catch (error) {
      showError('Failed to update follow status');
      console.error(error);
    }
  };

  const renderPage = ({ item }: { item: BusinessPage }) => {
    const profileImage = item.profile_image_url
      ? resolveRemoteUrl(item.profile_image_url)
      : null;
    const profileSource = profileImage ? { uri: profileImage } : DEFAULT_AVATAR;

    return (
      <TouchableOpacity
        style={[
          styles.pageCard,
          {
            backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
            borderColor: colors.border,
          },
        ]}
        onPress={() => router.push(`/pages/${item.id}`)}
        activeOpacity={0.7}
      >
        {/* Cover Image */}
        {item.cover_image_url ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              const images: string[] = [];
              if (item.cover_image_url) images.push(resolveRemoteUrl(item.cover_image_url));
              if (item.profile_image_url) images.push(resolveRemoteUrl(item.profile_image_url));
              if (images.length > 0) {
                setGalleryImages(images);
                setGalleryIndex(0);
                setGalleryVisible(true);
              }
            }}
          >
          <Image
            source={{ uri: resolveRemoteUrl(item.cover_image_url) }}
            style={styles.coverImage}
          />
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.coverImage,
              { backgroundColor: colors.primary, opacity: 0.3 },
            ]}
          />
        )}

        {/* Profile Image */}
        <TouchableOpacity
          style={styles.profileImageContainer}
          activeOpacity={0.9}
          onPress={() => {
            const images: string[] = [];
            if (item.profile_image_url) images.push(resolveRemoteUrl(item.profile_image_url));
            if (item.cover_image_url) images.push(resolveRemoteUrl(item.cover_image_url));
            if (images.length > 0) {
              setGalleryImages(images);
              setGalleryIndex(0);
              setGalleryVisible(true);
            }
          }}
        >
          <Image source={profileSource} style={styles.profileImage} />
          {item.is_verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#4F8EF7" />
            </View>
          )}
        </TouchableOpacity>

        {/* Page Info */}
        <View style={styles.pageInfo}>
          <Text style={[styles.pageName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          
          {item.description && (
            <Text
              style={[styles.pageDescription, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          )}

          <View style={styles.pageStats}>
            <View style={styles.stat}>
              <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.statText, { color: colors.textSecondary }]}>
                {item.follower_count ?? item.followers_count ?? 0} followers
              </Text>
            </View>
            {item.category && (
              <View style={styles.categoryBadge}>
                <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
                  {item.category}
                </Text>
              </View>
            )}
          </View>

          {/* Follow Button */}
          {activeTab !== 'manage' && (
            <TouchableOpacity
              style={[
                styles.followButton,
                {
                  backgroundColor: item.is_following
                    ? 'transparent'
                    : '#192A4A',
                  borderWidth: 1,
                  borderColor: item.is_following ? colors.border : '#C8A25F',
                },
              ]}
              onPress={() => handleFollowToggle(item.id)}
            >
              <Text
                style={[
                  styles.followButtonText,
                  { color: item.is_following ? colors.text : '#FFFFFF' },
                ]}
              >
                {item.is_following ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const getDisplayedPages = () => {
    let filtered: BusinessPage[] = [];
    switch (activeTab) {
      case 'following':
        filtered = pages.filter((p) => p.is_following);
        break;
      case 'manage':
        filtered = managedPages;
        break;
      case 'discover':
      default:
        filtered = pages;
        break;
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((p) => 
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce search - no need to do anything else, filtering happens in getDisplayedPages
    searchTimeoutRef.current = setTimeout(() => {
      // Search is handled by getDisplayedPages which is called on render
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    tabsContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    searchContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
    },
    clearButton: {
      marginLeft: 8,
    },
    createButtonIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#192A4A',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#C8A25F',
    },
    pageCard: {
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
    },
    coverImage: {
      width: '100%',
      height: 100,
    },
    profileImageContainer: {
      position: 'absolute',
      top: 50,
      left: 16,
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 3,
      borderColor: '#FFFFFF',
      overflow: 'hidden',
    },
    profileImage: {
      width: '100%',
      height: '100%',
    },
    verifiedBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: '#FFFFFF',
      borderRadius: 10,
    },
    pageInfo: {
      paddingTop: 50,
      padding: 16,
    },
    pageName: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 6,
    },
    pageDescription: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
    },
    pageStats: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statText: {
      fontSize: 13,
      fontWeight: '600',
    },
    categoryBadge: {
      backgroundColor: 'rgba(0,0,0,0.05)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    categoryText: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    followButton: {
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
    },
    followButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 16,
    },
  });

  const tabs: { id: TabType; label: string }[] = [
    { id: 'discover', label: 'Discover' },
    { id: 'following', label: 'Following' },
    { id: 'manage', label: 'Manage' },
  ];

  const displayedPages = getDisplayedPages();

  return (
    <View style={styles.container}>
      <AppNavbar title="Pages" showProfileImage={false} />
      
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab.id ? colors.primary : colors.textSecondary },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search and Create Button Row */}
      <View style={styles.searchRow}>
        <View style={[styles.searchContainer, { backgroundColor: isDark ? colors.backgroundSecondary : '#F8F9FF', borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search pages..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      <TouchableOpacity
          style={styles.createButtonIcon}
        onPress={() => router.push('/pages/create')}
      >
          <Ionicons name="add-circle" size={32} color="#C8A25F" />
      </TouchableOpacity>
      </View>

      {/* Pages List */}
      <FlatList
        data={displayedPages}
        renderItem={renderPage}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        removeClippedSubviews={true}
        windowSize={10}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyText}>
                {activeTab === 'following'
                  ? "You're not following any pages yet"
                  : activeTab === 'manage'
                  ? "You don't manage any pages yet"
                  : 'No pages found'}
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}
      />

      <ImageGallery
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
        images={galleryImages}
        initialIndex={galleryIndex}
      />
    </View>
  );
}

