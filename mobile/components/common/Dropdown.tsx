import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

export default function Dropdown({
  options,
  value,
  onSelect,
  placeholder = 'Select an option',
  label,
  required = false,
}: DropdownProps) {
  const { colors, isDark } = useTheme();
  const [visible, setVisible] = useState(false);

  const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = (optionValue: string) => {
    onSelect(optionValue);
    setVisible(false);
  };

  const styles = StyleSheet.create({
    container: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
      color: colors.text,
    },
    required: {
      color: '#FF4D4F',
    },
    dropdownButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      minHeight: 48,
    },
    dropdownText: {
      fontSize: 15,
      color: colors.text,
      flex: 1,
    },
    dropdownTextPlaceholder: {
      color: colors.textSecondary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
      paddingTop: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    optionItem: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    optionItemSelected: {
      backgroundColor: isDark ? 'rgba(200, 162, 95, 0.1)' : 'rgba(200, 162, 95, 0.1)',
    },
    optionText: {
      fontSize: 16,
      color: colors.text,
    },
    optionTextSelected: {
      color: '#C8A25F',
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
      )}
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          {selectedOption?.icon && (
            <Ionicons 
              name={selectedOption.icon as any} 
              size={20} 
              color={colors.textSecondary}
              style={{ marginRight: 8 }}
            />
          )}
          <Text
            style={[
              styles.dropdownText,
              !selectedOption && styles.dropdownTextPlaceholder,
            ]}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </Text>
        </View>
        <Ionicons
          name={visible ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {label || 'Select an option'}
                  </Text>
                  <TouchableOpacity onPress={() => setVisible(false)}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={options}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => {
                    const isSelected = item.value === value;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.optionItem,
                          isSelected && styles.optionItemSelected,
                        ]}
                        onPress={() => handleSelect(item.value)}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            {item.icon && (
                              <Ionicons 
                                name={item.icon as any} 
                                size={20} 
                                color={isSelected ? '#C8A25F' : colors.textSecondary}
                                style={{ marginRight: 12 }}
                              />
                            )}
                            <Text
                              style={[
                                styles.optionText,
                                isSelected && styles.optionTextSelected,
                              ]}
                            >
                              {item.label}
                            </Text>
                          </View>
                          {isSelected && (
                            <Ionicons name="checkmark" size={20} color="#C8A25F" />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

