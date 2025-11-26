import { Tabs } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Platform, StyleSheet, Image, TouchableOpacity, Modal, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';
import type { ParamListBase } from '@react-navigation/native';
import type { BottomTabNavigationEventMap } from '@react-navigation/bottom-tabs';
import type { NavigationHelpers } from '@react-navigation/native';
import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../utils/api';
import { Notification, PaginatedResponse, FriendRequest } from '../../types';
import { useRouter, usePathname } from 'expo-router';

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [tabBarVisible, setTabBarVisible] = useState(true);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const tabBarTranslateY = useRef(new Animated.Value(0)).current;
  const pathname = usePathname();

  const bottomPadding = insets.bottom > 0 ? insets.bottom : 0;

  // Global functions to control tab bar visibility
  useEffect(() => {
    (global as any).hideTabBar = () => {
      if (tabBarVisible) {
        setTabBarVisible(false);
        Animated.timing(tabBarTranslateY, {
          toValue: 200,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    };

    (global as any).showTabBar = () => {
      if (!tabBarVisible) {
        setTabBarVisible(true);
      }
      Animated.timing(tabBarTranslateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    };

    return () => {
      delete (global as any).hideTabBar;
      delete (global as any).showTabBar;
    };
  }, [tabBarVisible, tabBarTranslateY]);

  // Show tab bar when route changes to a main tab route
  useEffect(() => {
    if (pathname) {
      // Check multiple possible pathname formats
      const mainTabRouteNames = ['feed', 'reels', 'create-post', 'notifications', 'profile'];
      const isMainTabRoute = mainTabRouteNames.some(routeName => {
        // Check if pathname matches main tab routes
        return pathname === `/(tabs)/${routeName}` ||
               pathname.startsWith(`/(tabs)/${routeName}/`) ||
               pathname === `/${routeName}` ||
               pathname.startsWith(`/${routeName}/`) ||
               (routeName === 'profile' && (pathname.includes('/profile') || pathname.includes('/users/')));
      });
      
      if (isMainTabRoute) {
        // Always show tab bar for main tab routes
        setTabBarVisible(true);
        Animated.timing(tabBarTranslateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [pathname, tabBarTranslateY]);

  // Animate menu
  useEffect(() => {
    if (showMoreMenu) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: 300,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    }
  }, [showMoreMenu]);

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
      backgroundColor: 'rgba(26, 35, 53, 0.95)', // Deep navy with transparency
      borderTopColor: 'rgba(255, 255, 255, 0.1)',
      borderTopWidth: 1,
      paddingBottom: bottomPadding,
      paddingTop: 8,
      paddingHorizontal: 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8,
    },
    tabBarContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: 4,
    },
    tabButton: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    tabButtonActive: {
      backgroundColor: '#C8A25F', // Gold background when active
    },
    tabIconWrapper: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    tabIconWrapperActive: {
      backgroundColor: '#C8A25F', // Gold
      borderColor: '#C8A25F',
    },
    tabIconWrapperInactive: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    tabLabel: {
      fontSize: 10,
      fontWeight: '600',
    },
    tabLabelActive: {
      color: '#1a2335', // Deep navy
    },
    tabLabelInactive: {
      color: '#FFFFFF',
    },
    badge: {
      position: 'absolute',
      top: 0,
      right: 0,
      backgroundColor: '#FF4D4F',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      paddingHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '700',
    },
    moreMenuContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
    },
    moreMenuBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    moreMenuContent: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: bottomPadding + 70,
      paddingTop: 20,
      paddingHorizontal: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8,
    },
    moreMenuHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    moreMenuTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    moreMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 10,
      marginBottom: 8,
    },
    moreMenuItemIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: '#C8A25F', // Gold border
      backgroundColor: '#C8A25F', // Gold background
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    moreMenuItemLabel: {
      fontSize: 16,
      fontWeight: '600',
    },
  });

  const TAB_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
    feed: 'home',
    reels: 'film',
    'create-post': 'add',
    notifications: 'notifications',
    profile: 'person',
  };

  const openMoreMenu = () => {
    setShowMoreMenu(true);
  };

  const MORE_MENU_ITEMS = [
    { id: 'marketplace', label: 'Marketplace', icon: 'storefront-outline', route: '/(tabs)/marketplace' },
    { id: 'animals', label: 'Animal Marketplace', icon: 'paw-outline', route: '/(tabs)/animals' },
    { id: 'pages', label: 'Pages', icon: 'business-outline', route: '/(tabs)/pages' },
    { id: 'page-invites', label: 'Page Invites', icon: 'mail-outline', route: '/(tabs)/page-invites' },
    { id: 'friend-requests', label: 'Friend Requests', icon: 'people-outline', route: '/(tabs)/friend-requests' },
    { id: 'messages', label: 'Messages', icon: 'chatbubble-outline', route: '/(tabs)/messages' },
  ];

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
      <Animated.View 
        style={[
          styles.tabBarContainer,
          {
            transform: [{ translateY: tabBarTranslateY }],
          },
        ]}
      >
        <View style={styles.tabBarContent}>
          {state.routes
            .filter((route: any) => !['settings', 'more', 'marketplace', 'pages', 'friend-requests', 'messages'].includes(route.name))
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
                  // Always use navigation.navigate for tab routes to ensure proper tab bar visibility
                  navigation.navigate(route.name);
                }
              };

              // Handle profile tab with user image
              if (route.name === 'profile') {
                const avatarSrc = user?.profile_image_url ? resolveRemoteUrl(user.profile_image_url) : null;
                const firstLetter = user?.username?.[0]?.toUpperCase() || user?.first_name?.[0]?.toUpperCase() || 'P';
                const profileSource = avatarSrc ? { uri: avatarSrc } : DEFAULT_AVATAR;

                return (
                  <TouchableOpacity
                    key={route.key}
                    style={[
                      styles.tabButton,
                      isFocused && styles.tabButtonActive,
                    ]}
                    onPress={onPress}
                    activeOpacity={0.7}
                  >
                    <View style={{ position: 'relative' }}>
                      <View
                        style={[
                          styles.tabIconWrapper,
                          isFocused ? styles.tabIconWrapperActive : styles.tabIconWrapperInactive,
                          { overflow: 'hidden' },
                        ]}
                      >
                        {avatarSrc ? (
                          <Image 
                            source={profileSource} 
                            style={{ width: '100%', height: '100%', borderRadius: 18 }}
                          />
                        ) : (
                          <Text style={{
                            fontSize: 16,
                            fontWeight: '700',
                            color: isFocused ? '#1a2335' : '#FFFFFF',
                          }}>
                            {firstLetter}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.tabLabel,
                        isFocused ? styles.tabLabelActive : styles.tabLabelInactive,
                      ]}
                    >
                      {firstLetter + (user?.username?.slice(1) || 'rofile')}
                    </Text>
                  </TouchableOpacity>
                );
              }


              // Handle "more" menu differently
              if (route.name === 'more') {
                return (
                  <TouchableOpacity
                    key={route.key}
                    style={[
                      styles.tabButton,
                      showMoreMenu && styles.tabButtonActive,
                    ]}
                    onPress={() => setShowMoreMenu(!showMoreMenu)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.tabIconWrapper,
                        showMoreMenu ? styles.tabIconWrapperActive : styles.tabIconWrapperInactive,
                      ]}
                    >
                      <Ionicons
                        name={iconName}
                        size={18}
                        color={showMoreMenu ? '#1a2335' : '#FFFFFF'}
                      />
                    </View>
                    <Text
                      style={[
                        styles.tabLabel,
                        showMoreMenu ? styles.tabLabelActive : styles.tabLabelInactive,
                      ]}
                    >
                      More
                    </Text>
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={route.key}
                  style={[
                    styles.tabButton,
                    isFocused && styles.tabButtonActive,
                  ]}
                  onPress={onPress}
                  activeOpacity={0.7}
                >
                  <View style={{ position: 'relative' }}>
                  <View
                    style={[
                      styles.tabIconWrapper,
                        isFocused ? styles.tabIconWrapperActive : styles.tabIconWrapperInactive,
                      ]}
                    >
                      <Ionicons
                        name={iconName}
                        size={18}
                        color={isFocused ? '#1a2335' : '#FFFFFF'}
                      />
                    </View>
                      {route.name === 'notifications' && unreadCount > 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </Text>
                        </View>
                      )}
                      {route.name === 'reels' && false && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {friendRequestCount > 99 ? '99+' : friendRequestCount}
                          </Text>
                        </View>
                      )}
                  </View>
                  <Text
                    style={[
                      styles.tabLabel,
                      isFocused ? styles.tabLabelActive : styles.tabLabelInactive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </View>
      </Animated.View>
    );
  };

  return (
    <>
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
        name="reels"
        options={{
          title: 'Reels',
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
          name="more"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="marketplace"
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tabs.Screen
          name="pages"
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tabs.Screen
          name="animals"
          options={{
            tabBarButton: () => null,
          }}
        />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarButton: () => null,
        }}
      />
        <Tabs.Screen
          name="friend-requests"
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tabs.Screen
          name="page-invites"
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            href: null,
          }}
        />
    </Tabs>

      {/* More Menu Modal */}
      <Modal
        visible={showMoreMenu}
        transparent
        animationType="none"
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <TouchableOpacity
          style={styles.moreMenuBackdrop}
          activeOpacity={1}
          onPress={() => setShowMoreMenu(false)}
        >
          <Animated.View
            style={[
              styles.moreMenuContent,
              {
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.moreMenuHeader}>
              <Text style={[styles.moreMenuTitle, { color: colors.text }]}>More Options</Text>
              <TouchableOpacity onPress={() => setShowMoreMenu(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {MORE_MENU_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.moreMenuItem}
                onPress={() => {
                  setShowMoreMenu(false);
                  router.push(item.route as any);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.moreMenuItemIcon}>
                  <Ionicons name={item.icon as any} size={20} color="#1a2335" />
                </View>
                <Text style={[styles.moreMenuItemLabel, { color: colors.text }]}>
                  {item.label}
                </Text>
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Floating More Button - Hidden on messages pages */}
      {pathname && !pathname.includes('/messages') && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            right: 16,
            bottom: bottomPadding + 80,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#121A33', // Deep navy
            borderWidth: 2,
            borderColor: '#C8A25F', // Gold
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#C8A25F',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 12,
          }}
          onPress={() => setShowMoreMenu(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="grid" size={24} color="#C8A25F" />
        </TouchableOpacity>
      )}
    </>
  );
}
