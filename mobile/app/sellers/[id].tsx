import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';

interface SellerProfile {
  id: string;
  username: string;
  profile_image_url?: string;
  bio?: string;
  listings_count: number;
  rating?: number;
  total_reviews?: number;
  joined_date: string;
}

interface Listing {
  id: number;
  title: string;
  price: string;
  condition: string;
  media?: Array<{ url: string }>;
  created_at: string;
}

export default function SellerDetailScreen() {
  const { colors, isDark } = useTheme();
  const { showError } = useToast();
  const router = useRouter();
  const { id: idParam } = useLocalSearchParams();
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  // Normalize the ID - handle both string and array cases from useLocalSearchParams
  const sellerId = Array.isArray(idParam) ? idParam[0] : idParam;

  useEffect(() => {
    if (sellerId) {
      loadSellerData();
    }
  }, [sellerId]);

  const loadSellerData = async () => {
    if (!sellerId) return;
    
    try {
      setLoading(true);
      
      // Normalize seller ID to string for API call
      const sellerIdStr = String(sellerId);
      
      // Load seller's listings - filter by seller_id
      const listingsData = await apiClient.get<any>(
        `/marketplace/listings/?seller_id=${sellerIdStr}`
      );
      const allListings = listingsData.results || listingsData || [];
      
      // Additional client-side filtering to ensure only this seller's listings are shown
      // Compare both as strings and as original types to handle UUID vs number cases
      const listings = allListings.filter((listing: any) => {
        const listingSellerId = listing.seller?.id;
        if (!listingSellerId) return false;
        
        // Compare as strings (handles UUID strings)
        if (String(listingSellerId) === sellerIdStr) return true;
        
        // Also compare as original types (handles numeric IDs)
        if (listingSellerId === sellerId) return true;
        
        return false;
      });
      
      console.log('Seller ID:', sellerId, 'Listings found:', listings.length, 'Total fetched:', allListings.length);
      
      setListings(listings);

      // Extract seller info from listings or load from users endpoint
      if (listings.length > 0 && listings[0].seller) {
        setSeller({
          id: String(listings[0].seller.id),
          username: listings[0].seller.username,
          profile_image_url: listings[0].seller.profile_image_url,
          bio: '',
          listings_count: listings.length,
          joined_date: new Date().toISOString(),
        });
      } else {
        // Try to load user profile as fallback
        try {
          const userData = await apiClient.get<any>(`/auth/users/${sellerIdStr}/`);
          setSeller({
            id: String(userData.id),
            username: userData.username,
            profile_image_url: userData.profile_image_url,
            bio: userData.bio || '',
            listings_count: listings.length,
            joined_date: userData.created_at || new Date().toISOString(),
          });
        } catch (userError) {
          console.error('Could not load user profile:', userError);
          // Set minimal seller info
          setSeller({
            id: sellerIdStr,
            username: 'Seller',
            listings_count: listings.length,
            joined_date: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      showError('Failed to load seller profile');
      console.error(error);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const renderListing = ({ item }: { item: Listing }) => {
    const mainImage = item.media && item.media.length > 0 
      ? resolveRemoteUrl(item.media[0].url) 
      : null;

    return (
      <TouchableOpacity
        style={[styles.listingCard, { borderColor: colors.border }]}
        onPress={() => router.push(`/marketplace/${item.id}`)}
        activeOpacity={0.7}
      >
        {mainImage ? (
          <Image source={{ uri: mainImage }} style={styles.listingImage} />
        ) : (
          <View style={[styles.listingImage, styles.imagePlaceholder, { backgroundColor: colors.border }]}>
            <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.listingInfo}>
          <Text style={[styles.listingTitle, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[styles.listingPrice, { color: colors.primary }]}>
            ${parseFloat(item.price).toFixed(2)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    header: {
      padding: 16,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      marginBottom: 12,
      borderWidth: 3,
      borderColor: colors.primary,
    },
    username: {
      fontSize: 22,
      fontWeight: '700',
      marginBottom: 8,
    },
    bio: {
      fontSize: 14,
      textAlign: 'center',
      color: colors.textSecondary,
      marginBottom: 16,
      paddingHorizontal: 20,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 24,
      marginTop: 8,
    },
    stat: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    ratingText: {
      fontSize: 16,
      fontWeight: '600',
    },
    section: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 16,
    },
    listingCard: {
      width: '48%',
      marginBottom: 16,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
    },
    listingImage: {
      width: '100%',
      height: 120,
    },
    imagePlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    listingInfo: {
      padding: 10,
    },
    listingTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 6,
    },
    listingPrice: {
      fontSize: 16,
      fontWeight: '700',
    },
    emptyContainer: {
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 12,
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <AppNavbar showProfileImage={false} showBackButton={true} onBackPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!seller) {
    return (
      <View style={styles.container}>
        <AppNavbar showProfileImage={false} showBackButton={true} onBackPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
            Seller not found
          </Text>
        </View>
      </View>
    );
  }

  const profileImage = seller.profile_image_url
    ? resolveRemoteUrl(seller.profile_image_url)
    : null;
  const profileSource = profileImage ? { uri: profileImage } : DEFAULT_AVATAR;

  return (
    <View style={styles.container}>
      <AppNavbar showProfileImage={false} showBackButton={true} onBackPress={() => router.back()} />
      
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Image source={profileSource} style={styles.avatar} />
          <Text style={[styles.username, { color: colors.text }]}>{seller.username}</Text>
          
          {seller.bio && (
            <Text style={styles.bio}>{seller.bio}</Text>
          )}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {seller.listings_count || 0}
              </Text>
              <Text style={styles.statLabel}>Listings</Text>
            </View>
            
            {seller.rating && (
              <View style={styles.stat}>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={18} color="#FFB800" />
                  <Text style={[styles.ratingText, { color: colors.text }]}>
                    {seller.rating.toFixed(1)}
                  </Text>
                </View>
                <Text style={styles.statLabel}>
                  {seller.total_reviews || 0} reviews
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Listings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Listings</Text>
          
          {listings.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {listings.map((listing) => (
                <View key={listing.id} style={{ width: '48%' }}>
                  {renderListing({ item: listing })}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="storefront-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText}>No active listings</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

