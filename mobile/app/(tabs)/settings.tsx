import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { useToast } from '../../contexts/ToastContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { apiClient } from '../../utils/api';
import { getApiBase } from '../../constants/API';
import { storage } from '../../utils/storage';
import * as ImagePicker from 'expo-image-picker';
import { applyAppIconPreference, loadAppIconPreference, saveAppIconPreference, type AppIconPreference } from '../../utils/appIcon';
import { openInAppBrowser } from '../../utils/inAppBrowser';

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
  const { showConfirm, showSuccess, showError } = useAlert();
  const { showSuccess: showToastSuccess, showError: showToastError } = useToast();
  const router = useRouter();
  const [bugReportVisible, setBugReportVisible] = useState(false);
  const [bugMessage, setBugMessage] = useState('');
  const [bugScreenshot, setBugScreenshot] = useState<{ uri: string; filename: string; mimeType: string } | null>(null);
  const [sendingBugReport, setSendingBugReport] = useState(false);
  const [iconPreference, setIconPreference] = useState<AppIconPreference>({
    color: 'white',
    shape: 'square',
  });
  const [iconLoading, setIconLoading] = useState(true);

  useEffect(() => {
    const loadIconPreference = async () => {
      try {
        const pref = await loadAppIconPreference();
        setIconPreference(pref);
      } finally {
        setIconLoading(false);
      }
    };
    loadIconPreference();
  }, []);

  const handleOpenLink = async (url: string) => {
    try {
      console.log('🔗 Opening link:', url);
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      console.log('🔗 Full URL:', fullUrl);
      await openInAppBrowser(fullUrl);
    } catch (error) {
      console.error('🔗 Unexpected error:', error);
      showToastError('Could not open link');
    }
  };

  const handleLogout = () => {
    showConfirm(
      'Are you sure you want to logout?',
      async () => {
        await logout();
        // Navigate to root which will redirect to auth screen
        router.replace('/');
      },
      undefined,
      'Logout',
      true // destructive action
    );
  };

  const handleDownloadData = () => {
    showConfirm(
      'Your data will be prepared and sent to your email address.',
      () => {
        showSuccess('Your data download request has been received. You will receive an email shortly.');
      },
      undefined,
      'Download Your Data'
    );
  };

  const handleChangePassword = async () => {
    showConfirm(
      'You will receive a password change link via email. Click the link in the email to change your password.',
      async () => {
        try {
          await apiClient.post('/auth/request-password-change/');
          showToastSuccess('Password change link has been sent to your email.');
        } catch (error: any) {
          const errorMessage = error?.response?.data?.detail || 'Failed to send password change link. Please try again.';
          showToastError(errorMessage);
        }
      },
      undefined,
      'Change Password'
    );
  };

  const handlePickScreenshot = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showError('Permission to access photos is required');
        return;
      }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
      quality: 0.8,
        allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const filename = asset.uri.split('/').pop() || 'screenshot.jpg';
        const ext = filename.split('.').pop()?.toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'gif') mimeType = 'image/gif';
        else if (ext === 'webp') mimeType = 'image/webp';
        else mimeType = 'image/jpeg';
        
        setBugScreenshot({
          uri: asset.uri,
          filename,
          mimeType,
        });
      }
    } catch (error) {
      console.error('Error picking screenshot:', error);
      showError('Failed to pick image. Please try again.');
    }
  };

  const handleSubmitBugReport = async () => {
    if (!bugMessage.trim()) {
      showError('Please enter a bug description');
      return;
    }

    try {
      setSendingBugReport(true);
      
      // Use fetch directly like the frontend - no custom headers, let FormData set Content-Type automatically
      const formData = new FormData();
      formData.append('message', bugMessage);

      // Only append screenshot if it exists and is valid
      if (bugScreenshot && bugScreenshot.uri) {
        // Use the exact same structure as working uploads (messages, profile, etc.)
        formData.append('screenshot', {
          uri: bugScreenshot.uri,
          type: bugScreenshot.mimeType,
          name: bugScreenshot.filename,
        } as any);
        console.log('[Bug Report] Appending screenshot:', {
          filename: bugScreenshot.filename,
          mimeType: bugScreenshot.mimeType,
          uri: bugScreenshot.uri.substring(0, 50) + '...',
        });
      }

      const base = getApiBase();
      const url = `${base.replace(/\/+$/, '')}/feedback/`;
      const accessToken = await storage.getAccessToken();
      
      console.log('[Bug Report] Submitting to:', url, 'message length:', bugMessage.length, 'has screenshot:', !!bugScreenshot);
      
      // Use fetch directly like frontend - no Content-Type header, let FormData handle it
      const response = await fetch(url, {
        method: 'POST',
        headers: accessToken ? {
          Authorization: `Bearer ${accessToken}`,
        } : {},
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.detail || errorData.message || 'Failed to submit bug report');
      }
      
      showSuccess('Bug report submitted successfully. Thank you!');
      setBugMessage('');
      setBugScreenshot(null);
      setBugReportVisible(false);
    } catch (error: any) {
      console.error('Bug report error:', error);
      const errorMessage = error?.response?.data?.error || 
                          error?.response?.data?.detail || 
                          error?.response?.data?.message || 
                          error?.message || 
                          'Failed to submit bug report. Please check your connection and try again.';
      showError(errorMessage);
    } finally {
      setSendingBugReport(false);
    }
  };

  const handleOpenFAQ = () => {
    console.log('🔗 FAQ button pressed');
    showToastSuccess('Opening FAQ...');
    handleOpenLink('https://www.mylibertysocial.com/faq');
  };

  const handleOpenPrivacyStatement = () => {
    handleOpenLink('https://www.mylibertysocial.com/privacy');
  };

  const handleRequestAccountDeletion = () => {
    handleOpenLink('https://www.mylibertysocial.com/account-deletion');
  };

  const settings: SettingSection[] = [
    {
      title: 'General',
      items: [
        {
          type: 'switch',
          label: 'Dark Mode',
          value: mode === 'dark',
          onValueChange: (value: boolean) => setMode(value ? 'dark' : 'light'),
        },
      ],
    },
    {
      title: 'App Icon',
      items: [],
    },
    {
      title: 'Account',
      items: [
        {
          type: 'link',
          label: 'Saved Posts',
          icon: 'bookmark-outline',
          onPress: () => router.push('/(tabs)/settings/saved-posts'),
        },
        {
          type: 'link',
          label: 'Privacy Settings',
          icon: 'lock-closed-outline',
          onPress: () => router.push('/(tabs)/settings/privacy'),
        },
        {
          type: 'link',
          label: 'Security & Sessions',
          icon: 'shield-checkmark-outline',
          onPress: () => router.push('/(tabs)/settings/security'),
        },
        {
          type: 'link',
          label: 'Change Password',
          icon: 'key-outline',
          onPress: handleChangePassword,
        },
        {
          type: 'link',
          label: 'Download Your Data',
          icon: 'download-outline',
          onPress: handleDownloadData,
        },
        {
          type: 'link',
          label: 'Blocked Users',
          icon: 'ban-outline',
          onPress: () => router.push('/(tabs)/settings/blocked'),
        },
        {
          type: 'link',
          label: 'Content Filters',
          icon: 'eye-off-outline',
          onPress: () => router.push('/(tabs)/settings/content-filters'),
        },
        {
          type: 'link',
          label: 'Moderation History',
          icon: 'shield-checkmark-outline',
          onPress: () => router.push('/(tabs)/settings/moderation-history'),
        },
        {
          type: 'link',
          label: 'Request Account Deletion',
          icon: 'trash-outline',
          onPress: handleRequestAccountDeletion,
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          type: 'link',
          label: 'FAQ',
          icon: 'help-circle-outline',
          onPress: handleOpenFAQ,
        },
        {
          type: 'link',
          label: 'Report a Bug',
          icon: 'bug-outline',
          onPress: () => setBugReportVisible(true),
        },
        {
          type: 'link',
          label: 'Privacy Statement',
          icon: 'document-text-outline',
          onPress: handleOpenPrivacyStatement,
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
      paddingBottom: 120,
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
    iconSection: {
      gap: 12,
    },
    iconOptions: {
      flexDirection: 'row',
      gap: 12,
    },
    iconCard: {
      flex: 1,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
    },
    iconCardSelected: {
      borderWidth: 2,
    },
    iconImage: {
      width: 64,
      height: 64,
      borderRadius: 14,
      marginBottom: 8,
    },
    iconLabel: {
      fontSize: 13,
      fontWeight: '600',
    },
    iconToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
    },
    iconToggleLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    iconToggleHint: {
      marginTop: 4,
      fontSize: 12,
    },
    settingLabel: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      marginLeft: 12,
    },
    primaryActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: '#192A4A',
      borderWidth: 1,
      borderColor: '#C8A25F',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 4,
    },
    primaryActionText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    logoutButton: {
      margin: 16,
      marginTop: 32,
      marginBottom: 16,
    },
    copyrightContainer: {
      paddingVertical: 24,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    copyrightText: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 24,
      width: '90%',
      maxWidth: 400,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    modalInput: {
      backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
      borderRadius: 8,
      padding: 12,
      minHeight: 120,
      color: colors.text,
      textAlignVertical: 'top',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
    },
    modalButton: {
      flex: 1,
    },
    screenshotSection: {
      marginBottom: 16,
    },
    screenshotButton: {
      width: '100%',
    },
    screenshotPreview: {
      marginTop: 12,
      borderRadius: 8,
      overflow: 'hidden',
      position: 'relative',
    },
    screenshotImage: {
      width: '100%',
      height: 150,
      borderRadius: 8,
    },
    removeScreenshotButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      borderRadius: 16,
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <AppNavbar title="Settings" showProfileImage={false} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
      {settings.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.title === 'App Icon' ? (
            <View style={styles.iconSection}>
              <View style={styles.iconOptions}>
                {(['white', 'blue'] as const).map((color) => {
                  const isSelected = iconPreference.color === color;
                  const squareSource =
                    color === 'white'
                      ? require('../../assets/app-icons/white.png')
                      : require('../../assets/app-icons/blue.png');
                  const roundSource =
                    color === 'white'
                      ? require('../../assets/liberty-social-white-icon-set/android/mipmap-xxxhdpi/ic_launcher_round.png')
                      : require('../../assets/liberty-social-blue-icon-set/android/mipmap-xxxhdpi/ic_launcher_round.png');
                  const source =
                    Platform.OS === 'android' && iconPreference.shape === 'round'
                      ? roundSource
                      : squareSource;
                  return (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.iconCard,
                        isSelected && styles.iconCardSelected,
                        { borderColor: isSelected ? '#C8A25F' : colors.border },
                      ]}
                      onPress={async () => {
                        const next = { ...iconPreference, color };
                        setIconPreference(next);
                        await saveAppIconPreference(next);
                        await applyAppIconPreference(next);
                        showToastSuccess('App icon will update after restart.');
                      }}
                      disabled={iconLoading}
                    >
                      <Image source={source} style={styles.iconImage} />
                      <Text style={[styles.iconLabel, { color: colors.text }]}>
                        {color === 'white' ? 'White' : 'Blue'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {Platform.OS === 'android' ? (
                <View style={styles.iconToggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.iconToggleLabel, { color: colors.text }]}>
                      Rounded icon
                    </Text>
                    <Text style={[styles.iconToggleHint, { color: colors.textSecondary }]}>
                      Applies on next restart.
                    </Text>
                  </View>
                  <Switch
                    value={iconPreference.shape === 'round'}
                    onValueChange={async (value) => {
                      const next = { ...iconPreference, shape: value ? 'round' : 'square' };
                      setIconPreference(next);
                      await saveAppIconPreference(next);
                      await applyAppIconPreference(next);
                      showToastSuccess('App icon will update after restart.');
                    }}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#FFFFFF"
                    disabled={iconLoading}
                  />
                </View>
              ) : null}
            </View>
          ) : (
          section.items.map((item, index) => {
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
          })
          )}
        </View>
      ))}

      <TouchableOpacity style={[styles.primaryActionButton, styles.logoutButton]} onPress={handleLogout}>
        <Text style={styles.primaryActionText}>Logout</Text>
      </TouchableOpacity>

      <View style={styles.copyrightContainer}>
        <Text style={styles.copyrightText}>
          © {new Date().getFullYear()} Liberty Social
        </Text>
      </View>
      </ScrollView>

      {/* Bug Report Modal */}
      <Modal
        visible={bugReportVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBugReportVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report a Bug</Text>
              <TouchableOpacity onPress={() => setBugReportVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Describe the bug you encountered..."
              placeholderTextColor={colors.textSecondary}
              multiline
              value={bugMessage}
              onChangeText={setBugMessage}
              editable={!sendingBugReport}
            />

            <View style={styles.screenshotSection}>
              <TouchableOpacity
                style={[styles.primaryActionButton, styles.screenshotButton]}
                onPress={handlePickScreenshot}
                disabled={sendingBugReport}
              >
                <Ionicons name="image-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>
                  {bugScreenshot ? 'Change Screenshot' : 'Add Screenshot (Optional)'}
                </Text>
              </TouchableOpacity>

              {bugScreenshot && bugScreenshot.uri && (
                <View style={styles.screenshotPreview}>
                  <Image 
                    source={{ uri: bugScreenshot.uri }} 
                    style={styles.screenshotImage}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.removeScreenshotButton}
                    onPress={() => setBugScreenshot(null)}
                    disabled={sendingBugReport}
                  >
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.primaryActionButton, styles.modalButton]}
                onPress={() => setBugReportVisible(false)}
                disabled={sendingBugReport}
              >
                <Text style={styles.primaryActionText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.primaryActionButton, styles.modalButton]}
                onPress={handleSubmitBugReport}
                disabled={sendingBugReport}
              >
                {sendingBugReport ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryActionText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
