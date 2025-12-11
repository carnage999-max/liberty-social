import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAlert } from '../../../contexts/AlertContext';
import { useToast } from '../../../contexts/ToastContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppNavbar from '../../../components/layout/AppNavbar';
import { usePasskey } from '../../../hooks/usePasskey';
import { useDevices } from '../../../hooks/useDevices';
import { useSessions } from '../../../hooks/useSessions';
import { useActivityLog } from '../../../hooks/useActivityLog';
import { Platform } from 'react-native';

export default function SecuritySettingsScreen() {
  const { colors, isDark } = useTheme();
  const { showConfirm, showError, showSuccess } = useAlert();
  const { showSuccess: showToastSuccess, showError: showToastError } = useToast();
  const router = useRouter();

  // Passkey management
  const {
    status: passkeyStatus,
    loading: passkeyLoading,
    error: passkeyError,
    isAvailable,
    register: registerPasskey,
    removePasskey,
    fetchStatus: refetchPasskey,
  } = usePasskey();

  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [removingPasskeyId, setRemovingPasskeyId] = useState<string | null>(null);
  const [deviceNameModalVisible, setDeviceNameModalVisible] = useState(false);
  const [deviceName, setDeviceName] = useState('');

  // Device and Session Management
  const { devices, loading: devicesLoading, renameDevice, removeDevice, refetch: refetchDevices } = useDevices();
  const { sessions, loading: sessionsLoading, revokeAll, refetch: refetchSessions } = useSessions();
  const { activity, loading: activityLoading } = useActivityLog();

  const [renamingDeviceId, setRenamingDeviceId] = useState<string | null>(null);
  const [removingDeviceId, setRemovingDeviceId] = useState<string | null>(null);
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [deviceRenameValue, setDeviceRenameValue] = useState<Record<string, string>>({});
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedDeviceForRename, setSelectedDeviceForRename] = useState<string | null>(null);

  const getDeviceName = () => {
    if (Platform.OS === 'ios') {
      return 'iOS Device';
    } else if (Platform.OS === 'android') {
      return 'Android Device';
    }
    return 'Mobile Device';
  };

  const handleRegisterPasskey = async () => {
    if (!isAvailable) {
      showError('Passkeys are not available on this device');
      return;
    }

    // Prefill device name when opening modal
    setDeviceName(getDeviceName());
    setDeviceNameModalVisible(true);
  };

  const handleConfirmRegisterPasskey = async () => {
    try {
      setRegisteringPasskey(true);
      setDeviceNameModalVisible(false);
      await registerPasskey(deviceName || getDeviceName());
      setDeviceName('');
      showToastSuccess('Passkey registered successfully!');
      await refetchPasskey();
    } catch (err: any) {
      showToastError(err?.message || 'Failed to register passkey');
    } finally {
      setRegisteringPasskey(false);
    }
  };

  const handleRemovePasskey = (credentialId: string) => {
    showConfirm(
      'Are you sure you want to remove this passkey?',
      async () => {
        try {
          setRemovingPasskeyId(credentialId);
          await removePasskey(credentialId);
          showToastSuccess('Passkey removed successfully');
          await refetchPasskey();
        } catch (err: any) {
          showToastError(err?.message || 'Failed to remove passkey');
        } finally {
          setRemovingPasskeyId(null);
        }
      },
      undefined,
      'Remove Passkey',
      true
    );
  };

  const handleRenameDevice = (deviceId: string, currentName: string) => {
    setSelectedDeviceForRename(deviceId);
    setDeviceRenameValue({ [deviceId]: currentName });
    setRenameModalVisible(true);
  };

  const handleConfirmRenameDevice = async () => {
    if (!selectedDeviceForRename) return;
    const newName = deviceRenameValue[selectedDeviceForRename]?.trim();
    if (!newName) {
      showError('Device name cannot be empty');
      return;
    }

    try {
      setRenamingDeviceId(selectedDeviceForRename);
      await renameDevice(selectedDeviceForRename, newName);
      showToastSuccess('Device renamed successfully');
      setRenameModalVisible(false);
      setSelectedDeviceForRename(null);
      await refetchDevices();
    } catch (err: any) {
      showToastError(err?.message || 'Failed to rename device');
    } finally {
      setRenamingDeviceId(null);
    }
  };

  const handleRemoveDevice = (deviceId: string) => {
    showConfirm(
      'Are you sure you want to remove this device? This will revoke the passkey associated with it.',
      async () => {
        try {
          setRemovingDeviceId(deviceId);
          await removeDevice(deviceId);
          showToastSuccess('Device removed successfully');
          await refetchDevices();
          await refetchPasskey();
        } catch (err: any) {
          showToastError(err?.message || 'Failed to remove device');
        } finally {
          setRemovingDeviceId(null);
        }
      },
      undefined,
      'Remove Device',
      true
    );
  };

  const handleRevokeAllSessions = () => {
    showConfirm(
      'Are you sure you want to sign out of all other devices? You will remain signed in on this device.',
      async () => {
        try {
          setRevokingSessions(true);
          await revokeAll();
          showToastSuccess('Signed out of all other devices');
          await refetchSessions();
        } catch (err: any) {
          showToastError(err?.message || 'Failed to revoke sessions');
        } finally {
          setRevokingSessions(false);
        }
      },
      undefined,
      'Sign Out All Devices',
      true
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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
    button: {
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonPrimary: {
      backgroundColor: colors.primary,
    },
    buttonDanger: {
      backgroundColor: '#FF4D4F',
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    credentialItem: {
      padding: 16,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    credentialName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    credentialMeta: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    deviceItem: {
      padding: 16,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    deviceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    deviceName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    deviceActions: {
      flexDirection: 'row',
      gap: 8,
    },
    deviceMeta: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    sessionItem: {
      padding: 16,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sessionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    sessionName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    sessionCurrent: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
    },
    sessionMeta: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    activityItem: {
      padding: 16,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    activityHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    activityMethod: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    activityMeta: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
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
      color: colors.text,
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
    emptyState: {
      padding: 24,
      alignItems: 'center',
    },
    emptyStateText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <AppNavbar 
        title="Security & Sessions" 
        showProfileImage={false}
        showBackButton={true}
        onBackPress={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Passkeys Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Passkeys (WebAuthn)</Text>
          {!isAvailable && (
            <View style={styles.settingItem}>
              <Ionicons name="warning-outline" size={24} color={colors.textSecondary} />
              <Text style={[styles.settingLabel, { marginLeft: 12 }]}>
                Passkeys are not available on this device
              </Text>
            </View>
          )}
          {isAvailable && passkeyLoading && (
            <View style={styles.settingItem}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.settingLabel, { marginLeft: 12 }]}>Loading...</Text>
            </View>
          )}
          {isAvailable && !passkeyLoading && passkeyStatus && (
            <>
              {passkeyStatus.credentials.length === 0 ? (
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={handleRegisterPasskey}
                  disabled={registeringPasskey}
                >
                  {registeringPasskey ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Enable Passkey</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  {passkeyStatus.credentials.map((cred) => (
                    <View key={cred.id} style={styles.credentialItem}>
                      <Text style={styles.credentialName}>
                        {cred.device_name || 'Unnamed Device'}
                      </Text>
                      <Text style={styles.credentialMeta}>
                        Created: {formatDate(cred.created_at)}
                      </Text>
                      {cred.last_used_at && (
                        <Text style={styles.credentialMeta}>
                          Last used: {formatDate(cred.last_used_at)}
                        </Text>
                      )}
                      <TouchableOpacity
                        style={[styles.button, styles.buttonDanger, { marginTop: 8 }]}
                        onPress={() => handleRemovePasskey(cred.id)}
                        disabled={removingPasskeyId === cred.id}
                      >
                        {removingPasskeyId === cred.id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.buttonText}>Remove</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[styles.button, styles.buttonPrimary]}
                    onPress={handleRegisterPasskey}
                    disabled={registeringPasskey}
                  >
                    {registeringPasskey ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.buttonText}>Add Another Passkey</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>

        {/* Devices Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Devices</Text>
          {devicesLoading && (
            <View style={styles.settingItem}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.settingLabel, { marginLeft: 12 }]}>Loading devices...</Text>
            </View>
          )}
          {!devicesLoading && devices.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No devices registered</Text>
            </View>
          )}
          {!devicesLoading &&
            devices.map((device) => (
              <View key={device.id} style={styles.deviceItem}>
                <View style={styles.deviceHeader}>
                  <Text style={styles.deviceName}>{device.device_name}</Text>
                  <View style={styles.deviceActions}>
                    <TouchableOpacity
                      onPress={() => handleRenameDevice(device.id, device.device_name)}
                      disabled={renamingDeviceId === device.id}
                    >
                      <Ionicons
                        name="pencil-outline"
                        size={20}
                        color={renamingDeviceId === device.id ? colors.textSecondary : colors.primary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRemoveDevice(device.id)}
                      disabled={removingDeviceId === device.id}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color={removingDeviceId === device.id ? colors.textSecondary : '#FF4D4F'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                {device.location && (
                  <Text style={styles.deviceMeta}>Location: {device.location}</Text>
                )}
                {device.last_seen_location && (
                  <Text style={styles.deviceMeta}>Last seen: {device.last_seen_location}</Text>
                )}
                <Text style={styles.deviceMeta}>Created: {formatDate(device.created_at)}</Text>
                {device.last_used_at && (
                  <Text style={styles.deviceMeta}>Last used: {formatDate(device.last_used_at)}</Text>
                )}
              </View>
            ))}
        </View>

        {/* Active Sessions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Sessions</Text>
          {sessionsLoading && (
            <View style={styles.settingItem}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.settingLabel, { marginLeft: 12 }]}>Loading sessions...</Text>
            </View>
          )}
          {!sessionsLoading && sessions.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No active sessions</Text>
            </View>
          )}
          {!sessionsLoading &&
            sessions.map((session) => (
              <View key={session.id} style={styles.sessionItem}>
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionName}>
                    {session.device_name || 'Unknown Device'}
                  </Text>
                  {session.is_current && (
                    <Text style={styles.sessionCurrent}>Current</Text>
                  )}
                </View>
                {session.location && (
                  <Text style={styles.sessionMeta}>Location: {session.location}</Text>
                )}
                {session.ip_address && (
                  <Text style={styles.sessionMeta}>IP: {session.ip_address}</Text>
                )}
                <Text style={styles.sessionMeta}>Created: {formatDate(session.created_at)}</Text>
                <Text style={styles.sessionMeta}>
                  Last activity: {formatDate(session.last_activity)}
                </Text>
              </View>
            ))}
          {!sessionsLoading && sessions.length > 0 && (
            <TouchableOpacity
              style={[styles.button, styles.buttonDanger]}
              onPress={handleRevokeAllSessions}
              disabled={revokingSessions}
            >
              {revokingSessions ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Sign out of all other devices</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Activity Log Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Login Activity</Text>
          {activityLoading && (
            <View style={styles.settingItem}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.settingLabel, { marginLeft: 12 }]}>Loading activity...</Text>
            </View>
          )}
          {!activityLoading && activity.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No activity recorded</Text>
            </View>
          )}
          {!activityLoading &&
            activity.map((entry) => (
              <View key={entry.id} style={styles.activityItem}>
                <View style={styles.activityHeader}>
                  <Text style={styles.activityMethod}>
                    {entry.authentication_method === 'passkey' ? 'Passkey' : 'Password'} Login
                  </Text>
                  <Text style={styles.activityMeta}>{formatDate(entry.created_at)}</Text>
                </View>
                {entry.device_name && (
                  <Text style={styles.activityMeta}>Device: {entry.device_name}</Text>
                )}
                {entry.location && (
                  <Text style={styles.activityMeta}>Location: {entry.location}</Text>
                )}
                {entry.ip_address && (
                  <Text style={styles.activityMeta}>IP: {entry.ip_address}</Text>
                )}
              </View>
            ))}
        </View>
      </ScrollView>

      {/* Device Name Modal */}
      <Modal
        visible={deviceNameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setDeviceNameModalVisible(false);
          setDeviceName(''); // Clear device name when modal closes
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Device Name</Text>
              <TouchableOpacity onPress={() => {
                setDeviceNameModalVisible(false);
                setDeviceName(''); // Clear device name when modal closes
              }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter device name (optional)"
              placeholderTextColor={colors.textSecondary}
              value={deviceName}
              onChangeText={setDeviceName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setDeviceNameModalVisible(false);
                  setDeviceName('');
                }}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextCancel]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSubmit]}
                onPress={handleConfirmRegisterPasskey}
                disabled={registeringPasskey}
              >
                {registeringPasskey ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalButtonText, styles.modalButtonTextSubmit]}>Continue</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename Device Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rename Device</Text>
              <TouchableOpacity
                onPress={() => {
                  setRenameModalVisible(false);
                  setSelectedDeviceForRename(null);
                }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Device name"
              placeholderTextColor={colors.textSecondary}
              value={
                selectedDeviceForRename
                  ? deviceRenameValue[selectedDeviceForRename] || ''
                  : ''
              }
              onChangeText={(text) => {
                if (selectedDeviceForRename) {
                  setDeviceRenameValue({ [selectedDeviceForRename]: text });
                }
              }}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setRenameModalVisible(false);
                  setSelectedDeviceForRename(null);
                }}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextCancel]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSubmit]}
                onPress={handleConfirmRenameDevice}
                disabled={renamingDeviceId === selectedDeviceForRename}
              >
                {renamingDeviceId === selectedDeviceForRename ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalButtonText, styles.modalButtonTextSubmit]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

