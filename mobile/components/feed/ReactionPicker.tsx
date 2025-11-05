import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import type { ReactionType } from '../../types';

const REACTION_TYPES: ReactionType[] = ['like', 'love', 'haha', 'sad', 'angry'];

const REACTION_EMOJIS: Record<ReactionType, string> = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  sad: '😢',
  angry: '😡',
};

const REACTION_LABELS: Record<ReactionType, string> = {
  like: 'Like',
  love: 'Love',
  haha: 'Haha',
  sad: 'Sad',
  angry: 'Angry',
};

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (reactionType: ReactionType) => void;
  currentReaction?: ReactionType | null;
  position?: { x: number; y: number };
}

export default function ReactionPicker({
  visible,
  onClose,
  onSelect,
  currentReaction,
  position,
}: ReactionPickerProps) {
  const { colors, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 15,
          stiffness: 200,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 15,
          stiffness: 200,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim]);

  const handleSelect = (reactionType: ReactionType) => {
    onSelect(reactionType);
    onClose();
  };

  // Calculate position to center picker on button and keep it within screen bounds
  const getPickerPosition = () => {
    if (!position) return { left: '50%', top: 100 };
    
    const screenWidth = Dimensions.get('window').width;
    const pickerWidth = 240;
    const halfPickerWidth = pickerWidth / 2;
    
    // Center picker on button, but keep it within screen bounds
    let left = position.x - halfPickerWidth;
    left = Math.max(16, Math.min(left, screenWidth - pickerWidth - 16));
    
    return {
      left,
      top: position.y - 60, // Position above the button
    };
  };

  const pickerPos = getPickerPosition();

  const styles = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    pickerContainer: {
      position: 'absolute',
      top: pickerPos.top,
      left: typeof pickerPos.left === 'number' ? pickerPos.left : '50%',
      width: 240,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderRadius: 28,
      paddingHorizontal: 8,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      shadowColor: '#000000',
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    reactionButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    reactionButtonActive: {
      backgroundColor: isDark ? 'rgba(79, 142, 247, 0.2)' : 'rgba(79, 142, 247, 0.1)',
    },
    reactionEmoji: {
      fontSize: 28,
    },
    reactionLabel: {
      position: 'absolute',
      bottom: -24,
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      overflow: 'hidden',
    },
  });

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <Animated.View
            style={[
              styles.pickerContainer,
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
          >
            {REACTION_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.reactionButton,
                  currentReaction === type && styles.reactionButtonActive,
                ]}
                onPress={() => handleSelect(type)}
                activeOpacity={0.7}
              >
                <Text style={styles.reactionEmoji}>{REACTION_EMOJIS[type]}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
