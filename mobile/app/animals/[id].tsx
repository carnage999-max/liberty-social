import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';
import ImageGallery from '../../components/common/ImageGallery';
import LinkifiedText from '../../components/common/LinkifiedText';
import LinkPreviewCard from '../../components/common/LinkPreviewCard';
import ContextMenu from '../../components/common/ContextMenu';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnimalListing {
  id: string;
  title: string;
  breed: string;
  category_name: string;
  description: string;
  price?: number;
  listing_type: 'sale' | 'adoption' | 'rehoming';
  location: string;
  state_code?: string;
  age_years?: number;
  age_months?: number;
  gender?: string;
  color?: string;
  status: string;
  risk_score?: number;
  seller?: {
    id: string;
    username: string;
    display_name?: string;
    avatar?: string;
    is_verified?: boolean;
    average_rating?: number;
    reviews_count?: number;
  };
  media?: Array<{ id: string; url: string; media_type?: string }>;
  animal_listing_media?: Array<{ id: string; url: string }>;
  vet_documentation?: {
    documentation_type: string;
  };
  health_documents?: Array<{
    id: string;
    doc_type: string;
    document_file: string;
    uploaded_at: string;
  }>;
  reviews_count?: number;
}

export default function AnimalListingDetailScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [listing, setListing] = useState<AnimalListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    // Hide tab bar when entering detail page
    (global as any).hideTabBar?.();
    loadListing();
    
    // Show tab bar when leaving
    return () => {
      (global as any).showTabBar?.();
    };
  }, [id]);

  // All hooks must be called before any conditional returns
  // Memoize images
  const images = React.useMemo(() => {
    if (!listing) return [];
    const media = listing.media || listing.animal_listing_media || [];
    return media.map((m: any) => {
      const url = m.url || m.media_url || m.image_url;
      return url ? resolveRemoteUrl(url) : null;
    }).filter((url: string | null) => url !== null) as string[];
  }, [listing]);

  // Memoize seller avatar
  const sellerAvatar = React.useMemo(() => {
    if (!listing?.seller?.avatar) return null;
    return resolveRemoteUrl(listing.seller.avatar);
  }, [listing?.seller?.avatar]);

  const sellerSource = React.useMemo(() => {
    return sellerAvatar ? { uri: sellerAvatar } : DEFAULT_AVATAR;
  }, [sellerAvatar]);

  // Check ownership
  const isOwner = React.useMemo(() => {
    return user?.id === listing?.seller?.id;
  }, [user?.id, listing?.seller?.id]);

  const isHighRisk = React.useMemo(() => {
    return listing?.risk_score ? listing.risk_score > 60 : false;
  }, [listing?.risk_score]);

  const isVerified = React.useMemo(() => {
    return listing?.seller?.is_verified && listing?.vet_documentation?.documentation_type !== 'unknown';
  }, [listing?.seller?.is_verified, listing?.vet_documentation?.documentation_type]);

  // Context menu options
  const contextMenuOptions = React.useMemo(() => {
    if (!isOwner) return [];
    return [
      {
        label: 'Edit Listing',
        icon: 'create-outline' as const,
        onPress: () => router.push(`/animals/${id}/edit`),
      },
      {
        label: 'Delete Listing',
        icon: 'trash-outline' as const,
        onPress: () => setShowDeleteConfirm(true),
        destructive: true,
      },
    ];
  }, [isOwner, id, router]);

  const loadListing = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<AnimalListing>(`/animals/listings/${id}/`);
      setListing(response);
    } catch (error) {
      showError('Failed to load listing');
      console.error(error);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleContact = async () => {
    if (!listing || !contactPhone || !contactMessage) return;
    try {
      setSubmitting(true);
      // Contact API call would go here
      showSuccess('Message sent to seller');
      setShowContactModal(false);
      setContactPhone('');
      setContactMessage('');
    } catch (error) {
      showError('Failed to send message');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!listing) return;
    try {
      setDeleting(true);
      await apiClient.delete(`/animals/listings/${listing.id}/`);
      showSuccess('Listing deleted successfully');
      router.push('/(tabs)/animals');
    } catch (error) {
      showError('Failed to delete listing');
      console.error(error);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatAge = () => {
    if (!listing) return 'N/A';
    const years = listing.age_years || 0;
    const months = listing.age_months || 0;
    if (years === 0 && months === 0) return 'N/A';
    const parts = [];
    if (years > 0) parts.push(`${years}y`);
    if (months > 0) parts.push(`${months}m`);
    return parts.join(' ');
  };

  const getPriceDisplay = () => {
    if (!listing) return '';
    if (listing.listing_type === 'adoption') {
      return 'Free for Adoption';
    }
    if (listing.listing_type === 'rehoming') {
      return 'Contact Seller';
    }
    return listing.price ? `$${listing.price.toLocaleString()}` : 'Contact for price';
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
    tags: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
      flexWrap: 'wrap',
    },
    tag: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    tagText: {
      fontSize: 12,
      fontWeight: '600',
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
      borderWidth: 2,
      borderColor: '#C8A25F',
      shadowColor: '#C8A25F',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
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
      backgroundColor: '#192A4A',
      borderWidth: 1,
      borderColor: '#C8A25F',
    },
    modalButtonText: {
      fontSize: 15,
      fontWeight: '600',
    },
    riskBadge: {
      position: 'absolute',
      top: 16,
      left: 16,
      backgroundColor: 'rgba(239, 68, 68, 0.9)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    riskBadgeText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    verifiedBadge: {
      position: 'absolute',
      top: 16,
      right: 16,
      backgroundColor: 'rgba(16, 185, 129, 0.9)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    verifiedBadgeText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    statsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 24,
    },
    statCard: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
    },
    menuButton: {
      padding: 4,
    },
    deleteModalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 16,
    },
    deleteModalContent: {
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderRadius: 16,
      padding: 20,
    },
    deleteModalTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 12,
    },
    deleteModalText: {
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 20,
    },
    deleteModalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    deleteModalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    deleteModalCancel: {
      backgroundColor: colors.border,
    },
    deleteModalDelete: {
      backgroundColor: '#EF4444',
    },
    deleteModalButtonText: {
      fontSize: 15,
      fontWeight: '600',
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <AppNavbar 
        showProfileImage={false} 
        showSearchIcon={false} 
        showMessageIcon={false}
        showBackButton={true} 
        onBackPress={() => {
          (global as any).showTabBar?.();
          router.push('/(tabs)/animals');
        }} 
      />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.container}>
        <AppNavbar 
        showProfileImage={false} 
        showSearchIcon={false} 
        showMessageIcon={false}
        showBackButton={true} 
        onBackPress={() => {
          (global as any).showTabBar?.();
          router.push('/(tabs)/animals');
        }} 
      />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
            Listing not found
          </Text>
        </View>
      </View>
    );
  }


  return (
    <View style={styles.container}>
      <AppNavbar 
        showProfileImage={false} 
        showSearchIcon={false} 
        showMessageIcon={false}
        showBackButton={true} 
        onBackPress={() => {
          (global as any).showTabBar?.();
          router.push('/(tabs)/animals');
        }}
        customRightButton={
          isOwner ? (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => setShowContextMenu(true)}
            >
              <Ionicons name="ellipsis-vertical" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ) : undefined
        }
      />
      
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
                <View key={index} style={{ width: SCREEN_WIDTH }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      setGalleryIndex(index);
                      setGalleryVisible(true);
                    }}
                  >
                    <Image
                      source={{ uri: url }}
                      style={styles.image}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={200}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Ionicons name="paw-outline" size={64} color={colors.textSecondary} />
            </View>
          )}
          {images.length > 1 && (
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>
                {currentImageIndex + 1} / {images.length}
              </Text>
            </View>
          )}
          {isHighRisk && (
            <View style={styles.riskBadge}>
              <Text style={styles.riskBadgeText}>⚠ High Risk</Text>
            </View>
          )}
          {isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
              <Text style={styles.verifiedBadgeText}>Verified Seller</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.price, { color: colors.primary }]}>
              {getPriceDisplay()}
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>{listing.title}</Text>
            <View style={styles.tags}>
              <View style={[styles.tag, { backgroundColor: '#F3F4F6' }]}>
                <Text style={[styles.tagText, { color: '#374151' }]}>
                  {listing.category_name}
                </Text>
              </View>
              <View style={[styles.tag, { backgroundColor: '#DBEAFE' }]}>
                <Text style={[styles.tagText, { color: '#1E40AF' }]}>
                  {listing.listing_type === 'sale' ? 'For Sale' : listing.listing_type.charAt(0).toUpperCase() + listing.listing_type.slice(1)}
                </Text>
              </View>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: '#DBEAFE', borderColor: '#BFDBFE' }]}>
              <Text style={[styles.statValue, { color: '#1E40AF' }]}>
                {images.length}
              </Text>
              <Text style={[styles.statLabel, { color: '#1E40AF' }]}>Photos</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' }]}>
              <Text style={[styles.statValue, { color: '#065F46' }]}>
                {listing.reviews_count || 0}
              </Text>
              <Text style={[styles.statLabel, { color: '#065F46' }]}>Reviews</Text>
            </View>
            {listing.risk_score !== undefined && (
              <View style={[styles.statCard, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                <Text style={[styles.statValue, { color: '#92400E' }]}>
                  {listing.risk_score}%
                </Text>
                <Text style={[styles.statLabel, { color: '#92400E' }]}>Risk Score</Text>
              </View>
            )}
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
            <LinkifiedText
              text={listing.description}
              textStyle={[styles.description, { color: colors.text }]}
              linkStyle={{ color: '#3B82F6', textDecorationLine: 'underline' }}
            />
            <LinkPreviewCard text={listing.description} />
          </View>

          {/* Details */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Breed</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {listing.breed}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Age</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {formatAge()}
              </Text>
            </View>
            {listing.gender && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Gender</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {listing.gender.charAt(0).toUpperCase() + listing.gender.slice(1)}
                </Text>
              </View>
            )}
            {listing.color && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Color</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {listing.color}
                </Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {listing.location || 'N/A'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
              </Text>
            </View>
          </View>

          {/* Seller */}
          {listing.seller && (
            <TouchableOpacity
              style={styles.seller}
              onPress={() => router.push(`/sellers/${listing.seller.id}`)}
            >
              <Image 
                source={sellerSource} 
                style={styles.sellerAvatar} 
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />
              <View style={styles.sellerInfo}>
                <Text style={[styles.sellerName, { color: colors.text }]}>
                  {listing.seller.display_name || listing.seller.username}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {listing.seller.average_rating && (
                    <>
                      <Ionicons name="star" size={14} color="#F59E0B" />
                      <Text style={styles.sellerLabel}>
                        {listing.seller.average_rating.toFixed(1)} ({listing.seller.reviews_count || 0} reviews)
                      </Text>
                    </>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Actions */}
      {!isOwner && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => setShowContactModal(true)}
          >
            <Ionicons name="mail-outline" size={20} color="#FFFFFF" />
            <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Contact Seller</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Contact Modal */}
      <Modal
        visible={showContactModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContactModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Contact Seller</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Your phone"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              value={contactPhone}
              onChangeText={setContactPhone}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Message"
              placeholderTextColor={colors.textSecondary}
              multiline
              value={contactMessage}
              onChangeText={setContactMessage}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowContactModal(false)}
                disabled={submitting}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleContact}
                disabled={submitting || !contactPhone || !contactMessage}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ImageGallery
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
        images={images}
        initialIndex={galleryIndex}
        title={listing.title}
        caption={listing.description}
      />

      <ContextMenu
        visible={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        options={contextMenuOptions}
      />

      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.deleteModalContainer}>
          <View style={styles.deleteModalContent}>
            <Text style={[styles.deleteModalTitle, { color: colors.text }]}>
              Delete Listing?
            </Text>
            <Text style={[styles.deleteModalText, { color: colors.text }]}>
              This action cannot be undone. The listing will be permanently deleted.
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalCancel]}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                <Text style={[styles.deleteModalButtonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalDelete]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.deleteModalButtonText, { color: '#FFFFFF' }]}>
                    Delete
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
