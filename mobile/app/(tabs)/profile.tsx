import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../utils/api';
import { UserProfileOverview } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ScreenHeader from '../../components/layout/ScreenHeader';

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const { user, accessToken } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const data = await apiClient.get<UserProfileOverview>(`/auth/user/${user.id}/overview/`);
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const displayName = user?.username || 
    `${user?.first_name} ${user?.last_name}` || 
    user?.email || 
    'User';

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerActionButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.backgroundSecondary : '#EEF0FF',
    },
    profileHeader: {
      padding: 24,
      alignItems: 'center',
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    avatar: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.border,
      marginBottom: 16,
    },
    name: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 4,
    },
    username: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    bio: {
      fontSize: 14,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    stat: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    actionsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
    actionButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    postsContainer: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    postsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    postPreview: {
      width: '32%',
      aspectRatio: 1,
      borderRadius: 8,
      backgroundColor: colors.border,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <ScreenHeader
        title="Profile"
        rightContent={
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={() => router.push('/(tabs)/settings')}
          >
            <Ionicons name="settings-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        }
        containerStyle={{ paddingBottom: 12 }}
      />

      <View style={styles.profileHeader}>
        <Image
          source={{
            uri: user?.profile_image_url || 'https://via.placeholder.com/120',
          }}
          style={styles.avatar}
        />
        <Text style={styles.name}>{displayName}</Text>
        {user?.username && <Text style={styles.username}>@{user.username}</Text>}
        {user?.bio && <Text style={styles.bio}>{user.bio}</Text>}

        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile?.stats?.post_count || 0}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile?.stats?.friend_count || 0}</Text>
            <Text style={styles.statLabel}>Friends</Text>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/settings')}
          >
            <Text style={styles.actionButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {profile?.recent_posts && profile.recent_posts.length > 0 && (
        <View style={styles.postsContainer}>
          <Text style={styles.sectionTitle}>Recent Posts</Text>
          <View style={styles.postsGrid}>
            {profile.recent_posts.slice(0, 6).map((post, index) => (
              <TouchableOpacity
                key={post.id}
                onPress={() => router.push(`/(tabs)/feed/${post.id}`)}
              >
                {post.media && post.media.length > 0 ? (
                  <Image
                    source={{ uri: post.media[0] }}
                    style={styles.postPreview}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.postPreview}>
                    <Ionicons
                      name="document-text-outline"
                      size={24}
                      color={colors.textSecondary}
                      style={{ alignSelf: 'center', marginTop: '40%' }}
                    />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
