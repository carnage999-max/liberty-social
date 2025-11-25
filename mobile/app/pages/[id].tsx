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
import ImageGallery from '../../components/common/ImageGallery';
import ContextMenu from '../../components/common/ContextMenu';
import { Modal } from 'react-native';
import InviteUsersModal from '../../components/pages/InviteUsersModal';
import CreatePagePostModal from '../../components/pages/CreatePagePostModal';

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
  owner?: {
    id: string;
  };
  can_manage?: boolean;
  user_role?: 'owner' | 'admin' | 'moderator' | 'editor';
}

export default function PageDetailScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [page, setPage] = useState<BusinessPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);

  useEffect(() => {
    loadPage();
  }, [id]);

  useEffect(() => {
    if (page) {
      checkCanManage();
    }
  }, [page, user]);

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

  const checkCanManage = async () => {
    if (!page || !user) {
      setCanManage(false);
      return;
    }
    try {
      // Try to fetch admins - if successful, user can manage
      await apiClient.get(`/pages/${page.id}/admins/`);
      setCanManage(true);
    } catch (error) {
      // If 403 or 404, user cannot manage
      setCanManage(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!page) return;
    try {
      const response = await apiClient.post<{ following: boolean; follower_count: number }>(`/pages/${page.id}/follow/`, {});
      const newFollowingState = response.following;
      showSuccess(newFollowingState ? 'Following page' : 'Unfollowed page');
      setPage({ 
        ...page, 
        is_following: newFollowingState,
        followers_count: response.follower_count || page.followers_count
      });
    } catch (error) {
      showError('Failed to update follow status');
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!page) return;
    try {
      setDeleting(true);
      await apiClient.delete(`/pages/${page.id}/`);
      showSuccess('Page deleted successfully');
      router.push('/(tabs)/pages');
    } catch (error) {
      showError('Failed to delete page');
      console.error(error);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // canManage is now set via checkCanManage function

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

  const contextMenuOptions = canManage
    ? [
        {
          label: 'Edit Page',
          icon: 'create-outline' as const,
          onPress: () => router.push(`/pages/${id}/edit`),
        },
        {
          label: 'Delete Page',
          icon: 'trash-outline' as const,
          onPress: () => setShowDeleteConfirm(true),
          destructive: true,
        },
      ]
    : [];

  return (
    <View style={styles.container}>
      <AppNavbar 
        showProfileImage={false} 
        showBackButton={true} 
        onBackPress={() => router.back()}
        customRightButton={
          canManage ? (
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
        {/* Cover Image */}
        {coverImage ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              setGalleryImages([coverImage]);
              setGalleryIndex(0);
              setGalleryVisible(true);
            }}
          >
          <Image source={{ uri: coverImage }} style={styles.coverImage} resizeMode="cover" />
          </TouchableOpacity>
        ) : (
          <View style={[styles.coverImage, { backgroundColor: colors.primary, opacity: 0.3 }]} />
        )}

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.profileImageContainer}
            activeOpacity={0.9}
            onPress={() => {
              if (profileImage) {
                setGalleryImages([profileImage]);
                setGalleryIndex(0);
                setGalleryVisible(true);
              }
            }}
          >
            <Image source={profileSource} style={styles.profileImage} />
            {page.is_verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

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

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
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
          
          {page.is_following && !canManage && (
            <TouchableOpacity
              style={styles.inviteButton}
              onPress={() => setShowInviteModal(true)}
            >
              <Ionicons name="person-add-outline" size={20} color="#C8A25F" />
              <Text style={styles.inviteButtonText}>Invite Users</Text>
            </TouchableOpacity>
          )}
          
          {canManage && (
            <TouchableOpacity
              style={styles.createPostButton}
              onPress={() => setShowCreatePostModal(true)}
            >
              <Ionicons name="create-outline" size={20} color="#FFFFFF" />
              <Text style={styles.createPostButtonText}>Create Post</Text>
            </TouchableOpacity>
          )}
        </View>
          
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

      <ImageGallery
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
        images={galleryImages}
        initialIndex={galleryIndex}
        title={page.name}
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
              Delete Page?
            </Text>
            <Text style={[styles.deleteModalText, { color: colors.text }]}>
              This action cannot be undone. The page will be permanently deleted.
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

      <InviteUsersModal
        visible={showInviteModal}
        pageId={page?.id || 0}
        onClose={() => setShowInviteModal(false)}
        onInvitesSent={() => {
          loadPage();
        }}
      />

      <CreatePagePostModal
        visible={showCreatePostModal}
        pageId={page?.id || 0}
        onClose={() => setShowCreatePostModal(false)}
        onPostCreated={() => {
          loadPage();
        }}
      />
    </View>
  );
}
