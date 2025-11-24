import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  is_saved?: boolean;
  contact_preference?: string;
  delivery_options?: string;
}

export default function ListingDetailScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadListing();
  }, [id]);

  const loadListing = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<MarketplaceListing>(
        `/marketplace/listings/${id}/`
      );
      setListing(response);
    } catch (error) {
      showError('Failed to load listing');
      console.error(error);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!listing) return;
    try {
      await apiClient.post(`/marketplace/listings/${listing.id}/save/`, {});
      setListing({ ...listing, is_saved: !listing.is_saved });
      showSuccess(listing.is_saved ? 'Listing unsaved' : 'Listing saved');
    } catch (error) {
      showError('Failed to save listing');
      console.error(error);
    }
  };

  const handleMakeOffer = async () => {
    if (!listing || !offerPrice) return;
    try {
      setSubmitting(true);
      await apiClient.post('/marketplace/offers/', {
        listing_id: listing.id,
        offered_price: offerPrice,
        message: offerMessage,
      });
      showSuccess('Offer sent successfully!');
      setShowOfferModal(false);
      setOfferPrice('');
      setOfferMessage('');
    } catch (error) {
      showError('Failed to make offer');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const conditionLabels: Record<string, string> = {
    new: 'New',
    like_new: 'Like New',
    used: 'Used',
    fair: 'Fair',
    poor: 'Poor',
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    imageContainer: {
      width: SCREEN_WIDTH,
      height: SCREEN_WIDTH,
      backgroundColor: colors.border,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    imagePlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageCounter: {
      position: 'absolute',
      bottom: 16,
      right: 16,
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    imageCounterText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },
    content: {
      padding: 16,
    },
    header: {
      marginBottom: 16,
    },
    price: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 8,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      marginBottom: 8,
    },
    condition: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: 'rgba(0,0,0,0.05)',
      alignSelf: 'flex-start',
    },
    conditionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 8,
    },
    description: {
      fontSize: 15,
      lineHeight: 22,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 12,
    },
    infoLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      width: 100,
    },
    infoValue: {
      fontSize: 14,
      flex: 1,
    },
    seller: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
      borderRadius: 12,
      marginBottom: 16,
    },
    sellerAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginRight: 12,
    },
    sellerInfo: {
      flex: 1,
    },
    sellerName: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 4,
    },
    sellerLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 10,
      gap: 8,
    },
    primaryButton: {
      backgroundColor: '#192A4A',
      borderWidth: 1,
      borderColor: '#C8A25F',
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    buttonText: {
      fontSize: 15,
      fontWeight: '600',
    },
    modalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 16,
    },
    modalContent: {
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderRadius: 16,
      padding: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 20,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      fontSize: 15,
      color: colors.text,
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: colors.border,
    },
    submitButton: {
      backgroundColor: colors.primary,
    },
    modalButtonText: {
      fontSize: 15,
      fontWeight: '600',
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

  if (!listing) {
    return (
      <View style={styles.container}>
        <AppNavbar showProfileImage={false} showBackButton={true} onBackPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
            Listing not found
          </Text>
        </View>
      </View>
    );
  }

  const images = listing.media && listing.media.length > 0
    ? listing.media.map((m) => resolveRemoteUrl(m.url))
    : [];
  const sellerAvatar = listing.seller.profile_image_url
    ? resolveRemoteUrl(listing.seller.profile_image_url)
    : null;
  const sellerSource = sellerAvatar ? { uri: sellerAvatar } : DEFAULT_AVATAR;
  const isOwner = user?.id === listing.seller.id;

  return (
    <View style={styles.container}>
      <AppNavbar showProfileImage={false} showBackButton={true} onBackPress={() => router.back()} />
      
      <ScrollView style={styles.scrollView}>
        {/* Image Gallery */}
        <View style={styles.imageContainer}>
          {images.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setCurrentImageIndex(index);
              }}
            >
              {images.map((url, index) => (
                <Image
                  key={index}
                  source={{ uri: url }}
                  style={styles.image}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Ionicons name="image-outline" size={64} color={colors.textSecondary} />
            </View>
          )}
          {images.length > 1 && (
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>
                {currentImageIndex + 1} / {images.length}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.price, { color: colors.primary }]}>
              ${parseFloat(listing.price).toFixed(2)}
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>{listing.title}</Text>
            <View style={styles.condition}>
              <Text style={styles.conditionText}>
                {conditionLabels[listing.condition] || listing.condition}
              </Text>
            </View>
          </View>

          {/* Seller */}
          <TouchableOpacity
            style={styles.seller}
            onPress={() => router.push(`/sellers/${listing.seller.id}`)}
          >
            <Image source={sellerSource} style={styles.sellerAvatar} />
            <View style={styles.sellerInfo}>
              <Text style={[styles.sellerName, { color: colors.text }]}>
                {listing.seller.username}
              </Text>
              <Text style={styles.sellerLabel}>Seller</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Description */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
            <Text style={[styles.description, { color: colors.text }]}>
              {listing.description}
            </Text>
          </View>

          {/* Details */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {listing.location}
              </Text>
            </View>
            {listing.contact_preference && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Contact</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {listing.contact_preference}
                </Text>
              </View>
            )}
            {listing.delivery_options && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Delivery</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {listing.delivery_options}
                </Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Posted</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {new Date(listing.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Actions */}
      {!isOwner && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={handleSave}
          >
            <Ionicons
              name={listing.is_saved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={colors.text}
            />
            <Text style={[styles.buttonText, { color: colors.text }]}>
              {listing.is_saved ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => setShowOfferModal(true)}
          >
            <Ionicons name="cash-outline" size={20} color="#FFFFFF" />
            <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Make Offer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Offer Modal */}
      <Modal
        visible={showOfferModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOfferModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Make an Offer</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Offer price"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={offerPrice}
              onChangeText={setOfferPrice}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Message (optional)"
              placeholderTextColor={colors.textSecondary}
              multiline
              value={offerMessage}
              onChangeText={setOfferMessage}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowOfferModal(false)}
                disabled={submitting}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleMakeOffer}
                disabled={submitting || !offerPrice}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

