import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface ContextMenuOption {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

interface ContextMenuProps {
  visible: boolean;
  onClose: () => void;
  options: ContextMenuOption[];
  anchor?: { x: number; y: number };
}

export default function ContextMenu({ visible, onClose, options, anchor }: ContextMenuProps) {
  const { colors, isDark } = useTheme();

  if (!visible || options.length === 0) return null;

  const dynamicStyles = StyleSheet.create({
    modalContent: {
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderColor: colors.border,
    },
    optionText: {
      color: colors.text,
    },
    optionTextDestructive: {
      color: '#EF4444',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.menu,
                dynamicStyles.modalContent,
                anchor && {
                  position: 'absolute',
                  top: anchor.y,
                  right: 16,
                },
              ]}
            >
              {options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.option,
                    index < options.length - 1 && styles.optionBorder,
                    { borderColor: colors.border },
                  ]}
                  onPress={() => {
                    option.onPress();
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={option.icon}
                    size={20}
                    color={option.destructive ? '#EF4444' : colors.text}
                  />
                  <Text
                    style={[
                      styles.optionText,
                      dynamicStyles.optionText,
                      option.destructive && dynamicStyles.optionTextDestructive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  menu: {
    minWidth: 180,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    paddingVertical: 4,
    marginTop: 60,
    marginRight: 16,
    alignSelf: 'flex-end',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  optionBorder: {
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
});

