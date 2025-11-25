import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import AnimalListingCard from '../../components/animals/AnimalListingCard';

interface AnimalListing {
  id: string;
  title: string;
  breed: string;
  category: {
    id: string;
    name: string;
  };
  price?: number;
  listing_type: 'sale' | 'adoption' | 'rehoming';
  location: string;
  animal_listing_media?: Array<{
    id: string;
    url: string;
  }>;
  status: string;
  risk_score?: number;
  seller_verified?: boolean;
  has_vet_documentation?: boolean;
}

interface AnimalCategory {
  id: string;
  name: string;
}

export default function AnimalsScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showError } = useToast();
  const router = useRouter();
  const [listings, setListings] = useState<AnimalListing[]>([]);
  const [categories, setCategories] = useState<AnimalCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    listing_type: '',
    category_id: '',
    price_min: '',
    price_max: '',
    risk_level: '',
  });
  const isInitialMount = useRef(true);

  const loadListings = useCallback(async (append = false) => {
    try {
      if (!append) {
        setLoading(true);
      }

      const params = new URLSearchParams();
      // Backend expects 'q' for search, not 'search'
      if (searchQuery) params.append('q', searchQuery);
      if (filters.listing_type) params.append('listing_type', filters.listing_type);
      // Backend filterset_fields uses 'category' - it expects the category ID
      if (filters.category_id) params.append('category', filters.category_id);
      // Backend expects 'min_price' and 'max_price', not 'price_min' and 'price_max'
      if (filters.price_min) params.append('min_price', filters.price_min);
      if (filters.price_max) params.append('max_price', filters.price_max);
      if (filters.risk_level === 'low') {
        params.append('risk_score_min', '0');
        params.append('risk_score_max', '30');
      } else if (filters.risk_level === 'medium') {
        params.append('risk_score_min', '31');
        params.append('risk_score_max', '60');
      } else       if (filters.risk_level === 'high') {
        params.append('risk_score_min', '61');
        params.append('risk_score_max', '100');
      }

      const queryString = params.toString();
      const url = queryString ? `/animals/listings/?${queryString}` : '/animals/listings/';
      const response = await apiClient.get<any>(url);

      if (append) {
        setListings((prev) => [...prev, ...(response.results || response || [])]);
      } else {
        // Always replace listings when not appending (filtering/searching)
        setListings(response.results || response || []);
      }
      setNext(response.next || null);
    } catch (error) {
      showError('Failed to load listings');
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, filters]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await apiClient.get<any>('/animals/categories/');
      setCategories(response.results || response);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  useEffect(() => {
    loadListings();
    loadCategories();
    isInitialMount.current = false;
  }, []);

  // Debounce search query to avoid too many API calls
  useEffect(() => {
    if (isInitialMount.current) return;
    
    const timeoutId = setTimeout(() => {
      loadListings();
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [searchQuery, loadListings]);

  // Reload immediately when filters change (no debounce for filters)
  useEffect(() => {
    // Skip initial mount - filters will be loaded by the initial useEffect
    if (isInitialMount.current) return;
    
    loadListings();
  }, [filters.listing_type, filters.category_id, filters.price_min, filters.price_max, filters.risk_level, loadListings]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadListings();
  };

  const handleLoadMore = () => {
    if (next && !loading) {
      loadListings(true);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    setFilters((prev) => ({
      ...prev,
      category_id: prev.category_id === categoryId ? '' : categoryId,
    }));
  };

  const handleListingTypeSelect = (type: string) => {
    setFilters((prev) => ({
      ...prev,
      listing_type: prev.listing_type === type ? '' : type,
    }));
  };

  const resetFilters = () => {
    setFilters({
      listing_type: '',
      category_id: '',
      price_min: '',
      price_max: '',
      risk_level: '',
    });
    setSearchQuery('');
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: colors.background,
    },
    searchInput: {
      backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
      color: colors.text,
      borderColor: colors.border,
    },
    categoryChip: {
      borderColor: colors.border,
    },
    categoryChipActive: {
      backgroundColor: '#C8A25F',
      borderColor: '#C8A25F',
    },
    categoryChipText: {
      color: colors.text,
    },
    categoryChipTextActive: {
      color: '#FFFFFF',
    },
    emptyText: {
      color: colors.textSecondary,
    },
  });

  const renderListing = ({ item }: { item: AnimalListing }) => (
    <AnimalListingCard
      {...item}
      onPress={() => {
        (global as any).hideTabBar?.();
        router.push(`/animals/${item.id}`);
      }}
    />
  );

  // Check if filters are active
  const hasActiveFilters = filters.listing_type || filters.category_id || filters.price_min || filters.price_max || filters.risk_level || searchQuery;

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      <AppNavbar title="Animal Marketplace" />
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchInput, dynamicStyles.searchInput]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInputText, { color: colors.text }]}
            placeholder="Search by breed, name..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Ionicons name="refresh" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Listing Type Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['sale', 'adoption', 'rehoming']}
          keyExtractor={(item) => item}
          renderItem={({ item: type }) => {
            const isActive = filters.listing_type === type;
            return (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  dynamicStyles.categoryChip,
                  isActive && dynamicStyles.categoryChipActive,
                ]}
                onPress={() => handleListingTypeSelect(type)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    dynamicStyles.categoryChipText,
                    isActive && dynamicStyles.categoryChipTextActive,
                  ]}
                >
                  {type === 'sale' ? 'For Sale' : type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.filtersContent}
        />
      </View>

      {/* Category Filters */}
      {categories.length > 0 && (
        <View style={styles.filtersContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories}
            keyExtractor={(item) => item.id}
            renderItem={({ item: category }) => {
              const isActive = filters.category_id === category.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    dynamicStyles.categoryChip,
                    isActive && dynamicStyles.categoryChipActive,
                  ]}
                  onPress={() => handleCategorySelect(category.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      dynamicStyles.categoryChipText,
                      isActive && dynamicStyles.categoryChipTextActive,
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.filtersContent}
          />
        </View>
      )}

      {/* Create Button */}
      <View style={styles.createButtonContainer}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/animals/create')}
        >
          <Ionicons name="add-circle" size={20} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Create Listing</Text>
        </TouchableOpacity>
      </View>

      {/* Listings */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="paw-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, dynamicStyles.emptyText]}>
            {hasActiveFilters 
              ? 'No listings match your filters. Try adjusting your search or filters.' 
              : 'No listings found'}
          </Text>
          {hasActiveFilters && (
            <TouchableOpacity
              style={[styles.resetFiltersButton, { borderColor: colors.primary }]}
              onPress={resetFilters}
            >
              <Text style={[styles.resetFiltersText, { color: colors.primary }]}>
                Clear Filters
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={listings}
          renderItem={renderListing}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListFooterComponent={
            next ? (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    borderRadius: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInputText: {
    flex: 1,
    fontSize: 14,
  },
  refreshButton: {
    padding: 8,
  },
  filtersContainer: {
    paddingBottom: 8,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  createButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  createButton: {
    backgroundColor: '#192A4A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#C8A25F',
    shadowColor: '#C8A25F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  loadMoreContainer: {
    padding: 16,
    alignItems: 'center',
  },
  resetFiltersButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  resetFiltersText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

