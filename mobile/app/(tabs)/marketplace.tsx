import React, { useState, useEffect, useCallback } from 'react';
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
import { resolveRemoteUrl } from '../../utils/url';

interface MarketplaceListing {
  id: number;
  seller: {
    id: string;
    username: string;
    profile_image_url?: string;
  };
  title: string;
  description: string;
  price: string;
  condition: string;
  location: string;
  media?: Array<{ id: number; url: string; order: number }>;
  created_at: string;
  views_count: number;
  saved_count: number;
}

interface MarketplaceCategory {
  id: number;
  name: string;
  slug: string;
}

export default function MarketplaceScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showError } = useToast();
  const router = useRouter();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const loadListings = useCallback(async (append = false) => {
    try {
      if (!append) {
        setLoading(true);
      }
      
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory) params.append('category', selectedCategory);
      
      const response = await apiClient.get<any>(
        `/marketplace/listings/?${params.toString()}`
      );
      
      if (append) {
        setListings((prev) => [...prev, ...response.results]);
      } else {
        setListings(response.results || []);
      }
      setNext(response.next);
    } catch (error) {
      showError('Failed to load listings');
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, selectedCategory]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await apiClient.get<any>('/marketplace/categories/');
      setCategories(response.results || response);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  useEffect(() => {
    loadListings();
    loadCategories();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadListings();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadListings();
  }, [loadListings]);

  const loadMore = () => {
    if (next && !loading) {
      loadListings(true);
    }
  };

  const conditionLabels: Record<string, string> = {
    new: 'New',
    like_new: 'Like New',
    used: 'Used',
    fair: 'Fair',
    poor: 'Poor',
  };

  const renderListing = ({ item }: { item: MarketplaceListing }) => {
    const mainImage = item.media && item.media.length > 0 
      ? resolveRemoteUrl(item.media[0].url) 
      : null;

    return (
      <TouchableOpacity
        style={[
          styles.listingCard,
          {
            backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
            borderColor: colors.border,
          },
        ]}
        onPress={() => router.push(`/marketplace/${item.id}`)}
        activeOpacity={0.7}
      >
        {/* Image */}
        {mainImage ? (
          <Image source={{ uri: mainImage }} style={styles.listingImage} />
        ) : (
          <View
            style={[
              styles.listingImage,
              styles.listingImagePlaceholder,
              { backgroundColor: colors.border },
            ]}
          >
            <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
          </View>
        )}

        {/* Content */}
        <View style={styles.listingContent}>
          <Text
            style={[styles.listingTitle, { color: colors.text }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          
          <View style={styles.listingMeta}>
            <Text style={[styles.listingPrice, { color: colors.primary }]}>
              ${parseFloat(item.price).toFixed(2)}
            </Text>
            <View style={styles.listingCondition}>
              <Text style={[styles.listingConditionText, { color: colors.textSecondary }]}>
                {conditionLabels[item.condition] || item.condition}
              </Text>
            </View>
          </View>

          {item.location && (
            <View style={styles.listingLocation}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text
                style={[styles.listingLocationText, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {item.location.split(',')[0]}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      height: 40,
      backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
      color: colors.text,
      fontSize: 14,
    },
    createButton: {
      backgroundColor: '#192A4A', // Deep blue from gradient
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: '#C8A25F', // Gold border
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 4,
    },
    createButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    categoriesWrapper: {
      paddingBottom: 8,
    },
    categoriesContainer: {
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    categoryChip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      marginRight: 8,
      borderWidth: 1,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    categoryChipText: {
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 16,
    },
    listingCard: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
    },
    listingImage: {
      width: 120,
      height: 120,
    },
    listingImagePlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    listingContent: {
      flex: 1,
      padding: 12,
      justifyContent: 'space-between',
    },
    listingTitle: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 6,
    },
    listingMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    listingPrice: {
      fontSize: 17,
      fontWeight: '700',
    },
    listingCondition: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      backgroundColor: 'rgba(0,0,0,0.05)',
    },
    listingConditionText: {
      fontSize: 11,
      fontWeight: '600',
    },
    listingLocation: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    listingLocationText: {
      fontSize: 12,
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

  return (
    <View style={styles.container}>
      <AppNavbar title="Marketplace" showProfileImage={false} />
      
      {/* Search and Create */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search listings..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/marketplace/create')}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Sell</Text>
        </TouchableOpacity>
      </View>

      {/* Categories */}
      {categories.length > 0 && (
        <View style={styles.categoriesWrapper}>
          <FlatList
            horizontal
            data={[{ id: 0, name: 'All', slug: '' }, ...categories]}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => {
              const isSelected = selectedCategory === item.slug || (!selectedCategory && item.slug === '');
              return (
                <TouchableOpacity
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isSelected ? '#192A4A' : 'transparent',
                      borderColor: isSelected ? '#C8A25F' : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedCategory(item.slug === '' ? null : item.slug)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: isSelected ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.categoriesContainer}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      {/* Listings */}
      <FlatList
        data={listings}
        renderItem={renderListing}
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
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="storefront-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyText}>
                No listings found{searchQuery ? ` for "${searchQuery}"` : ''}
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}
      />
    </View>
  );
}

