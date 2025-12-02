import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface FeedFilterModalProps {
  visible: boolean;
  onClose: () => void;
  currentShowFriendPosts: boolean;
  currentShowPagePosts: boolean;
  currentSelectedCategory?: string;
  onFiltersChange: (filters: {
    showFriendPosts: boolean;
    showPagePosts: boolean;
    selectedCategory?: string;
  }) => void;
}

const CATEGORIES = [
  { value: 'technology', label: 'Technology', emoji: '💻' },
  { value: 'sports', label: 'Sports', emoji: '⚽' },
  { value: 'entertainment', label: 'Entertainment', emoji: '🎬' },
  { value: 'news', label: 'News', emoji: '📰' },
  { value: 'gaming', label: 'Gaming', emoji: '🎮' },
  { value: 'food', label: 'Food', emoji: '🍔' },
  { value: 'travel', label: 'Travel', emoji: '✈️' },
  { value: 'music', label: 'Music', emoji: '🎵' },
  { value: 'art', label: 'Art', emoji: '🎨' },
  { value: 'fitness', label: 'Fitness', emoji: '💪' },
  { value: 'fashion', label: 'Fashion', emoji: '👗' },
  { value: 'business', label: 'Business', emoji: '💼' },
];

export default function FeedFilterModal({
  visible,
  onClose,
  currentShowFriendPosts,
  currentShowPagePosts,
  currentSelectedCategory,
  onFiltersChange,
}: FeedFilterModalProps) {
  const { colors } = useTheme();
  const [friendPostsActive, setFriendPostsActive] = useState(false);
  const [pagePostsActive, setPagePostsActive] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  // Sync with current filter state when modal opens
  React.useEffect(() => {
    if (visible) {
      // Determine which button should be active based on current state
      if (!currentShowFriendPosts && currentShowPagePosts) {
        setFriendPostsActive(false);
        setPagePostsActive(true);
      } else if (currentShowFriendPosts && !currentShowPagePosts) {
        setFriendPostsActive(true);
        setPagePostsActive(false);
      } else {
        setFriendPostsActive(false);
        setPagePostsActive(false);
      }
      
      // Set selected category
      if (currentSelectedCategory) {
        setSelectedCategories(new Set([currentSelectedCategory]));
      } else {
        setSelectedCategories(new Set());
      }
    }
  }, [visible, currentShowFriendPosts, currentShowPagePosts, currentSelectedCategory]);

  const toggleFriendPosts = () => {
    if (friendPostsActive) {
      setFriendPostsActive(false);
      setPagePostsActive(false);
    } else {
      setFriendPostsActive(true);
      setPagePostsActive(false);
    }
  };

  const togglePagePosts = () => {
    if (pagePostsActive) {
      setFriendPostsActive(false);
      setPagePostsActive(false);
    } else {
      setFriendPostsActive(false);
      setPagePostsActive(true);
    }
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleApply = () => {
    const selectedArray = Array.from(selectedCategories);
    const showFriendPosts = friendPostsActive || (!friendPostsActive && !pagePostsActive);
    const showPagePosts = pagePostsActive || (!friendPostsActive && !pagePostsActive);
    
    onFiltersChange({
      showFriendPosts,
      showPagePosts,
      selectedCategory: selectedArray.length > 0 ? selectedArray.join(',') : undefined,
    });
    onClose();
  };

  const handleReset = () => {
    setFriendPostsActive(false);
    setPagePostsActive(false);
    setSelectedCategories(new Set());
    onFiltersChange({
      showFriendPosts: true,
      showPagePosts: true,
      selectedCategory: undefined,
    });
    onClose();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      width: '100%',
      maxHeight: Dimensions.get('window').height * 0.75,
      backgroundColor: '#192A4A',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 3,
      borderColor: '#C8A25F',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(200, 162, 95, 0.3)',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#C8A25F',
    },
    closeButton: {
      padding: 8,
    },
    content: {
      padding: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#C8A25F',
      marginBottom: 12,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 12,
    },
    filterButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: '#A0A0A0',
      backgroundColor: 'transparent',
    },
    filterButtonActive: {
      borderColor: '#C8A25F',
      backgroundColor: 'rgba(200, 162, 95, 0.15)',
      shadowColor: '#C8A25F',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    filterText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#A0A0A0',
    },
    filterTextActive: {
      color: '#C8A25F',
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    categoryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: '#A0A0A0',
      backgroundColor: 'transparent',
    },
    categoryButtonActive: {
      borderColor: '#C8A25F',
      backgroundColor: 'rgba(200, 162, 95, 0.15)',
      shadowColor: '#C8A25F',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    categoryEmoji: {
      fontSize: 16,
    },
    categoryText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#A0A0A0',
    },
    categoryTextActive: {
      color: '#C8A25F',
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
    },
    resetButton: {
      backgroundColor: 'transparent',
      borderColor: '#A0A0A0',
    },
    applyButton: {
      backgroundColor: '#C8A25F',
      borderColor: '#C8A25F',
      shadowColor: '#C8A25F',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 6,
    },
    resetButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#A0A0A0',
    },
    applyButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#192A4A',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Filter Posts</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={{ color: '#C8A25F', fontSize: 28 }}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Post Type Filters */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Post Type</Text>
              <View style={styles.filterRow}>
                <TouchableOpacity
                  onPress={toggleFriendPosts}
                  style={[
                    styles.filterButton,
                    friendPostsActive && styles.filterButtonActive,
                  ]}
                >
                  <Text style={styles.categoryEmoji}>👥</Text>
                  <Text
                    style={[
                      styles.filterText,
                      friendPostsActive && styles.filterTextActive,
                    ]}
                  >
                    Friends
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={togglePagePosts}
                  style={[
                    styles.filterButton,
                    pagePostsActive && styles.filterButtonActive,
                  ]}
                >
                  <Text style={styles.categoryEmoji}>📄</Text>
                  <Text
                    style={[
                      styles.filterText,
                      pagePostsActive && styles.filterTextActive,
                    ]}
                  >
                    Pages
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Category Filters */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Categories</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.value}
                    onPress={() => toggleCategory(category.value)}
                    style={[
                      styles.categoryButton,
                      selectedCategories.has(category.value) &&
                        styles.categoryButtonActive,
                    ]}
                  >
                    <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                    <Text
                      style={[
                        styles.categoryText,
                        selectedCategories.has(category.value) &&
                          styles.categoryTextActive,
                      ]}
                    >
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={handleReset}
              style={[styles.actionButton, styles.resetButton]}
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleApply}
              style={[styles.actionButton, styles.applyButton]}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
