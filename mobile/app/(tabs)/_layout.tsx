import { Tabs } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ParamListBase } from '@react-navigation/native';
import type { BottomTabNavigationEventMap } from '@react-navigation/bottom-tabs';
import type { NavigationHelpers } from '@react-navigation/native';

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const bottomPadding = insets.bottom > 0 ? insets.bottom : 0;

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
                      onPress={onPress}
                    />
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
