import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';

interface SendAdminInviteModalProps {
  visible: boolean;
  pageId: number;
  onClose: () => void;
  onInviteSent?: () => void;
}

type InviteRole = 'admin' | 'editor' | 'moderator';

export default function SendAdminInviteModal({
  visible,
  pageId,
  onClose,
  onInviteSent,
}: SendAdminInviteModalProps) {
  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('admin');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (!submitting) {
      setEmail('');
      setRole('admin');
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      showError('Please enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showError('Please enter a valid email address');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.post(`/pages/${pageId}/invite-admin/`, {
        email: email.trim(),
        role: role,
      });

      showSuccess('Admin invite sent successfully!');
      setEmail('');
      setRole('admin');
      onInviteSent?.();
      onClose();
    } catch (error: any) {
      console.error('Failed to send admin invite:', error);
      console.error('Error response:', error?.response?.data);
      console.error('Error status:', error?.response?.status);
      
      // Extract error message from various possible locations
      let errorMessage = 'Failed to send admin invite';
      
      if (error?.response?.data) {
        const data = error.response.data;
        
        // Check for detail field (most common)
        if (data.detail) {
          errorMessage = data.detail;
        }
        // Check for message field
        else if (data.message) {
          errorMessage = data.message;
        }
        // Check for error field
        else if (data.error) {
          errorMessage = data.error;
        }
        // Check for email field errors (validation errors)
        else if (data.email && Array.isArray(data.email)) {
          errorMessage = data.email[0];
        }
        // Check for role field errors
        else if (data.role && Array.isArray(data.role)) {
          errorMessage = data.role[0];
        }
        // Check for non_field_errors
        else if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
          errorMessage = data.non_field_errors[0];
        }
      }
      
      // Provide user-friendly messages for common errors
      if (error?.response?.status === 404) {
        errorMessage = 'User with this email not found. The user must be registered on Liberty Social.';
      } else if (error?.response?.status === 400 && errorMessage.includes('already')) {
        // Keep the backend message as it's already user-friendly
      } else if (error?.response?.status === 403) {
        errorMessage = 'You do not have permission to send admin invites for this page.';
      }
      
      showError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF' }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Send Admin Invite</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.contentWrapper}>
            <ScrollView 
              style={styles.content} 
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Email Address</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    backgroundColor: isDark ? colors.background : '#F8F9FF',
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Enter email address"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
              />
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                The user must be registered on Liberty Social
              </Text>
            </View>

            {/* Role Selection */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Role</Text>
              <View style={styles.roleContainer}>
                {(['admin', 'editor', 'moderator'] as InviteRole[]).map((roleOption) => (
                  <TouchableOpacity
                    key={roleOption}
                    style={[
                      styles.roleButton,
                      {
                        backgroundColor:
                          role === roleOption
                            ? '#192A4A'
                            : isDark
                            ? colors.background
                            : '#F8F9FF',
                        borderColor: role === roleOption ? '#C8A25F' : colors.border,
                      },
                    ]}
                    onPress={() => setRole(roleOption)}
                    disabled={submitting}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        {
                          color: role === roleOption ? '#FFFFFF' : colors.text,
                          fontWeight: role === roleOption ? '600' : '500',
                        },
                      ]}
                    >
                      {roleOption.charAt(0).toUpperCase() + roleOption.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: '#192A4A', borderColor: '#C8A25F' },
                submitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting || !email.trim()}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Send Invite</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: 400,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  contentWrapper: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
    minHeight: 300,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    borderWidth: 1,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleButtonText: {
    fontSize: 14,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

