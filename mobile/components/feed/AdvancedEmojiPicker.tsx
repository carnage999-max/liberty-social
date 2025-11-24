import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { EMOJI_CATEGORIES, COMMON_REACTION_EMOJIS } from '../../constants/emoji-data';

interface AdvancedEmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  currentReaction?: string | null;
  recentEmojis?: string[];
  favoriteEmojis?: string[];
  onToggleFavorite?: (emoji: string) => void;
}

type TabType = 'recent' | 'favorite' | 'all' | number;

export default function AdvancedEmojiPicker({
  visible,
  onClose,
  onSelect,
  currentReaction,
  recentEmojis = [],
  favoriteEmojis = [],
  onToggleFavorite,
}: AdvancedEmojiPickerProps) {
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('recent');
  const [searchQuery, setSearchQuery] = useState('');

  const screenHeight = Dimensions.get('window').height;
  const modalHeight = screenHeight * 0.7;

  // Get all emojis flattened
  const allEmojis = useMemo(() => {
    return EMOJI_CATEGORIES.flatMap((category) => category.emojis);
  }, []);

  // Filter emojis based on search (simple implementation)
  const filteredEmojis = useMemo(() => {
    if (!searchQuery.trim()) return [];
    // In a real implementation, you'd have emoji names/keywords for better search
    return allEmojis;
  }, [searchQuery, allEmojis]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    onSelect(emoji);
    onClose();
  }, [onSelect, onClose]);

  // Render individual emoji button
  const renderEmoji = useCallback(({ item: emoji }: { item: string }) => {
    const isFavorite = favoriteEmojis.includes(emoji);
    const isSelected = emoji === currentReaction;

    return (
      <TouchableOpacity
        style={[
          styles.emojiButton,
          isSelected && { backgroundColor: isDark ? 'rgba(79, 142, 247, 0.2)' : 'rgba(79, 142, 247, 0.1)' },
        ]}
        onPress={() => handleEmojiSelect(emoji)}
        activeOpacity={0.7}
      >
        <Text style={styles.emojiText}>{emoji}</Text>
        {isFavorite && (
          <View style={styles.favoriteBadge}>
            <Text style={styles.favoriteBadgeText}>⭐</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [currentReaction, favoriteEmojis, handleEmojiSelect, isDark]);

  // Tab navigation
  const tabs = [
    { id: 'recent' as const, label: 'Recent', icon: 'time-outline' as const },
    { id: 'favorite' as const, label: 'Favorites', icon: 'star-outline' as const },
    { id: 'all' as const, label: 'All', icon: 'apps-outline' as const },
  ];

  const renderContent = () => {
    // Search results
    if (searchQuery.trim()) {
      return (
        <FlatList
          data={filteredEmojis}
          renderItem={renderEmoji}
          keyExtractor={(item, index) => `search-${item}-${index}`}
          numColumns={8}
          contentContainerStyle={styles.emojiGrid}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    // Recent emojis
    if (activeTab === 'recent') {
      if (recentEmojis.length === 0) {
        return (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No recent emojis yet
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Start reacting to see them here!
            </Text>
          </View>
        );
      }

      return (
        <FlatList
          data={recentEmojis}
          renderItem={renderEmoji}
          keyExtractor={(item, index) => `recent-${item}-${index}`}
          numColumns={8}
          contentContainerStyle={styles.emojiGrid}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    // Favorite emojis
    if (activeTab === 'favorite') {
      if (favoriteEmojis.length === 0) {
        return (
          <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No favorite emojis yet
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Long press an emoji to favorite it!
            </Text>
          </View>
        );
      }

      return (
        <FlatList
          data={favoriteEmojis}
          renderItem={renderEmoji}
          keyExtractor={(item, index) => `favorite-${item}-${index}`}
          numColumns={8}
          contentContainerStyle={styles.emojiGrid}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    // All emojis by category
    if (activeTab === 'all') {
      return (
        <FlatList
          data={allEmojis}
          renderItem={renderEmoji}
          keyExtractor={(item, index) => `all-${item}-${index}`}
          numColumns={8}
          contentContainerStyle={styles.emojiGrid}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    // Specific category
    if (typeof activeTab === 'number' && EMOJI_CATEGORIES[activeTab]) {
      return (
        <FlatList
          data={EMOJI_CATEGORIES[activeTab].emojis}
          renderItem={renderEmoji}
          keyExtractor={(item, index) => `category-${item}-${index}`}
          numColumns={8}
          contentContainerStyle={styles.emojiGrid}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    return null;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background, height: modalHeight }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Pick a reaction
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Search emojis..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Main Tabs */}
          <View style={styles.tabsContainer}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.tabButton,
                    {
                      borderColor: colors.border,
                      backgroundColor: isActive
                        ? (isDark ? colors.backgroundSecondary : '#E8F0FE')
                        : 'transparent',
                    },
                    isActive && { borderColor: '#4F8EF7' },
                  ]}
                  onPress={() => {
                    setActiveTab(tab.id);
                    setSearchQuery('');
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={tab.icon}
                    size={16}
                    color={isActive ? '#4F8EF7' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      { color: isActive ? '#4F8EF7' : colors.textSecondary },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Category Tabs (horizontal scroll) */}
          {(activeTab === 'all' || typeof activeTab === 'number') && !searchQuery && (
            <View style={styles.categoryTabsWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesContainer}
              >
                {EMOJI_CATEGORIES.map((category, index) => {
                  const isActive = typeof activeTab === 'number' && activeTab === index;
                  return (
                    <TouchableOpacity
                      key={category.name}
                      style={[
                        styles.categoryButton,
                        {
                          backgroundColor: isActive
                            ? '#4F8EF7'
                            : (isDark ? colors.backgroundSecondary : '#F5F5F5'),
                          borderColor: isActive ? '#4F8EF7' : colors.border,
                        },
                      ]}
                      onPress={() => setActiveTab(index)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          { color: isActive ? '#FFFFFF' : colors.text },
                        ]}
                      >
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Content Area */}
          <View style={styles.contentContainer}>
            {renderContent()}
          </View>

          {/* Quick Reactions Bar */}
          <View
            style={[
              styles.quickReactionsBar,
              {
                backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
                borderTopColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.quickReactionsLabel, { color: colors.textSecondary }]}>
              Quick reactions:
            </Text>
            <View style={styles.quickReactionsRow}>
              {COMMON_REACTION_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.quickReactionButton}
                  onPress={() => handleEmojiSelect(emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickReactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchIcon: {
    position: 'absolute',
    left: 32,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 40,
    fontSize: 14,
    borderWidth: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryTabsWrapper: {
    paddingBottom: 12,
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  emojiGrid: {
    padding: 12,
    paddingBottom: 20,
  },
  emojiButton: {
    width: '12.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    position: 'relative',
  },
  emojiText: {
    fontSize: 28,
  },
  favoriteBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBadgeText: {
    fontSize: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  quickReactionsBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  quickReactionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  quickReactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickReactionButton: {
    padding: 4,
  },
  quickReactionEmoji: {
    fontSize: 28,
  },
});
