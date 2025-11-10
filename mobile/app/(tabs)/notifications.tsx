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
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { Notification, PaginatedResponse } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';
import { SkeletonNotification } from '../../components/common/Skeleton';

export default function NotificationsScreen() {
  const { colors, isDark } = useTheme();
  const { showSuccess, showError } = useToast();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingRead, setMarkingRead] = useState<number | null>(null);

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

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read if unread
    if (notification.unread) {
      try {
        setMarkingRead(notification.id);
        await apiClient.post(`/notifications/${notification.id}/mark_read/`);
        // Update local state
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, unread: false } : n
          )
        );
        showSuccess('Notification marked as read');
      } catch (error) {
        console.error('Error marking notification as read:', error);
        showError('Failed to mark notification as read');
      } finally {
        setMarkingRead(null);
      }
    }

    // Navigate to the relevant page
    if (notification.object_id) {
      if (notification.verb === 'commented' || notification.verb === 'reacted') {
        router.push(`/(tabs)/feed/${notification.object_id}`);
      } else if (notification.verb === 'followed') {
        router.push(`/(tabs)/users/${notification.actor.id}`);
      }
    }
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    try {
      setMarkingAll(true);
      await apiClient.post('/notifications/mark_all_read/');
      // Update local state
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, unread: false }))
      );
      showSuccess('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      showError('Failed to mark all notifications as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const getNotificationMessage = (notification: Notification) => {
    const displayName = notification.actor.username || 
      `${notification.actor.first_name} ${notification.actor.last_name}` || 
      notification.actor.email || 
      'Someone';

    const verb = notification.verb.toLowerCase();
    
    if (verb === 'commented' || verb === 'comment_replied') {
      const preview = notification.target_comment_preview || notification.target_post_preview;
      if (preview) {
        return `${displayName} ${verb === 'comment_replied' ? 'replied to your comment' : 'commented'} on your post: "${preview}"`;
      }
      return `${displayName} ${verb === 'comment_replied' ? 'replied to your comment' : 'commented'} on your post`;
    } else if (verb === 'reacted') {
      const preview = notification.target_post_preview;
      if (preview) {
        return `${displayName} reacted to your post: "${preview}"`;
      }
      return `${displayName} reacted to your post`;
    } else if (verb === 'followed') {
      return `${displayName} started following you`;
    }
    
    return `${displayName} ${notification.verb}`;
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const notificationMessage = getNotificationMessage(item);

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
        disabled={markingRead === item.id}
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
            {notificationMessage}
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
    headerContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    unreadCountText: {
      fontSize: 14,
      fontWeight: '600',
    },
    markAllButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    markAllButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '600',
    },
    listContent: {
      paddingTop: 8,
      paddingBottom: 100, // Extra padding to ensure all items are visible
      paddingHorizontal: 0,
      flexGrow: 1,
    },
    listContentEmpty: {
      flex: 1,
    },
  });

  if (loading && notifications.length === 0) {
    return (
      <View style={styles.container}>
        <AppNavbar />
        <FlatList
          data={[1, 2, 3, 4, 5]}
          renderItem={() => <SkeletonNotification />}
          keyExtractor={(item) => item.toString()}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppNavbar title="Notifications" />

      {/* Header with unread count and mark all as read button */}
      {notifications.length > 0 && (
        <View style={[styles.headerContainer, { backgroundColor: colors.background }]}>
          <View style={styles.headerContent}>
            <Text style={[styles.unreadCountText, { color: colors.text }]}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </Text>
            {unreadCount > 0 && (
              <TouchableOpacity
                style={[styles.markAllButton, { backgroundColor: colors.primary }]}
                onPress={handleMarkAllRead}
                disabled={markingAll}
              >
                {markingAll ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.markAllButtonText}>Mark all as read</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

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
        contentContainerStyle={[
          styles.listContent,
          notifications.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
