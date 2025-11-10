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
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { useToast } from '../../contexts/ToastContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { apiClient } from '../../utils/api';
import * as ImagePicker from 'expo-image-picker';

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
  const [bugScreenshot, setBugScreenshot] = useState<string | null>(null);
  const [sendingBugReport, setSendingBugReport] = useState(false);

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
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setBugScreenshot(result.assets[0].uri);
    }
  };

  const handleSubmitBugReport = async () => {
    if (!bugMessage.trim()) {
      showError('Please enter a bug description');
      return;
    }

    try {
      setSendingBugReport(true);
      const formData = new FormData();
      formData.append('message', bugMessage);

      if (bugScreenshot) {
        const filename = bugScreenshot.split('/').pop() || 'screenshot.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('screenshot', {
          uri: bugScreenshot,
          name: filename,
          type,
        } as any);
      }

      await apiClient.post('/feedback/', formData);
      
      showSuccess('Bug report submitted successfully. Thank you!');
      setBugMessage('');
      setBugScreenshot(null);
      setBugReportVisible(false);
    } catch (error) {
      showError('Failed to submit bug report. Please try again.');
    } finally {
      setSendingBugReport(false);
    }
  };

  const handleOpenFAQ = () => {
    Linking.openURL('https://libertysocial.com/faq');
  };

  const handleOpenPrivacyStatement = () => {
    Linking.openURL('https://libertysocial.com/privacy');
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

              {bugScreenshot && (
                <View style={styles.screenshotPreview}>
                  <Image source={{ uri: bugScreenshot }} style={styles.screenshotImage} />
                  <TouchableOpacity
                    style={styles.removeScreenshotButton}
                    onPress={() => setBugScreenshot(null)}
                  >
                    <Ionicons name="close" size={20} color="#FFFFFF" />
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
