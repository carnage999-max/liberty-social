import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { apiClient } from '../../utils/api';
import { Friend, PaginatedResponse, User } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';
import UserProfileBottomSheet from '../../components/profile/UserProfileBottomSheet';
import { SkeletonFriend } from '../../components/common/Skeleton';

export default function FriendsScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const [profileBottomSheetVisible, setProfileBottomSheetVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | number | null>(null);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const friendsResponse = await apiClient.get<PaginatedResponse<Friend>>('/auth/friends/');
      setFriends(friendsResponse.results);
      setNext(friendsResponse.next);
      // TODO: Implement friend suggestions endpoint on backend
      // For now, we'll leave suggestions empty
      setSuggestions([]);
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFriends();
  }, []);

  useEffect(() => {
    loadFriends();
  }, []);

  const renderFriend = ({ item }: { item: Friend }) => {
    const displayName = item.friend.username || 
      `${item.friend.first_name} ${item.friend.last_name}` || 
      item.friend.email || 
      'Friend';

    return (
      <TouchableOpacity
        style={[
          styles.friendContainer,
          { 
            backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
            borderColor: colors.border,
          }
        ]}
        onPress={() => {
          setSelectedUserId(item.friend.id);
          setProfileBottomSheetVisible(true);
        }}
      >
        <Image
          source={
            item.friend.profile_image_url
              ? (() => {
                  const uri = resolveRemoteUrl(item.friend.profile_image_url);
                  return uri ? { uri } : DEFAULT_AVATAR;
                })()
              : DEFAULT_AVATAR
          }
          style={styles.avatar}
        />
        <View style={styles.friendInfo}>
          <Text style={[styles.friendName, { color: colors.text }]}>{displayName}</Text>
          {item.friend.username && (
            <Text style={[styles.friendUsername, { color: colors.textSecondary }]}>
              @{item.friend.username}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  const renderSuggestion = ({ item }: { item: User }) => {
    const displayName = item.username || 
      `${item.first_name} ${item.last_name}`.trim() || 
      item.email || 
      'User';

    const avatarUri = item.profile_image_url 
      ? resolveRemoteUrl(item.profile_image_url)
      : null;
    const avatarSource = avatarUri ? { uri: avatarUri } : DEFAULT_AVATAR;

    return (
      <TouchableOpacity
        style={[
          styles.suggestionContainer,
          { 
            backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
            borderColor: colors.border,
          }
        ]}
        onPress={() => {
          setSelectedUserId(item.id);
          setProfileBottomSheetVisible(true);
        }}
      >
        <Image
          source={avatarSource}
          style={styles.suggestionAvatar}
        />
        <View style={styles.suggestionInfo}>
          <Text style={[styles.suggestionName, { color: colors.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          {item.username && (
            <Text style={[styles.suggestionUsername, { color: colors.textSecondary }]} numberOfLines={1}>
              @{item.username}
            </Text>
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
    headerActionButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.backgroundSecondary : '#EEF0FF',
    },
    friendContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      marginHorizontal: 16,
      marginVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.border,
      marginRight: 12,
    },
    friendInfo: {
      flex: 1,
    },
    friendName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    friendUsername: {
      fontSize: 14,
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
    },
    sectionHeader: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    suggestionContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      marginHorizontal: 16,
      marginVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    suggestionAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.border,
      marginRight: 12,
    },
    suggestionInfo: {
      flex: 1,
    },
    suggestionName: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 2,
    },
    suggestionUsername: {
      fontSize: 13,
    },
    friendsCountContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
    },
    friendsCountText: {
      fontSize: 16,
      fontWeight: '600',
    },
    addFriendButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: 'rgba(255, 255, 255, 0.4)',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  if (loading && friends.length === 0) {
    return (
      <View style={styles.container}>
        <AppNavbar 
          title="Friends" 
          showLogo={false} 
          showProfileImage={false}
          customRightButton={
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/friend-requests')}
              style={styles.addFriendButton}
            >
              <Ionicons name="person-add-outline" size={20} color={colors.text} />
            </TouchableOpacity>
          }
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
        title="Friends" 
        showProfileImage={false}
        customRightButton={
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/friend-requests')}
            style={styles.addFriendButton}
          >
            <Ionicons name="person-add-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={friends}
        renderItem={renderFriend}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            {friends.length > 0 && (
              <View style={styles.friendsCountContainer}>
                <Text style={[styles.friendsCountText, { color: colors.text }]}>
                  {friends.length} {friends.length === 1 ? 'Friend' : 'Friends'}
                </Text>
              </View>
            )}
            {suggestions.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>People You May Know</Text>
                </View>
                <FlatList
                  data={suggestions}
                  renderItem={renderSuggestion}
                  keyExtractor={(item) => `suggestion-${item.id}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}
                />
              </>
            )}
            {friends.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Your Friends</Text>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No friends yet</Text>
            <Text style={[styles.emptyText, { marginTop: 8, fontSize: 14 }]}>
              Send friend requests to connect with people
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 32 }}
      />

      <UserProfileBottomSheet
        visible={profileBottomSheetVisible}
        userId={selectedUserId}
        onClose={() => {
          setProfileBottomSheetVisible(false);
          setSelectedUserId(null);
        }}
      />
    </View>
  );
}
