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
import { Image } from 'expo-image';
import { useTheme } from '../../contexts/ThemeContext';
import type { FeedBackgroundType } from '../../hooks/useFeedBackground';

interface FeedBackgroundModalProps {
  visible: boolean;
  onClose: () => void;
  currentTheme: FeedBackgroundType;
  onThemeChange: (theme: FeedBackgroundType) => void;
}

const THEMES = [
  { id: 'default' as const, name: 'Default', emoji: '🎨', description: 'Clean default background' },
  { id: 'american' as const, name: 'American', emoji: '🇺🇸', description: 'Patriotic stars and stripes' },
  { id: 'christmas' as const, name: 'Christmas', emoji: '🎄', description: 'Festive holiday cheer' },
  { id: 'halloween' as const, name: 'Halloween', emoji: '🎃', description: 'Spooky orange and black' },
  { id: 'clouds' as const, name: 'Clouds', emoji: '☁️', description: 'Soft floating clouds' },
  { id: 'nature' as const, name: 'Nature', emoji: '🌿', description: 'Natural greenery' },
  { id: 'space' as const, name: 'Space', emoji: '🚀', description: 'Cosmic stars and planets' },
  { id: 'ocean' as const, name: 'Ocean', emoji: '🌊', description: 'Calming ocean waves' },
  { id: 'forest' as const, name: 'Forest', emoji: '🌲', description: 'Woodland trees' },
  { id: 'sunset' as const, name: 'Sunset', emoji: '🌅', description: 'Warm sunset colors' },
  { id: 'stars' as const, name: 'Stars', emoji: '⭐', description: 'Twinkling night sky' },
  { id: 'butterflies' as const, name: 'Butterflies', emoji: '🦋', description: 'Pastel butterfly textile print' },
  { id: 'dragons' as const, name: 'Dragons', emoji: '🐉', description: 'Mythic dragon silhouettes' },
  { id: 'christmas-trees' as const, name: 'Mini Trees', emoji: '🎄', description: 'Retro tree textile pattern' },
  { id: 'music-notes' as const, name: 'Music Notes', emoji: '🎶', description: 'Purple synthwave notes' },
  { id: 'pixel-hearts' as const, name: 'Pixel Hearts', emoji: '💖', description: 'Retro pixel-heart grid' },
];

const IMAGE_BACKGROUNDS = [
  { name: 'American Flag', file: require('../../assets/backgrounds/american-flag.gif'), path: '/backgrounds/american-flag.gif' },
  { name: 'Nyan Cat', file: require('../../assets/backgrounds/nyan-cat.gif'), path: '/backgrounds/nyan-cat.gif' },
  { name: 'Christmas Tree', file: require('../../assets/backgrounds/christmas-tree.gif'), path: '/backgrounds/christmas-tree.gif' },
  { name: 'Sunset', file: require('../../assets/backgrounds/sunset.gif'), path: '/backgrounds/sunset.gif' },
  { name: 'Shooting Star', file: require('../../assets/backgrounds/shooting-star.gif'), path: '/backgrounds/shooting-star.gif' },
  { name: 'Minions Dance', file: require('../../assets/backgrounds/minions-dance.gif'), path: '/backgrounds/minions-dance.gif' },
  { name: 'Frog Sunset', file: require('../../assets/backgrounds/frog-chilling-under-sunset.gif'), path: '/backgrounds/frog-chilling-under-sunset.gif' },
  { name: 'Cat Lanterns', file: require('../../assets/backgrounds/cat-lanterns.gif'), path: '/backgrounds/cat-lanterns.gif' },
  { name: 'Ghost', file: require('../../assets/backgrounds/ghost.gif'), path: '/backgrounds/ghost.gif' },
  { name: 'Dark Stars', file: require('../../assets/backgrounds/dark-stars.png'), path: '/backgrounds/dark-stars.png' },
  { name: 'Cat Eyes', file: require('../../assets/backgrounds/cat-eyes.png'), path: '/backgrounds/cat-eyes.png' },
  { name: 'Spider Webs', file: require('../../assets/backgrounds/spider-webs.png'), path: '/backgrounds/spider-webs.png' },
  { name: 'Spider', file: require('../../assets/backgrounds/spider.png'), path: '/backgrounds/spider.png' },
  { name: 'Gothic Skulls', file: require('../../assets/backgrounds/gothic-skulls.jpeg'), path: '/backgrounds/gothic-skulls.jpeg' },
  { name: 'Dragon Myth', file: require('../../assets/backgrounds/dragon-chinese-myth.jpeg'), path: '/backgrounds/dragon-chinese-myth.jpeg' },
  { name: 'Flame Hashira', file: require('../../assets/backgrounds/demon-slayer-flame-hashira.jpeg'), path: '/backgrounds/demon-slayer-flame-hashira.jpeg' },
  { name: 'Nyan Purple', file: require('../../assets/backgrounds/nyan-cat-purple.jpeg'), path: '/backgrounds/nyan-cat-purple.jpeg' },
  { name: 'Green Lightning', file: require('../../assets/backgrounds/green-lightning.jpeg'), path: '/backgrounds/green-lightning.jpeg' },
  { name: 'Bat Sign', file: require('../../assets/backgrounds/bat-sign.png'), path: '/backgrounds/bat-sign.png' },
  { name: 'Emojis', file: require('../../assets/backgrounds/emojis.png'), path: '/backgrounds/emojis.png' },
  { name: 'Green Corridor', file: require('../../assets/backgrounds/green-corridor.png'), path: '/backgrounds/green-corridor.png' },
  { name: 'Illusion', file: require('../../assets/backgrounds/illusion.png'), path: '/backgrounds/illusion.png' },
  { name: 'Kaleidoscope', file: require('../../assets/backgrounds/kaleidoscope.png'), path: '/backgrounds/kaleidoscope.png' },
];

