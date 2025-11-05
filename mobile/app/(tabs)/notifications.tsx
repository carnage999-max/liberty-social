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
import { Notification, PaginatedResponse } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';

export default function NotificationsScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [next, setNext] = useState<string | null>(null);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<PaginatedResponse<Notification>>('/notifications/');
      setNotifications(response.results);
      setNext(response.next);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, []);

  useEffect(() => {
    loadNotifications();
  }, []);

  const getNotificationIcon = (verb: string) => {
    switch (verb.toLowerCase()) {
      case 'reacted':
        return 'heart';
      case 'commented':
        return 'chatbubble';
      case 'followed':
        return 'person-add';
      default:
        return 'notifications';
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    if (notification.object_id) {
      if (notification.verb === 'commented' || notification.verb === 'reacted') {
        router.push(`/(tabs)/feed/${notification.object_id}`);
      } else if (notification.verb === 'followed') {
        router.push(`/(tabs)/users/${notification.actor.id}`);
      }
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const displayName = item.actor.username || 
      `${item.actor.first_name} ${item.actor.last_name}` || 
      item.actor.email || 
      'Someone';

    return (
      <TouchableOpacity
        style={[
          styles.notificationContainer,
          { 
            backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
            borderColor: colors.border,
            opacity: item.unread ? 1 : 0.7,
          }
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <Image
          source={
            item.actor.profile_image_url
              ? { uri: resolveRemoteUrl(item.actor.profile_image_url) || '' }
              : DEFAULT_AVATAR
          }
          style={styles.avatar}
        />
        <View style={styles.notificationContent}>
          <Text style={[styles.notificationText, { color: colors.text }]}>
            <Text style={styles.name}>{displayName}</Text> {item.verb}
          </Text>
          <Text style={[styles.time, { color: colors.textSecondary }]}>
            {new Date(item.created_at).toLocaleString()}
          </Text>
        </View>
        <Ionicons
          name={getNotificationIcon(item.verb)}
          size={20}
          color={item.unread ? colors.primary : colors.textSecondary}
        />
        {item.unread && (
          <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
        )}
      </TouchableOpacity>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    notificationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      marginHorizontal: 16,
      marginVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.border,
      marginRight: 12,
    },
    notificationContent: {
      flex: 1,
    },
    notificationText: {
      fontSize: 14,
      lineHeight: 20,
    },
    name: {
      fontWeight: '600',
    },
    time: {
      fontSize: 12,
      marginTop: 4,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginLeft: 8,
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

  if (loading && notifications.length === 0) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppNavbar title="Notifications" />

      <FlatList
        data={notifications}
        renderItem={renderNotification}
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
            <Ionicons name="notifications-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 32 }}
      />
    </View>
  );
}
