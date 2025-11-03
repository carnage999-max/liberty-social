import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ScreenHeader from '../../components/layout/ScreenHeader';

type SwitchSetting = {
  type: 'switch';
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

type ActionSetting = {
  type: 'link';
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
};

type SettingSection = {
  title: string;
  items: Array<SwitchSetting | ActionSetting>;
};

export default function SettingsScreen() {
  const { colors, isDark, mode, setMode } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const settings: SettingSection[] = [
    {
      title: 'Appearance',
      items: [
        {
          type: 'switch',
          label: 'Dark Mode',
          value: mode === 'dark',
          onValueChange: (value: boolean) => setMode(value ? 'dark' : 'light'),
        },
        {
          type: 'switch',
          label: 'Use System Theme',
          value: mode === 'auto',
          onValueChange: (value: boolean) => setMode(value ? 'auto' : (isDark ? 'dark' : 'light')),
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          type: 'link',
          label: 'Edit Profile',
          icon: 'person-outline',
          onPress: () => router.push('/(tabs)/profile/edit'),
        },
        {
          type: 'link',
          label: 'Privacy Settings',
          icon: 'lock-closed-outline',
          onPress: () => router.push('/(tabs)/settings/privacy'),
        },
      ],
    },
    {
      title: 'Social',
      items: [
        {
          type: 'link',
          label: 'Friend Requests',
          icon: 'person-add-outline',
          onPress: () => router.push('/(tabs)/friend-requests'),
        },
        {
          type: 'link',
          label: 'Blocked Users',
          icon: 'ban-outline',
          onPress: () => router.push('/(tabs)/settings/blocked'),
        },
      ],
    },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    section: {
      marginTop: 24,
      paddingHorizontal: 16,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 12,
      letterSpacing: 0.5,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    settingLabel: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      marginLeft: 12,
    },
    logoutButton: {
      margin: 16,
      marginTop: 32,
      backgroundColor: '#FF4D4F',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    logoutButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      <ScreenHeader title="Settings" containerStyle={{ paddingBottom: 12 }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
      {settings.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map((item, index) => {
            if (item.type === 'switch') {
              return (
                <View key={`${section.title}-${index}`} style={styles.settingItem}>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  <Switch
                    value={item.value}
                    onValueChange={item.onValueChange}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              );
            }

            return (
              <TouchableOpacity
                key={`${section.title}-${index}`}
                style={styles.settingItem}
                onPress={item.onPress}
              >
                <Ionicons name={item.icon} size={24} color={colors.text} />
                <Text style={styles.settingLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