export default function FeedBackgroundModal({
  visible,
  onClose,
  currentTheme,
  onThemeChange,
}: FeedBackgroundModalProps) {
  const { colors } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<FeedBackgroundType>(currentTheme);

  const handleSelect = (theme: FeedBackgroundType) => {
    setSelectedTheme(theme);
    onThemeChange(theme);
    onClose();
  };

  // Calculate responsive columns based on device width
  const screenWidth = Dimensions.get('window').width;
  const numColumns = screenWidth >= 768 ? 4 : 3;
  // Modal width = screenWidth - 32 (margin), content padding = 16 (left) + 16 (right)
  // Gap = 8px between items (using marginRight/marginBottom instead of gap for better compatibility)
  const modalWidth = screenWidth - 32;
  const contentPadding = 32; // 16 left + 16 right
  const gap = 8;
  const totalGaps = gap * (numColumns - 1);
  const itemWidth = Math.floor((modalWidth - contentPadding - totalGaps) / numColumns);

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      width: Dimensions.get('window').width - 32,
      maxHeight: Dimensions.get('window').height - 100,
      backgroundColor: '#192A4A',
      borderRadius: 16,
      borderWidth: 2,
      borderColor: '#C8A25F',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#C8A25F',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#C8A25F',
    },
    closeButton: {
      padding: 8,
    },
    content: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: 12,
    },
    themeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 16,
    },
    themeButton: {
      width: itemWidth,
      aspectRatio: 1,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
      marginBottom: 8,
    },
    themeButtonActive: {
      borderColor: '#C8A25F',
      backgroundColor: 'rgba(200, 162, 95, 0.2)',
    },
    themeEmoji: {
      fontSize: 32,
    },
    themeName: {
      fontSize: 12,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.7)',
      textAlign: 'center',
    },
    themeNameActive: {
      color: '#C8A25F',
    },
    imageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    imageButton: {
      width: itemWidth,
      aspectRatio: 1,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      overflow: 'hidden',
      marginRight: 8,
      marginBottom: 8,
    },
    imageButtonActive: {
      borderColor: '#C8A25F',
      borderWidth: 3,
    },
    backgroundImage: {
      width: '100%',
      height: '100%',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Choose Feed Background</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={{ color: '#C8A25F', fontSize: 24 }}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* CSS Theme Grid */}
            <Text style={styles.sectionTitle}>Themed Backgrounds</Text>
            <View style={styles.themeGrid}>
              {THEMES.map((theme) => (
                <TouchableOpacity
                  key={theme.id}
                  onPress={() => handleSelect(theme.id)}
                  style={[
                    styles.themeButton,
                    selectedTheme === theme.id && styles.themeButtonActive,
                  ]}
                >
                  <Text style={styles.themeEmoji}>{theme.emoji}</Text>
                  <Text
                    style={[
                      styles.themeName,
                      selectedTheme === theme.id && styles.themeNameActive,
                    ]}
                  >
                    {theme.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Image Backgrounds */}
            <Text style={styles.sectionTitle}>Image Backgrounds</Text>
            <View style={styles.imageGrid}>
              {IMAGE_BACKGROUNDS.map((bg, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleSelect(bg.path)}
                  style={[
                    styles.imageButton,
                    selectedTheme === bg.path && styles.imageButtonActive,
                  ]}
                >
                  <Image
                    source={bg.file}
                    style={styles.backgroundImage}
                    contentFit="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
