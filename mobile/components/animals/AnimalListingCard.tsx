import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../contexts/ThemeContext';
import { resolveRemoteUrl } from '../../utils/url';
import { Ionicons } from '@expo/vector-icons';

interface AnimalListingCardProps {
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
  onPress: () => void;
}

export default function AnimalListingCard({
  id,
  title,
  breed,
  category,
  price,
  listing_type,
  location,
  animal_listing_media,
  status,
  risk_score,
  seller_verified,
  has_vet_documentation,
  onPress,
}: AnimalListingCardProps) {
  const { colors, isDark } = useTheme();
  const imageUrl = animal_listing_media?.[0]?.url || null;
  const isHighRisk = risk_score && risk_score > 60;
  const isVerified = seller_verified && has_vet_documentation;
  const isUnverified = !isVerified || !has_vet_documentation;

  const getPriceDisplay = () => {
    if (listing_type === 'adoption') {
      return 'Free - Adoption';
    }
    if (listing_type === 'rehoming') {
      return 'Rehoming';
    }
    return price ? `$${price.toLocaleString()}` : 'Contact for price';
  };

  const getListingTypeColor = () => {
    switch (listing_type) {
      case 'sale':
        return { bg: '#DBEAFE', text: '#1E40AF' };
      case 'adoption':
        return { bg: '#D1FAE5', text: '#065F46' };
      case 'rehoming':
        return { bg: '#E9D5FF', text: '#6B21A8' };
      default:
        return { bg: '#F3F4F6', text: '#374151' };
    }
  };

  const typeColors = getListingTypeColor();

  const dynamicStyles = StyleSheet.create({
    card: {
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderColor: colors.border,
    },
    title: {
      color: colors.text,
    },
    breed: {
      color: colors.textSecondary,
    },
    location: {
      color: colors.textSecondary,
    },
    price: {
      color: '#2563EB',
    },
    status: {
      backgroundColor: isDark ? colors.backgroundSecondary : '#F3F4F6',
      color: colors.text,
    },
  });

  return (
    <TouchableOpacity
      style={[styles.card, dynamicStyles.card]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Image Container */}
      {imageUrl ? (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: resolveRemoteUrl(imageUrl) }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
          {/* Risk Badge */}
          {isHighRisk && (
            <View style={styles.riskBadge}>
              <Ionicons name="warning" size={14} color="#FFFFFF" />
              <Text style={styles.badgeText}>Risk</Text>
            </View>
          )}
          {/* Verified Badge */}
          {isVerified && !isUnverified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
              <Text style={styles.badgeText}>Verified</Text>
            </View>
          )}
          {/* Unverified Badge */}
          {isUnverified && (
            <View style={styles.unverifiedBadge}>
              <Ionicons name="warning" size={14} color="#FFFFFF" />
              <Text style={styles.badgeText}>Unverified</Text>
            </View>
          )}
          {/* Media count badge */}
          {animal_listing_media && animal_listing_media.length > 1 && (
            <View style={styles.mediaCountBadge}>
              <Text style={styles.mediaCountText}>+{animal_listing_media.length - 1}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.imageContainer, styles.imagePlaceholder]}>
          <Ionicons name="image-outline" size={48} color={colors.textSecondary} />
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Category & Type Tags */}
        <View style={styles.tags}>
          <View style={styles.categoryTag}>
            <Text style={styles.categoryTagText}>{category.name}</Text>
          </View>
          <View style={[styles.typeTag, { backgroundColor: typeColors.bg }]}>
            <Text style={[styles.typeTagText, { color: typeColors.text }]}>
              {listing_type === 'sale' ? 'For Sale' : listing_type.charAt(0).toUpperCase() + listing_type.slice(1)}
            </Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={[styles.title, dynamicStyles.title]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.breed, dynamicStyles.breed]} numberOfLines={1}>
            {breed}
          </Text>
        </View>

        {/* Location */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.location, dynamicStyles.location]} numberOfLines={1}>
            {location}
          </Text>
        </View>

        {/* Footer: Price, Risk Score & Status */}
        <View style={styles.footer}>
          <View style={styles.priceRow}>
            <Text style={[styles.price, dynamicStyles.price]}>
              {getPriceDisplay()}
            </Text>
            <View style={[styles.statusBadge, dynamicStyles.status]}>
              <Text style={[styles.statusText, { color: colors.text }]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
          </View>

          {/* Risk Score Indicator */}
          {risk_score !== undefined && (
            <View style={styles.riskRow}>
              <Text style={[styles.riskLabel, { color: colors.textSecondary }]}>Risk Score</Text>
              <View style={styles.riskIndicator}>
                <View style={styles.riskBarContainer}>
                  <View
                    style={[
                      styles.riskBar,
                      {
                        width: `${risk_score}%`,
                        backgroundColor:
                          risk_score <= 30
                            ? '#10B981'
                            : risk_score <= 60
                            ? '#F59E0B'
                            : '#EF4444',
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.riskScore,
                    {
                      color:
                        risk_score <= 30
                          ? '#10B981'
                          : risk_score <= 60
                          ? '#F59E0B'
                          : '#EF4444',
                    },
                  ]}
                >
                  {risk_score}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: 192,
    backgroundColor: '#F3F4F6',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unverifiedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(234, 179, 8, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  mediaCountBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mediaCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    padding: 12,
  },
  tags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  categoryTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  typeTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  titleSection: {
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  breed: {
    fontSize: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  location: {
    fontSize: 12,
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  riskLabel: {
    fontSize: 11,
  },
  riskIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  riskBarContainer: {
    width: 80,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  riskBar: {
    height: '100%',
    borderRadius: 4,
  },
  riskScore: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'right',
  },
});


