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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { useCall } from '../../contexts/CallContext';

const { width, height } = Dimensions.get('window');

export function ActiveCallModal() {
  const { colors, isDark } = useTheme();
  const { activeCall, outgoingCall, endCall } = useCall();
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
      await endCall();
    } catch (error) {
      console.error('Error ending call:', error);
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
  const otherUserName =
    activeCall.caller_id === activeCall.receiver_id
      ? activeCall.caller_username
      : activeCall.caller_id !== activeCall.receiver_id
        ? activeCall.caller_username
        : activeCall.receiver_username;

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
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {otherUserName.charAt(0).toUpperCase()}
              </Text>
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
            {/* Mute button */}
            <TouchableOpacity
              style={[
                styles.controlButton,
                { backgroundColor: isMuted ? colors.primary : colors.secondary + '40' },
              ]}
              onPress={() => setIsMuted(!isMuted)}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={24}
                color={isMuted ? '#fff' : colors.text}
              />
              <Text
                style={[
                  styles.controlLabel,
                  { color: isMuted ? '#fff' : colors.text },
                ]}
              >
                Mute
              </Text>
            </TouchableOpacity>

            {/* Speaker button */}
            <TouchableOpacity
              style={[
                styles.controlButton,
                { backgroundColor: isSpeakerOn ? colors.primary : colors.secondary + '40' },
              ]}
              onPress={() => setIsSpeakerOn(!isSpeakerOn)}
            >
              <Ionicons
                name={isSpeakerOn ? 'volume-high' : 'volume-mute'}
                size={24}
                color={isSpeakerOn ? '#fff' : colors.text}
              />
              <Text
                style={[
                  styles.controlLabel,
                  { color: isSpeakerOn ? '#fff' : colors.text },
                ]}
              >
                Speaker
              </Text>
            </TouchableOpacity>

            {/* End call button (full width at bottom) */}
            <View style={styles.endCallWrapper}>
              <TouchableOpacity
                style={[styles.endCallButton, { backgroundColor: '#DC2626' }]}
                onPress={handleEndCall}
              >
                <Ionicons name="call" size={24} color="#fff" />
                <Text style={styles.endCallLabel}>End Call</Text>
              </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  endCallWrapper: {
    marginTop: 12,
  },
  endCallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  endCallLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
