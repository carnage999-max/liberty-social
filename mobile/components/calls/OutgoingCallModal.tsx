import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { useCall } from '../../contexts/CallContext';
import { useToast } from '../../contexts/ToastContext';

let RTCView: any = null;

try {
  const WebRTC = require('react-native-webrtc');
  RTCView = WebRTC.RTCView;
} catch (error) {
  // WebRTC not available in Expo Go
}

const { width, height } = Dimensions.get('window');

export function OutgoingCallModal() {
  const { colors, isDark } = useTheme();
  const { outgoingCall, endCall } = useCall();
  const { showToast } = useToast();
  const [duration, setDuration] = useState(0);
  const [localStream, setLocalStream] = useState<any>(null);
  const pulseAnim = new Animated.Value(1);

  // Update call duration
  useEffect(() => {
    if (!outgoingCall) return;

    const interval = setInterval(() => {
      const startTime = new Date(outgoingCall.started_at).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setDuration(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [outgoingCall]);

  // Initialize local video stream for video calls
  useEffect(() => {
    if (!outgoingCall || outgoingCall.call_type !== 'video') {
      // Clean up stream if call is not a video call
      if (localStream) {
        localStream.getTracks().forEach((track: any) => track.stop());
        setLocalStream(null);
      }
      return;
    }

    // Skip initializing if the native WebRTC module isn't available (Expo Go)
    if (!RTCView) {
      showToast('Video unavailable in this build. Use a development client for video.', 'info', 4000);
      return;
    }

    const initializeVideo = async () => {
      try {
        const { mediaDevices } = require('react-native-webrtc');

        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
        });

        setLocalStream(stream);
      } catch (error) {
        console.error('Error accessing camera:', error);
        showToast('Failed to access camera', 'error');
      }
    };

    initializeVideo();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track: any) => track.stop());
        setLocalStream(null);
      }
    };
  }, [outgoingCall, outgoingCall?.call_type]);

  // Pulse animation for ringing effect
  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, [pulseAnim]);

  if (!outgoingCall) return null;

  const callTypeIcon = outgoingCall.call_type === 'video' ? 'videocam' : 'call';
  const callTypeLabel = outgoingCall.call_type === 'video' ? 'Video Call' : 'Voice Call';
  const isActive = outgoingCall.status === 'active';

  const handleEndCall = async () => {
    try {
      await endCall();
      
      // Only show duration if call was active (answered)
      if (isActive) {
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        showToast(`Call ended • ${durationStr}`, 'info', 3000);
      } else {
        showToast('Call ended', 'info', 3000);
      }
    } catch (error) {
      console.error('Error ending call:', error);
      showToast('Failed to end call', 'error');
    }
  };

  return (
    <Modal
      visible={!!outgoingCall}
      transparent
      animationType="slide"
      hardwareAccelerated
    >
      {outgoingCall.call_type === 'video' && localStream && RTCView ? (
        // Video call layout
        <View style={styles.container}>
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.videoFeed}
            mirror={true}
          />
          
          {/* Overlay content */}
          <LinearGradient
            colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.6)']}
            style={styles.gradient}
            pointerEvents="none"
          />

          {/* Header with call type */}
          <View style={styles.videoHeader}>
            <Text style={[styles.callTypeLabel, { color: '#fff' }]}>
              Calling {outgoingCall.receiver.username}
            </Text>
            <Text style={[styles.callStatus, { color: '#fff' }]}>
              {isActive ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : 'Calling...'}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.videoActions}>
            <TouchableOpacity
              style={[styles.button, styles.endButton]}
              onPress={handleEndCall}
              activeOpacity={0.7}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="close" size={28} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Voice call layout (also shown for video calls when WebRTC isn't available)
        <LinearGradient
          colors={['#1a1a1a', '#2a2a2a']}
          style={styles.container}
        >
          {/* Header with call type */}
          <View style={styles.header}>
            <Ionicons
              name={outgoingCall.call_type === 'video' && !RTCView ? 'videocam' : 'call'}
              size={32}
              color={colors.primary}
              style={styles.callIcon}
            />
            <Text style={[styles.callTypeLabel, { color: colors.text }]}>
              {outgoingCall.call_type === 'video' && !RTCView ? 'Video Call' : 'Voice Call'}
            </Text>
            {outgoingCall.call_type === 'video' && !RTCView && (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                (Use development build for video)
              </Text>
            )}
          </View>

          {/* Recipient info */}
          <View style={styles.recipientInfo}>
            <Animated.View
              style={[
                styles.avatar,
                { backgroundColor: colors.primary + '30' },
                isActive ? {} : { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {(outgoingCall.receiver.username || '?').charAt(0).toUpperCase()}
              </Text>
            </Animated.View>
            <Text style={[styles.recipientName, { color: colors.text }]}>
              {outgoingCall.receiver.username}
            </Text>
            <Text style={[styles.callStatus, { color: colors.textSecondary }]}>
              {isActive ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : 'Calling...'}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            {/* End call button */}
            <TouchableOpacity
              style={[styles.button, styles.endButton]}
              onPress={handleEndCall}
              activeOpacity={0.7}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="close" size={28} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 40,
  },
  videoFeed: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  videoHeader: {
    alignItems: 'center',
    marginTop: 60,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
  },
  callIcon: {
    marginBottom: 12,
  },
  callTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 6,
  },
  recipientInfo: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  recipientName: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 8,
  },
  callStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  videoActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 60,
    zIndex: 10,
  },
  button: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endButton: {
    backgroundColor: '#DC2626',
  },
  buttonContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
