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
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { useCall } from '../../contexts/CallContext';
import { resolveRemoteUrl } from '../../utils/url';

let InCallManager: any = null;
try {
  InCallManager = require('react-native-incall-manager');
} catch (error) {
  // Optional in unsupported builds.
}

const { width, height } = Dimensions.get('window');

export function IncomingCallModal() {
  const { colors, isDark } = useTheme();
  const { incomingCall, answerCall, rejectCall } = useCall();

  // Vibrate when incoming call arrives
  useEffect(() => {
    let mounted = true;
    let fallbackSound: Audio.Sound | null = null;

    const stopFallbackRingtone = async () => {
      if (!fallbackSound) return;
      try {
        await fallbackSound.stopAsync();
      } catch {}
      try {
        await fallbackSound.unloadAsync();
      } catch {}
      fallbackSound = null;
    };

    const startFallbackRingtone = async () => {
      try {
        // Ensure app can play alert audio while in the foreground.
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/sounds/ringtone.wav'),
          {
            shouldPlay: true,
            isLooping: true,
            volume: 1.0,
          }
        );
        if (!mounted) {
          try {
            await sound.unloadAsync();
          } catch {}
          return;
        }
        fallbackSound = sound;
      } catch (error) {
        // Best effort fallback.
      }
    };

    if (incomingCall) {
      // Pattern: vibrate for 300ms, pause 100ms, vibrate for 300ms (repeat)
      Vibration.vibrate([300, 100, 300], true);
      try {
        InCallManager?.start?.({ media: 'audio', auto: true, ringback: '' });
        InCallManager?.setForceSpeakerphoneOn?.(true);
        InCallManager?.setSpeakerphoneOn?.(true);
        if (Platform.OS === 'android') {
          // Android: explicitly request default ringtone + repeat vibration.
          InCallManager?.startRingtone?.('_DEFAULT_', [0, 700, 300], undefined, 30);
        } else {
          InCallManager?.startRingtone?.('_DEFAULT_');
        }
      } catch (error) {
        // Best effort.
      }
      startFallbackRingtone();
    } else {
      Vibration.cancel();
      try {
        InCallManager?.stopRingtone?.();
        InCallManager?.stop?.();
      } catch (error) {
        // Best effort.
      }
      stopFallbackRingtone();
    }

    return () => {
      mounted = false;
      Vibration.cancel();
      try {
        InCallManager?.stopRingtone?.();
        InCallManager?.stop?.();
      } catch (error) {
        // Best effort.
      }
      stopFallbackRingtone();
    };
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
  const callerAvatar = resolveRemoteUrl(incomingCall.caller.profile_image_url);

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
            {callerAvatar ? (
              <Image source={{ uri: callerAvatar }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {(incomingCall.caller.username || '?').charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={[styles.callerName, { color: colors.text }]}>
            {incomingCall.caller.username}
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
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
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
