import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Image,
  StyleSheet,
  Dimensions,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { useCall } from '../../contexts/CallContext';

const { width, height } = Dimensions.get('window');

export function IncomingCallModal() {
  const { colors, isDark } = useTheme();
  const { incomingCall, answerCall, rejectCall } = useCall();

  // Vibrate when incoming call arrives
  useEffect(() => {
    if (incomingCall) {
      // Pattern: vibrate for 300ms, pause 100ms, vibrate for 300ms (repeat)
      Vibration.vibrate([300, 100, 300], true);
    } else {
      Vibration.cancel();
    }

    return () => Vibration.cancel();
  }, [incomingCall?.id]);

  if (!incomingCall) return null;

  const handleAnswer = async () => {
    try {
      await answerCall(incomingCall.id);
    } catch (error) {
      console.error('Error answering call:', error);
    }
  };

  const handleReject = async () => {
    try {
      await rejectCall(incomingCall.id);
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  };

  const callTypeIcon = incomingCall.call_type === 'video' ? 'videocam' : 'call';
  const callTypeLabel = incomingCall.call_type === 'video' ? 'Video Call' : 'Voice Call';

  return (
    <Modal
      visible={!!incomingCall}
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

        {/* Caller info */}
        <View style={styles.callerInfo}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.primary + '30' },
            ]}
          >
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {incomingCall.caller_username.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.callerName, { color: colors.text }]}>
            {incomingCall.caller_username}
          </Text>
          <Text style={[styles.callStatus, { color: colors.textSecondary }]}>
            Calling...
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {/* Reject button */}
          <TouchableOpacity
            style={[styles.button, styles.rejectButton]}
            onPress={handleReject}
            activeOpacity={0.7}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="close" size={28} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Answer button */}
          <TouchableOpacity
            style={[styles.button, styles.answerButton]}
            onPress={handleAnswer}
            activeOpacity={0.7}
          >
            <View style={styles.buttonContent}>
              <Ionicons
                name={incomingCall.call_type === 'video' ? 'videocam' : 'call'}
                size={28}
                color="#fff"
              />
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
  callerInfo: {
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
  callerName: {
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
    gap: 40,
    marginBottom: 20,
  },
  button: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#DC2626',
  },
  answerButton: {
    backgroundColor: '#16A34A',
  },
  buttonContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
