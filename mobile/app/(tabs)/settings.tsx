import React, { useState } from 'react';
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
  Linking,
  Image,
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
import * as WebBrowser from 'expo-web-browser';

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

  const handleOpenLink = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        toolbarColor: colors.background,
        controlsColor: colors.primary,
      });
    } catch (error) {
      showToastError('Could not open link');
      console.error('Error opening link:', error);
    }
  };

  const handleLogout = () => {
    showConfirm(
      'Are you sure you want to logout?',
      async () => {
        await logout();
        router.replace('/(auth)');
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
    handleOpenLink('https://mylibertysocial.com/faq');
  };

  const handleOpenPrivacyStatement = () => {
    handleOpenLink('https://mylibertysocial.com/privacy');
  };

  const handleRequestAccountDeletion = () => {
    handleOpenLink('https://mylibertysocial.com/account-deletion');
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
    settingLabel: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      marginLeft: 12,
    },
    logoutButton: {
      margin: 16,
      marginTop: 32,
      marginBottom: 16,
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
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
      minWidth: 80,
      alignItems: 'center',
    },
    modalButtonCancel: {
      backgroundColor: colors.border,
    },
    modalButtonSubmit: {
      backgroundColor: colors.primary,
    },
    modalButtonText: {
      fontSize: 15,
      fontWeight: '600',
    },
    modalButtonTextCancel: {
      color: colors.text,
    },
    modalButtonTextSubmit: {
      color: '#FFFFFF',
    },
    screenshotSection: {
      marginBottom: 16,
    },
    screenshotButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      gap: 8,
    },
    screenshotButtonText: {
      color: colors.text,
      fontSize: 14,
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
                style={styles.screenshotButton}
                onPress={handlePickScreenshot}
                disabled={sendingBugReport}
              >
                <Ionicons name="image-outline" size={20} color={colors.text} />
                <Text style={styles.screenshotButtonText}>
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
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setBugReportVisible(false)}
                disabled={sendingBugReport}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextCancel]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSubmit]}
                onPress={handleSubmitBugReport}
                disabled={sendingBugReport}
              >
                {sendingBugReport ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalButtonText, styles.modalButtonTextSubmit]}>
                    Submit
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
