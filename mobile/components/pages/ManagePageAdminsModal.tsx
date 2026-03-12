import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../contexts/ThemeContext';
import { useAlert } from '../../contexts/AlertContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';

type PageAdminRole = 'owner' | 'admin' | 'editor' | 'moderator';

type PageAdminEntry = {
  id: string;
  role: PageAdminRole;
  user: {
    id: string;
    email?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    profile_image?: string | null;
  };
};

interface ManagePageAdminsModalProps {
  visible: boolean;
  pageId: number;
  isOwner: boolean;
  onClose: () => void;
}

const ROLE_LABELS: Record<PageAdminRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  moderator: 'Moderator',
};

export default function ManagePageAdminsModal({
  visible,
  pageId,
  isOwner,
  onClose,
}: ManagePageAdminsModalProps) {
  const { colors, isDark } = useTheme();
  const { showConfirm } = useAlert();
  const { showError, showSuccess } = useToast();
  const [admins, setAdmins] = useState<PageAdminEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingAdminId, setRemovingAdminId] = useState<string | null>(null);

  const loadAdmins = useCallback(async () => {
    if (!visible || !pageId) return;
    try {
      setLoading(true);
      const response = await apiClient.get<PageAdminEntry[]>(`/pages/${pageId}/admins/`);
      setAdmins(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Failed to load page admins:', error);
      showError('Failed to load page admins');
    } finally {
      setLoading(false);
    }
  }, [pageId, showError, visible]);

  useEffect(() => {
    if (visible) {
      loadAdmins();
    }
  }, [loadAdmins, visible]);

  const handleRemoveAdmin = (entry: PageAdminEntry) => {
    if (!isOwner || entry.role === 'owner') {
      return;
    }

    const name =
      [entry.user.first_name, entry.user.last_name].filter(Boolean).join(' ').trim() ||
      entry.user.username ||
      entry.user.email ||
      'this admin';

    showConfirm(
      `Remove ${name} as a page admin?`,
      async () => {
        try {
          setRemovingAdminId(entry.user.id);
          await apiClient.delete(`/pages/${pageId}/admins/${entry.user.id}/`);
          setAdmins((current) => current.filter((admin) => admin.user.id !== entry.user.id));
          showSuccess('Page admin removed');
        } catch (error) {
          console.error('Failed to remove page admin:', error);
          showError('Failed to remove page admin');
        } finally {
          setRemovingAdminId(null);
        }
      },
      undefined,
      'Remove Admin',
      true
    );
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    sheet: {
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderRadius: 20,
      maxHeight: '80%',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
      paddingHorizontal: 18,
      paddingTop: 12,
    },
    closeButton: {
      padding: 4,
    },
    content: {
      paddingHorizontal: 18,
      paddingVertical: 14,
      gap: 12,
    },
    adminCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
      gap: 10,
    },
    adminTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    adminIdentity: {
      flex: 1,
      gap: 4,
    },
    adminName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    adminMeta: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    roleBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: isDark ? colors.background : '#F4F6FB',
      borderWidth: 1,
      borderColor: colors.border,
    },
    roleText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    removeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 10,
      paddingVertical: 10,
      backgroundColor: '#8A1F1F',
    },
    removeButtonDisabled: {
      opacity: 0.6,
    },
    removeButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
    },
    emptyState: {
      paddingVertical: 24,
      alignItems: 'center',
      gap: 8,
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    loadingState: {
      paddingVertical: 32,
      alignItems: 'center',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Page Admins</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            {isOwner
              ? 'You can review current admins and remove non-owner roles from this page.'
              : 'You can review the current page admin list.'}
          </Text>

          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : admins.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={32} color={colors.textSecondary} />
                <Text style={styles.emptyText}>No page admins were found.</Text>
              </View>
            ) : (
              admins.map((entry) => {
                const fullName = [entry.user.first_name, entry.user.last_name]
                  .filter(Boolean)
                  .join(' ')
                  .trim();
                const displayName = fullName || entry.user.username || entry.user.email || 'Unknown user';
                const secondary = entry.user.email || entry.user.username || '';
                const canRemove = isOwner && entry.role !== 'owner';

                return (
                  <View
                    key={entry.id}
                    style={[
                      styles.adminCard,
                      {
                        backgroundColor: isDark ? colors.background : '#F8F9FF',
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.adminTopRow}>
                      <View style={styles.adminIdentity}>
                        <Text style={styles.adminName}>{displayName}</Text>
                        {secondary ? <Text style={styles.adminMeta}>{secondary}</Text> : null}
                      </View>
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleText}>{ROLE_LABELS[entry.role]}</Text>
                      </View>
                    </View>

                    {canRemove ? (
                      <TouchableOpacity
                        style={[
                          styles.removeButton,
                          removingAdminId === entry.user.id && styles.removeButtonDisabled,
                        ]}
                        onPress={() => handleRemoveAdmin(entry)}
                        disabled={removingAdminId === entry.user.id}
                      >
                        {removingAdminId === entry.user.id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                            <Text style={styles.removeButtonText}>Remove Admin</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
