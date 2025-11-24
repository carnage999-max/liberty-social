import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
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

interface BusinessPage {
  id: number;
  name: string;
  description?: string;
  category?: string;
  profile_image_url?: string;
  cover_image_url?: string;
  followers_count: number;
  is_following: boolean;
  is_verified?: boolean;
  website_url?: string;
  phone?: string;
  email?: string;
  created_at: string;
}

export default function PageDetailScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [page, setPage] = useState<BusinessPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPage();
  }, [id]);

  const loadPage = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<BusinessPage>(`/pages/${id}/`);
      setPage(response);
    } catch (error) {
      showError('Failed to load page');
      console.error(error);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!page) return;
    try {
      if (page.is_following) {
        await apiClient.post(`/pages/${page.id}/unfollow/`, {});
        showSuccess('Unfollowed page');
      } else {
        await apiClient.post(`/pages/${page.id}/follow/`, {});
        showSuccess('Following page');
      }
      setPage({ ...page, is_following: !page.is_following });
    } catch (error) {
      showError('Failed to update follow status');
      console.error(error);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    coverImage: {
      width: SCREEN_WIDTH,
      height: 200,
      backgroundColor: colors.border,
    },
    profileSection: {
      alignItems: 'center',
      marginTop: -50,
      marginBottom: 20,
    },
    profileImageContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 4,
      borderColor: isDark ? colors.background : '#FFFFFF',
      overflow: 'hidden',
      marginBottom: 12,
    },
    profileImage: {
      width: '100%',
      height: '100%',
    },
    verifiedBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: '#4F8EF7',
      borderRadius: 12,
      padding: 2,
    },
    pageName: {
      fontSize: 24,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 6,
    },
    pageCategory: {
      fontSize: 14,
      color: colors.textSecondary,
      textTransform: 'capitalize',
      marginBottom: 12,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
      marginBottom: 16,
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
      marginTop: 2,
    },
    followButton: {
      marginHorizontal: 16,
      backgroundColor: '#192A4A',
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      marginBottom: 20,
      borderWidth: 1,
      borderColor: '#C8A25F',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 4,
    },
    followingButton: {
      backgroundColor: 'transparent',
      borderColor: colors.border,
    },
    followButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    followingButtonText: {
      color: colors.text,
    },
    content: {
      padding: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 12,
    },
    description: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 12,
    },
    infoIcon: {
      width: 24,
    },
    infoText: {
      fontSize: 14,
      flex: 1,
    },
    postsSection: {
      padding: 16,
    },
    postsPlaceholder: {
      alignItems: 'center',
      padding: 32,
    },
    postsPlaceholderText: {
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

  if (!page) {
    return (
      <View style={styles.container}>
        <AppNavbar showProfileImage={false} showBackButton={true} onBackPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
            Page not found
          </Text>
        </View>
      </View>
    );
  }

  const profileImage = page.profile_image_url
    ? resolveRemoteUrl(page.profile_image_url)
    : null;
  const profileSource = profileImage ? { uri: profileImage } : DEFAULT_AVATAR;
  const coverImage = page.cover_image_url ? resolveRemoteUrl(page.cover_image_url) : null;

  return (
    <View style={styles.container}>
      <AppNavbar showProfileImage={false} showBackButton={true} onBackPress={() => router.back()} />
      
      <ScrollView style={styles.scrollView}>
        {/* Cover Image */}
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <View style={[styles.coverImage, { backgroundColor: colors.primary, opacity: 0.3 }]} />
        )}

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <Image source={profileSource} style={styles.profileImage} />
            {page.is_verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              </View>
            )}
          </View>

          <Text style={[styles.pageName, { color: colors.text }]}>{page.name}</Text>
          
          {page.category && (
            <Text style={styles.pageCategory}>{page.category}</Text>
          )}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {page.followers_count}
              </Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
          </View>
        </View>

        {/* Follow Button */}
        <TouchableOpacity
          style={[
            styles.followButton,
            page.is_following && styles.followingButton,
          ]}
          onPress={handleFollowToggle}
        >
          <Text
            style={[
              styles.followButtonText,
              page.is_following && styles.followingButtonText,
            ]}
          >
            {page.is_following ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>

        {/* About Section */}
        {page.description && (
          <View style={styles.content}>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
              <Text style={styles.description}>{page.description}</Text>
            </View>
          </View>
        )}

        {/* Contact Info */}
        {(page.website_url || page.phone || page.email) && (
          <View style={styles.content}>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact</Text>
              
              {page.website_url && (
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Ionicons name="globe-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.infoText, { color: colors.text }]}>
                    {page.website_url}
                  </Text>
                </View>
              )}
              
              {page.phone && (
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Ionicons name="call-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.infoText, { color: colors.text }]}>
                    {page.phone}
                  </Text>
                </View>
              )}
              
              {page.email && (
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Ionicons name="mail-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.infoText, { color: colors.text }]}>
                    {page.email}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Posts Section */}
        <View style={styles.postsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Posts</Text>
          <View style={styles.postsPlaceholder}>
            <Ionicons name="newspaper-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.postsPlaceholderText}>No posts yet</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
