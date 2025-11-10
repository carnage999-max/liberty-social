import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAlert } from '../../../contexts/AlertContext';
import { apiClient } from '../../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppNavbar from '../../../components/layout/AppNavbar';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../../utils/url';
import { SkeletonFriend } from '../../../components/common/Skeleton';

interface BlockedUser {
  id: number;
  blocked_user: string | {  // Can be UUID string or user object
    id: string;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    profile_image_url?: string | null;
  };
  created_at: string;
}

interface UserOverviewResponse {
  user: {
    id: string;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    profile_image_url?: string | null;
  };
}

interface UserDetails {
  id: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  profile_image_url?: string | null;
}

export default function BlockedUsersScreen() {
  const { colors, isDark } = useTheme();
  const { showError, showConfirm, showSuccess } = useAlert();
  const router = useRouter();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [userDetails, setUserDetails] = useState<Record<string, UserDetails>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ results: BlockedUser[] }>('/auth/blocks/');
      
      // Fetch user details for each blocked user ID
      const userIds = response.results
        ?.map(item => typeof item.blocked_user === 'string' ? item.blocked_user : null)
        .filter((id): id is string => id !== null) || [];
      
      if (userIds.length > 0) {
        const userDetailsMap: Record<string, UserDetails> = {};
        
        // Fetch user details for each blocked user using overview endpoint
        await Promise.all(
          userIds.map(async (userId) => {
            try {
              const overviewData = await apiClient.get<UserOverviewResponse>(`/auth/user/${userId}/overview/`);
              userDetailsMap[userId] = overviewData.user;
            } catch (error) {
              // Error loading user details - silently continue
            }
          })
        );
        
        setUserDetails(userDetailsMap);
      }
      
      // Set blocked users after user details are loaded
      setBlockedUsers(response.results || []);
    } catch (error) {
      showError('Failed to load blocked users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUnblock = (blockRecordId: number, username: string) => {
    showConfirm(
      `Are you sure you want to unblock ${username}?`,
      async () => {
        try {
          await apiClient.delete(`/auth/blocks/${blockRecordId}/`);
          setBlockedUsers(prev => prev.filter(item => item.id !== blockRecordId));
          showSuccess(`${username} has been unblocked`);
        } catch (error: any) {
          showError(error.response?.data?.message || 'Failed to unblock user');
        }
      },
      undefined,
      'Unblock User'
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBlockedUsers();
  };

  const renderBlockedUser = ({ item }: { item: BlockedUser }) => {
    // Handle both cases: blocked_user can be UUID string or user object
    const blockedUserId = typeof item.blocked_user === 'string' 
      ? item.blocked_user 
      : item.blocked_user?.id;
    
    const user = typeof item.blocked_user === 'object' 
      ? item.blocked_user 
      : userDetails[blockedUserId || ''];
    
    // Build display name with proper fallbacks
    let displayName = 'User';
    if (user?.username) {
      displayName = user.username;
    } else if (user?.first_name || user?.last_name) {
      const name = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
      if (name) displayName = name;
    } else if (user?.email) {
      displayName = user.email;
    }

    const avatarUri = user?.profile_image_url
      ? resolveRemoteUrl(user.profile_image_url)
      : null;
    const avatarSource = avatarUri ? { uri: avatarUri } : DEFAULT_AVATAR;

    return (
      <View
        style={[
          styles.userContainer,
          {
            backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
            borderColor: colors.border,
          },
        ]}
      >
        <Image source={avatarSource} style={styles.avatar} />
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.text }]}>{displayName}</Text>
          {user?.username && (
            <Text style={[styles.userUsername, { color: colors.textSecondary }]}>
              @{user.username}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.unblockButton}
          onPress={() => handleUnblock(item.id, displayName)}
        >
          <Text style={styles.unblockButtonText}>Unblock</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    userContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      marginHorizontal: 16,
      marginVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.border,
      marginRight: 12,
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 2,
    },
    userUsername: {
      fontSize: 14,
    },
    unblockButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    unblockButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 16,
    },
  });

  if (loading && blockedUsers.length === 0) {
    return (
      <View style={styles.container}>
        <AppNavbar 
          title="Blocked Users" 
          showLogo={false} 
          showProfileImage={false} 
          showBackButton={true}
          onBackPress={() => router.push('/(tabs)/settings')}
        />
        <FlatList
          data={[1, 2, 3, 4, 5]}
          renderItem={() => <SkeletonFriend />}
          keyExtractor={(item) => item.toString()}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppNavbar 
        title="Blocked Users" 
        showLogo={false} 
        showProfileImage={false} 
        showBackButton={true}
        onBackPress={() => router.push('/(tabs)/settings')}
      />

      <FlatList
        data={blockedUsers}
        renderItem={renderBlockedUser}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="ban-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No blocked users</Text>
          </View>
        }
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 120 }}
      />
    </View>
  );
}

