import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../utils/url';
import UserProfileBottomSheet from './profile/UserProfileBottomSheet';

type SearchResult = {
  id: number;
  type: 'post' | 'user' | 'page' | 'marketplace' | 'animal' | 'breeder';
  title: string;
  description?: string;
  image?: string;
  href: string;
};

type SearchTab = 'all' | 'post' | 'user' | 'page' | 'marketplace' | 'animal' | 'breeder';

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SearchModal({ visible, onClose }: SearchModalProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [posts, setPosts] = useState<SearchResult[]>([]);
  const [users, setUsers] = useState<SearchResult[]>([]);
  const [pages, setPages] = useState<SearchResult[]>([]);
  const [marketplace, setMarketplace] = useState<SearchResult[]>([]);
  const [animals, setAnimals] = useState<SearchResult[]>([]);
  const [breeders, setBreeders] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [profileBottomSheetVisible, setProfileBottomSheetVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | number | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Focus search input when modal opens
  useEffect(() => {
    if (visible) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setAllResults([]);
      setPosts([]);
      setUsers([]);
      setPages([]);
      setMarketplace([]);
      setAnimals([]);
      setBreeders([]);
    }
  }, [visible]);

  const performSearch = useCallback(
    async (searchQuery: string, entityType: SearchTab = 'all') => {
      if (!searchQuery.trim() || !user) {
        setAllResults([]);
        setPosts([]);
        setUsers([]);
        setPages([]);
        setMarketplace([]);
        setAnimals([]);
        setBreeders([]);
        return;
      }

      setSearching(true);
      try {
        const response = await apiClient.get(
          `/search/?q=${encodeURIComponent(searchQuery)}&type=${entityType}`
        );

        if (entityType === 'all') {
          setAllResults(response.all || []);
          setPosts(response.posts || []);
          setUsers(response.users || []);
          setPages(response.pages || []);
          setMarketplace(response.marketplace || []);
          setAnimals(response.animals || []);
          setBreeders(response.breeders || []);
        } else {
          // Update specific category
          switch (entityType) {
            case 'post':
              setPosts(response.posts || []);
              break;
            case 'user':
              setUsers(response.users || []);
              break;
            case 'page':
              setPages(response.pages || []);
              break;
            case 'marketplace':
              setMarketplace(response.marketplace || []);
              break;
            case 'animal':
              setAnimals(response.animals || []);
              break;
            case 'breeder':
              setBreeders(response.breeders || []);
              break;
          }
        }
      } catch (error) {
        console.error('Search failed:', error);
        setAllResults([]);
        setPosts([]);
        setUsers([]);
        setPages([]);
        setMarketplace([]);
        setAnimals([]);
        setBreeders([]);
      } finally {
        setSearching(false);
      }
    },
    [user]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setQuery(value);

      // Debounce search
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (value.trim()) {
        searchTimeoutRef.current = setTimeout(() => {
          performSearch(value, activeTab);
        }, 300);
      } else {
        setAllResults([]);
        setPosts([]);
        setUsers([]);
        setPages([]);
        setMarketplace([]);
        setAnimals([]);
        setBreeders([]);
      }
    },
    [performSearch, activeTab]
  );

  const handleTabChange = useCallback(
    (tab: SearchTab) => {
      setActiveTab(tab);
      if (query.trim()) {
        performSearch(query, tab);
      }
    },
    [query, performSearch]
  );

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      // Extract ID from href or use result.id
      const id = result.id;
      
      // Route based on type
      switch (result.type) {
        case 'user':
          // Open user profile bottom sheet
          const userIdMatch = result.href.match(/\/users\/(\d+)/) || result.href.match(/\/app\/users\/(\d+)/);
          const userId = userIdMatch ? userIdMatch[1] : id.toString();
          setSelectedUserId(userId);
          setProfileBottomSheetVisible(true);
          onClose();
          return;
          
        case 'post':
          // Extract post ID from href or use result.id
          const postIdMatch = result.href.match(/\/feed\/(\d+)/) || 
                             result.href.match(/\/posts\/(\d+)/) ||
                             result.href.match(/\/app\/feed\/(\d+)/);
          const postId = postIdMatch ? postIdMatch[1] : id.toString();
          router.push(`/(tabs)/feed/${postId}` as any);
          break;
          
        case 'page':
          // Extract page ID from href or use result.id
          const pageIdMatch = result.href.match(/\/pages\/(\d+)/) || 
                             result.href.match(/\/app\/pages\/(\d+)/);
          const pageId = pageIdMatch ? pageIdMatch[1] : id.toString();
          router.push(`/pages/${pageId}` as any);
          break;
          
        case 'marketplace':
          // Extract marketplace ID from href or use result.id
          const marketplaceIdMatch = result.href.match(/\/marketplace\/(\d+)/) || 
                                    result.href.match(/\/app\/marketplace\/(\d+)/);
          const marketplaceId = marketplaceIdMatch ? marketplaceIdMatch[1] : id.toString();
          router.push(`/marketplace/${marketplaceId}` as any);
          break;
          
        case 'animal':
          // Extract animal ID from href or use result.id
          const animalIdMatch = result.href.match(/\/animals\/(\d+)/) || 
                               result.href.match(/\/app\/animals\/(\d+)/);
          const animalId = animalIdMatch ? animalIdMatch[1] : id.toString();
          router.push(`/animals/${animalId}` as any);
          break;
          
        case 'breeder':
          // Extract breeder ID from href or use result.id
          const breederIdMatch = result.href.match(/\/breeders\/(\d+)/) || 
                                result.href.match(/\/app\/breeders\/(\d+)/);
          const breederId = breederIdMatch ? breederIdMatch[1] : id.toString();
          // Route to breeder profile (assuming it follows similar pattern to users)
          router.push(`/breeders/${breederId}` as any);
          break;
          
        default:
          // Fallback: try to convert href format
          let mobileRoute = result.href
            .replace('/app/feed/', '/(tabs)/feed/')
            .replace('/app/users/', '/(tabs)/users/')
            .replace('/app/pages/', '/pages/')
            .replace('/app/marketplace/', '/marketplace/')
            .replace('/app/animals/', '/animals/')
            .replace('/app/breeders/', '/breeders/');
          
          // If still contains /app/, try to extract ID and route by type
          if (mobileRoute.includes('/app/')) {
            const fallbackIdMatch = result.href.match(/\/(\d+)\/?$/);
            if (fallbackIdMatch) {
              const fallbackId = fallbackIdMatch[1];
              switch (result.type) {
                case 'post':
                  mobileRoute = `/(tabs)/feed/${fallbackId}`;
                  break;
                case 'page':
                  mobileRoute = `/pages/${fallbackId}`;
                  break;
                case 'marketplace':
                  mobileRoute = `/marketplace/${fallbackId}`;
                  break;
                case 'animal':
                  mobileRoute = `/animals/${fallbackId}`;
                  break;
                default:
                  console.warn('Unknown result type:', result.type, result.href);
                  return;
              }
            }
          }
          
          router.push(mobileRoute as any);
      }
      
      onClose();
      setQuery('');
      setAllResults([]);
      setPosts([]);
      setUsers([]);
      setPages([]);
      setMarketplace([]);
      setAnimals([]);
      setBreeders([]);
    },
    [router, onClose]
  );

  const getCurrentResults = (): SearchResult[] => {
    switch (activeTab) {
      case 'post':
        return posts;
      case 'user':
        return users;
      case 'page':
        return pages;
      case 'marketplace':
        return marketplace;
      case 'animal':
        return animals;
      case 'breeder':
        return breeders;
      default:
        return allResults;
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'post':
        return '📝';
      case 'user':
        return '👤';
      case 'page':
        return '📄';
      case 'marketplace':
        return '🛒';
      case 'animal':
        return '🐾';
      case 'breeder':
        return '🏆';
      default:
        return '🔍';
    }
  };

  const getResultLabel = (type: string) => {
    switch (type) {
      case 'post':
        return 'Post';
      case 'user':
        return 'Person';
      case 'page':
        return 'Page';
      case 'marketplace':
        return 'Marketplace';
      case 'animal':
        return 'Animal';
      case 'breeder':
        return 'Breeder';
      default:
        return 'Result';
    }
  };

  const tabs: SearchTab[] = ['all', 'post', 'user', 'page', 'marketplace', 'animal', 'breeder'];
  const currentResults = getCurrentResults();

  const dynamicStyles = StyleSheet.create({
    modalContainer: {
      backgroundColor: colors.background,
    },
    searchInput: {
      backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
      color: colors.text,
      borderColor: colors.border,
    },
    tabButton: {
      borderColor: colors.border,
    },
    tabButtonActive: {
      borderBottomColor: '#4F8EF7',
    },
    tabText: {
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: '#4F8EF7',
    },
    resultItem: {
      backgroundColor: colors.background,
      borderBottomColor: colors.border,
    },
    resultTitle: {
      color: colors.text,
    },
    resultDescription: {
      color: colors.textSecondary,
    },
    emptyText: {
      color: colors.textSecondary,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalContainer, dynamicStyles.modalContainer]}>
          {/* Search Header */}
          <View style={styles.searchHeader}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              ref={searchInputRef}
              style={[styles.searchInput, dynamicStyles.searchInput]}
              placeholder="Search posts, people, pages, marketplace..."
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={handleSearchChange}
            />
            {query ? (
              <TouchableOpacity
                onPress={() => {
                  setQuery('');
                  setAllResults([]);
                  setPosts([]);
                  setUsers([]);
                  setPages([]);
                  setMarketplace([]);
                  setAnimals([]);
                  setBreeders([]);
                  searchInputRef.current?.focus();
                }}
              >
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>

          {/* Tabs */}
          {query ? (
            <View style={styles.tabsContainer}>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={tabs}
                keyExtractor={(item) => item}
                renderItem={({ item: tab }) => {
                  const isActive = activeTab === tab;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.tabButton,
                        dynamicStyles.tabButton,
                        isActive && dynamicStyles.tabButtonActive,
                      ]}
                      onPress={() => handleTabChange(tab)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          dynamicStyles.tabText,
                          isActive && dynamicStyles.tabTextActive,
                        ]}
                      >
                        {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.tabsContent}
              />
            </View>
          ) : null}

          {/* Search Results */}
          <View style={styles.resultsContainer}>
            {searching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4F8EF7" />
              </View>
            ) : currentResults.length > 0 ? (
              <FlatList
                data={currentResults}
                keyExtractor={(item) => `${item.type}-${item.id}`}
                renderItem={({ item: result }) => (
                  <TouchableOpacity
                    style={[styles.resultItem, dynamicStyles.resultItem]}
                    onPress={() => handleResultClick(result)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.resultContent}>
                      {/* Icon/Avatar */}
                      <View style={styles.resultIcon}>
                        {(result.type === 'user' || result.type === 'page') && result.image ? (
                          <Image
                            source={{ uri: resolveRemoteUrl(result.image) }}
                            style={[
                              styles.resultImage,
                              result.type === 'user' ? styles.resultImageRound : styles.resultImageSquare,
                            ]}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.resultIconPlaceholder}>
                            <Text style={styles.resultIconText}>{getResultIcon(result.type)}</Text>
                          </View>
                        )}
                      </View>

                      {/* Result Info */}
                      <View style={styles.resultInfo}>
                        <Text style={[styles.resultTitle, dynamicStyles.resultTitle]} numberOfLines={1}>
                          {result.title}
                        </Text>
                        {result.description ? (
                          <Text style={[styles.resultDescription, dynamicStyles.resultDescription]} numberOfLines={1}>
                            {result.description}
                          </Text>
                        ) : null}
                      </View>

                      {/* Badge */}
                      <View style={styles.resultBadge}>
                        <Text style={styles.resultBadgeText}>{getResultLabel(result.type)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              />
            ) : query ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, dynamicStyles.emptyText]}>
                  No {activeTab === 'all' ? '' : activeTab} results found for "{query}"
                </Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, dynamicStyles.emptyText]}>
                  Start typing to search Liberty Social
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* User Profile Bottom Sheet */}
      <UserProfileBottomSheet
        visible={profileBottomSheetVisible}
        userId={selectedUserId}
        onClose={() => {
          setProfileBottomSheetVisible(false);
          setSelectedUserId(null);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 14,
    borderWidth: 1,
  },
  tabsContainer: {
    borderBottomWidth: 1,
  },
  tabsContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  resultItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  resultContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultIcon: {
    width: 40,
    height: 40,
  },
  resultImage: {
    width: '100%',
    height: '100%',
  },
  resultImageRound: {
    borderRadius: 20,
  },
  resultImageSquare: {
    borderRadius: 8,
  },
  resultIconPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIconText: {
    fontSize: 20,
  },
  resultInfo: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  resultDescription: {
    fontSize: 12,
  },
  resultBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

