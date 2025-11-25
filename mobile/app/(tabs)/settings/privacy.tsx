import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAlert } from '../../../contexts/AlertContext';
import { apiClient } from '../../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppNavbar from '../../../components/layout/AppNavbar';
import { SkeletonPrivacy } from '../../../components/common/SkeletonPrivacy';

// Backend response interface
interface BackendPrivacySettings {
  profile_privacy: 'public' | 'private' | 'only_me';
  friends_publicity: 'public' | 'private' | 'only_me';
}

// Mobile UI interface
interface PrivacySettings {
  profile_visibility: 'public' | 'friends' | 'private';
  show_online_status: boolean;
  allow_friend_requests: boolean;
  allow_messages: 'everyone' | 'friends' | 'none';
  show_posts_to: 'public' | 'friends' | 'private';
}

export default function PrivacySettingsScreen() {
  const { colors, isDark } = useTheme();
  const { showSuccess, showError } = useAlert();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PrivacySettings>({
    profile_visibility: 'public',
    show_online_status: true,
    allow_friend_requests: true,
    allow_messages: 'friends',
    show_posts_to: 'public',
  });

  useEffect(() => {
    loadPrivacySettings();
  }, []);

  // Map backend response to mobile UI
  const mapBackendToMobile = (backend: BackendPrivacySettings): PrivacySettings => {
    // Map 'only_me' to 'private', and keep 'public' and 'private' as is
    const mapPrivacy = (value: 'public' | 'private' | 'only_me'): 'public' | 'friends' | 'private' => {
      if (value === 'only_me') return 'private';
      if (value === 'private') return 'friends'; // Map backend 'private' to mobile 'friends'
      return 'public';
    };

    return {
      profile_visibility: mapPrivacy(backend.profile_privacy),
      show_online_status: true, // Default, not in backend
      allow_friend_requests: true, // Default, not in backend
      allow_messages: 'friends', // Default, not in backend
      show_posts_to: mapPrivacy(backend.friends_publicity),
    };
  };

  // Map mobile UI to backend request
  const mapMobileToBackend = (mobile: Partial<PrivacySettings>): Partial<BackendPrivacySettings> => {
    const backend: Partial<BackendPrivacySettings> = {};

    // Map 'friends' back to 'private', and keep 'public' and 'private' as is
    const mapPrivacyBack = (value: 'public' | 'friends' | 'private'): 'public' | 'private' | 'only_me' => {
      if (value === 'friends') return 'private'; // Map mobile 'friends' to backend 'private'
      if (value === 'private') return 'only_me'; // Map mobile 'private' to backend 'only_me'
      return 'public';
    };

    if (mobile.profile_visibility !== undefined) {
      backend.profile_privacy = mapPrivacyBack(mobile.profile_visibility);
    }
    if (mobile.show_posts_to !== undefined) {
      backend.friends_publicity = mapPrivacyBack(mobile.show_posts_to);
    }

    return backend;
  };

  const loadPrivacySettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<BackendPrivacySettings>('/auth/settings/');
      const mappedSettings = mapBackendToMobile(response);
      setSettings(mappedSettings);
    } catch (error) {
      console.error('Error loading privacy settings:', error);
      // If endpoint doesn't exist yet, use defaults
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: Partial<PrivacySettings>) => {
    try {
      setSaving(true);
      const updatedSettings = { ...settings, ...newSettings };
      const backendData = mapMobileToBackend(updatedSettings);
      await apiClient.patch('/auth/settings/', backendData);
      setSettings(updatedSettings);
      showSuccess('Privacy settings updated');
    } catch (error) {
      console.error('Error saving privacy settings:', error);
      showError('Failed to update privacy settings');
    } finally {
      setSaving(false);
    }
  };

  const renderOption = (
    label: string,
    description: string,
    currentValue: string,
    options: Array<{ label: string; value: string }>,
    onSelect: (value: string) => void
  ) => {
    return (
      <View style={styles.settingSection}>
        <View style={styles.settingHeader}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
            {description}
          </Text>
        </View>
        <View style={styles.optionsContainer}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionButton,
                {
                  backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
                  borderColor: currentValue === option.value ? colors.primary : colors.border,
                  borderWidth: currentValue === option.value ? 2 : 1,
                },
              ]}
              onPress={() => onSelect(option.value)}
              disabled={saving}
            >
              <Text
                style={[
                  styles.optionText,
                  {
                    color: currentValue === option.value ? colors.primary : colors.text,
                    fontWeight: currentValue === option.value ? '600' : '400',
                  },
                ]}
              >
                {option.label}
              </Text>
              {currentValue === option.value && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderSwitch = (
    label: string,
    description: string,
    value: boolean,
    onChange: (value: boolean) => void
  ) => {
    return (
      <View style={styles.settingSection}>
        <View style={styles.switchRow}>
          <View style={styles.settingHeader}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
              {description}
            </Text>
          </View>
          <Switch
            value={value}
            onValueChange={onChange}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
            disabled={saving}
          />
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 120,
    },
    settingSection: {
      marginBottom: 24,
      padding: 16,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    settingHeader: {
      marginBottom: 12,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 13,
      lineHeight: 18,
    },
    optionsContainer: {
      gap: 8,
    },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      borderRadius: 8,
    },
    optionText: {
      fontSize: 15,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <AppNavbar 
          title="Privacy Settings" 
          showLogo={false} 
          showProfileImage={false} 
          showBackButton={true}
          onBackPress={() => router.push('/(tabs)/profile')}
        />
        <SkeletonPrivacy />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppNavbar 
        title="Privacy Settings" 
        showLogo={false} 
        showProfileImage={false} 
        showBackButton={true}
        onBackPress={() => router.push('/(tabs)/settings')}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderOption(
          'Profile Visibility',
          'Control who can see your profile information',
          settings.profile_visibility,
          [
            { label: 'Public', value: 'public' },
            { label: 'Friends Only', value: 'friends' },
            { label: 'Private', value: 'private' },
          ],
          (value) => saveSettings({ profile_visibility: value as any })
        )}

        {renderOption(
          'Who Can See Your Posts',
          'Control who can view your posts and content',
          settings.show_posts_to,
          [
            { label: 'Everyone', value: 'public' },
            { label: 'Friends Only', value: 'friends' },
            { label: 'Only Me', value: 'private' },
          ],
          (value) => saveSettings({ show_posts_to: value as any })
        )}

        {renderOption(
          'Who Can Message You',
          'Control who can send you direct messages',
          settings.allow_messages,
          [
            { label: 'Everyone', value: 'everyone' },
            { label: 'Friends Only', value: 'friends' },
            { label: 'No One', value: 'none' },
          ],
          (value) => saveSettings({ allow_messages: value as any })
        )}

        {renderSwitch(
          'Show Online Status',
          'Let others see when you are online',
          settings.show_online_status,
          (value) => saveSettings({ show_online_status: value })
        )}

        {renderSwitch(
          'Allow Friend Requests',
          'Allow others to send you friend requests',
          settings.allow_friend_requests,
          (value) => saveSettings({ allow_friend_requests: value })
        )}
      </ScrollView>
    </View>
  );
}


