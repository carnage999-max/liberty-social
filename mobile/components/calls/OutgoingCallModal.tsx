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

const { width, height } = Dimensions.get('window');

export function OutgoingCallModal() {
  const { colors, isDark } = useTheme();
  const { outgoingCall, endCall } = useCall();
  const [duration, setDuration] = useState(0);
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

  const handleEndCall = async () => {
    try {
      await endCall();
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  const callTypeIcon = outgoingCall.call_type === 'video' ? 'videocam' : 'call';
  const callTypeLabel = outgoingCall.call_type === 'video' ? 'Video Call' : 'Voice Call';
  const isActive = outgoingCall.status === 'active';

  return (
    <Modal
      visible={!!outgoingCall}
      transparent
      animationType="slide"
      hardwareAccelerated
    >
      <LinearGradient
        colors={['#1a1a1a', '#2a2a2a']}
        style={styles.container}
      >
        {/* Header with call type */}
        <View style={styles.header}>
          <Ionicons
            name={callTypeIcon}
            size={32}
            color={colors.primary}
            style={styles.callIcon}
          />
          <Text style={[styles.callTypeLabel, { color: colors.text }]}>
            {callTypeLabel}
          </Text>
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
              {outgoingCall.receiver_username.charAt(0).toUpperCase()}
            </Text>
          </Animated.View>
          <Text style={[styles.recipientName, { color: colors.text }]}>
            {outgoingCall.receiver_username}
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
