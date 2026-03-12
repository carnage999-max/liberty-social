import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { useCall } from '../../contexts/CallContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { resolveRemoteUrl } from '../../utils/url';

const { width, height } = Dimensions.get('window');

export function ActiveCallModal() {
  const { colors, isDark } = useTheme();
  const { activeCall, outgoingCall, endCall } = useCall();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  // Update call duration
  useEffect(() => {
    if (!activeCall) return;

    const interval = setInterval(() => {
      const startTime = new Date(activeCall.started_at).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setDuration(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCall]);

  if (!activeCall) return null;

  const handleEndCall = async () => {
    try {
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      
      await endCall();
      
      showToast(`Call ended • ${durationStr}`, 'info', 3000);
    } catch (error) {
      console.error('Error ending call:', error);
      showToast('Failed to end call', 'error');
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const callType = activeCall.call_type === 'video' ? 'Video Call' : 'Voice Call';
  const otherUser =
    user?.id === activeCall.caller.id
      ? activeCall.receiver
      : activeCall.caller;
  const otherUserName = otherUser.username;
  const otherUserAvatar = resolveRemoteUrl(otherUser.profile_image_url);

  return (
    <Modal
      visible={!!activeCall}
      transparent
      animationType="slide"
      hardwareAccelerated
    >
      <LinearGradient
        colors={['#1a1a1a', '#2a2a2a']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header with call info */}
          <View style={styles.header}>
            <Text style={[styles.callType, { color: colors.textSecondary }]}>
              {callType}
            </Text>
            <Text style={[styles.callerName, { color: colors.text }]}>
              {otherUserName}
            </Text>
            <Text style={[styles.duration, { color: colors.textSecondary }]}>
              {formatDuration(duration)}
            </Text>
          </View>

          {/* Video/avatar area (placeholder for video stream) */}
          <View style={[styles.videoArea, { backgroundColor: colors.background + '80' }]}>
            <View
              style={[
                styles.avatarContainer,
                { backgroundColor: colors.primary + '30' },
              ]}
            >
              {otherUserAvatar ? (
                <Image source={{ uri: otherUserAvatar }} style={styles.avatarImage} />
              ) : (
                <Text style={[styles.avatarText, { color: colors.primary }]}>
                  {(otherUserName || '?').charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            {activeCall.call_type === 'video' && (
              <TouchableOpacity
                style={[
                  styles.videoToggle,
                  { backgroundColor: isVideoOff ? colors.primary : '#16A34A' },
                ]}
                onPress={() => setIsVideoOff(!isVideoOff)}
              >
                <Ionicons
                  name={isVideoOff ? 'videocam-off' : 'videocam'}
                  size={20}
                  color="#fff"
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Control buttons */}
          <View style={styles.controls}>
            <View style={styles.controlRow}>
              <View style={styles.controlItem}>
                <TouchableOpacity
                  style={[
                    styles.roundControlButton,
                    { backgroundColor: isMuted ? '#192A4A' : 'rgba(255,255,255,0.15)' },
                  ]}
                  onPress={() => setIsMuted(!isMuted)}
                >
                  <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.controlLabel}>Mute</Text>
              </View>

              <View style={styles.controlItem}>
                <TouchableOpacity
                  style={[
                    styles.roundControlButton,
                    { backgroundColor: isSpeakerOn ? '#192A4A' : 'rgba(255,255,255,0.15)' },
                  ]}
                  onPress={() => setIsSpeakerOn(!isSpeakerOn)}
                >
                  <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-mute'} size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.controlLabel}>Speaker</Text>
              </View>

              <View style={styles.controlItem}>
                <TouchableOpacity
                  style={[styles.roundControlButton, { backgroundColor: '#DC2626' }]}
                  onPress={handleEndCall}
                >
                  <Ionicons name="call-sharp" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.controlLabel}>End</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  callType: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  callerName: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  duration: {
    fontSize: 14,
    fontWeight: '500',
  },
  videoArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 20,
    borderRadius: 12,
    position: 'relative',
  },
  avatarContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 56,
    fontWeight: 'bold',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 70,
  },
  videoToggle: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlItem: {
    alignItems: 'center',
    gap: 8,
  },
  roundControlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
});
