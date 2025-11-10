import { Tabs } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Platform, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';
import type { ParamListBase } from '@react-navigation/native';
import type { BottomTabNavigationEventMap } from '@react-navigation/bottom-tabs';
import type { NavigationHelpers } from '@react-navigation/native';
import { useState, useEffect } from 'react';
import { apiClient } from '../../utils/api';
import { Notification, PaginatedResponse, FriendRequest } from '../../types';

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);
  const [friendRequestCount, setFriendRequestCount] = useState(0);

  const bottomPadding = insets.bottom > 0 ? insets.bottom : 0;

  // Fetch unread notification count
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const response = await apiClient.get<PaginatedResponse<Notification>>('/notifications/');
        const unread = response.results.filter((n) => n.unread).length;
        setUnreadCount(unread);
      } catch (error) {
        // Error fetching notifications - silently fail
      }
    };

    fetchUnreadCount();
    // Refresh count every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Fetch incoming friend requests count
  useEffect(() => {
    if (!user) {
      setFriendRequestCount(0);
      return;
    }

    const fetchFriendRequestCount = async () => {
      try {
        const response = await apiClient.get<PaginatedResponse<FriendRequest>>(
          '/auth/friend-requests/',
          { params: { direction: 'incoming' } }
        );
        // Count only pending incoming requests
        const pending = response.results.filter((r) => r.status === 'pending').length;
        setFriendRequestCount(pending);
      } catch (error) {
        // Error fetching friend requests - silently fail
      }
    };

    fetchFriendRequestCount();
    // Refresh count every 30 seconds
    const interval = setInterval(fetchFriendRequestCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const styles = StyleSheet.create({
    tabBarContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingBottom: bottomPadding,
      paddingTop: 8,
      paddingHorizontal: 16,
    },
    tabBarContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    tabIconWrapper: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabLabel: {
      fontSize: 11,
      fontWeight: '600',
    },
    badge: {
      position: 'absolute',
      top: -2,
      right: -2,
      backgroundColor: '#FF4D4F',
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700',
    },
  });

  const TAB_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
    feed: 'home',
    friends: 'people',
    'create-post': 'add',
    notifications: 'notifications',
    profile: 'person',
  };

  const renderTabBar = ({
    state,
    descriptors,
    navigation,
  }: {
    state: { routes: any[]; index: number };
    descriptors: Record<
      string,
      {
        options: any;
      }
    >;
    navigation: NavigationHelpers<ParamListBase, BottomTabNavigationEventMap>;
  }) => {
    return (
      <View style={styles.tabBarContainer}>
        <View style={styles.tabBarContent}>
          {state.routes
            .filter((route: any) => route.name !== 'settings')
            .map((route: any) => {
              const { options } = descriptors[route.key];
              const label =
                options.tabBarLabel !== undefined
                  ? options.tabBarLabel
                  : options.title !== undefined
                  ? options.title
                  : route.name;

              const iconName = TAB_ICONS[route.name];
              if (!iconName) {
                return null;
              }

              const routeIndex = state.routes.findIndex((r: any) => r.key === route.key);
              const isFocused = state.index === routeIndex;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              // For profile tab, show user's profile picture
              if (route.name === 'profile') {
                const avatarSrc = user?.profile_image_url ? resolveRemoteUrl(user.profile_image_url) : null;
                const avatarSource = avatarSrc ? { uri: avatarSrc } : DEFAULT_AVATAR;
                const username = user?.username || 'Profile';

                return (
                  <TouchableOpacity key={route.key} style={styles.tabButton} onPress={onPress}>
                    <View
                      style={[
                        styles.tabIconWrapper,
                        {
                          borderWidth: 1.5,
                          borderColor: isFocused ? colors.primary : 'transparent',
                          overflow: 'hidden',
                        },
                      ]}
                    >
                      <Image 
                        source={avatarSource} 
                        style={{ width: '100%', height: '100%' }}
                      />
                    </View>
                    <Text
                      style={[
                        styles.tabLabel,
                        {
                          color: isFocused ? colors.primary : colors.textSecondary,
                        },
                      ]}
                    >
                      {username}
                    </Text>
                  </TouchableOpacity>
                );
              }

              return (
                <View key={route.key} style={styles.tabButton}>
                  <View
                    style={[
                      styles.tabIconWrapper,
                      {
                        backgroundColor:
                          isFocused && route.name === 'create-post'
                            ? colors.primary
                            : 'transparent',
                        borderWidth: isFocused && route.name === 'create-post' ? 0 : 1,
                        borderColor: isFocused ? colors.primary : 'transparent',
                      },
                    ]}
                  >
                    <TouchableOpacity onPress={onPress} style={{ position: 'relative' }}>
                      <Ionicons
                        name={iconName}
                        size={route.name === 'create-post' ? 26 : 24}
                        color={
                          route.name === 'create-post'
                            ? isFocused
                              ? '#FFFFFF'
                              : colors.primary
                            : isFocused
                            ? colors.primary
                            : colors.textSecondary
                        }
                      />
                      {route.name === 'notifications' && unreadCount > 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </Text>
                        </View>
                      )}
                      {route.name === 'friends' && friendRequestCount > 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {friendRequestCount > 99 ? '99+' : friendRequestCount}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                  <Text
                    onPress={onPress}
                    style={[
                      styles.tabLabel,
                      {
                        color: isFocused ? colors.primary : colors.textSecondary,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              );
            })}
        </View>
      </View>
    );
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
      tabBar={renderTabBar}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
        }}
      />
      <Tabs.Screen
        name="create-post"
        options={{
          title: 'Create',
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarBadge: undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarButton: () => null,
        }}
      />
    </Tabs>
  );
}
