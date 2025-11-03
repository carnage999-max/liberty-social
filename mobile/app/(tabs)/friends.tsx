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
import { Friend, PaginatedResponse } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ScreenHeader from '../../components/layout/ScreenHeader';

export default function FriendsScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [next, setNext] = useState<string | null>(null);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<PaginatedResponse<Friend>>('/auth/friends/');
      setFriends(response.results);
      setNext(response.next);
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
        onPress={() => router.push(`/(tabs)/users/${item.friend.id}`)}
      >
        <Image
          source={{
            uri: item.friend.profile_image_url || 'https://via.placeholder.com/64',
          }}
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
  });

  if (loading && friends.length === 0) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Friends"
        rightContent={
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={() => router.push('/(tabs)/friend-requests')}
          >
            <Ionicons name="person-add-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        }
        containerStyle={{ paddingBottom: 12 }}
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
    </View>
  );
}
