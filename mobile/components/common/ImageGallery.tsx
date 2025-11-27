import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  PanResponder,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { resolveRemoteUrl } from '../../utils/url';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ImageGalleryProps {
  visible: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  title?: string;
  caption?: string;
  timestamp?: string;
  actionButton?: {
    label: string;
    onPress: () => void;
  };
  onIndexChange?: (index: number) => void;
}

export default function ImageGallery({
  visible,
  onClose,
  images,
  initialIndex = 0,
  title,
  caption,
  timestamp,
  actionButton,
  onIndexChange,
}: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible && images.length > 0) {
      const index = Math.max(0, Math.min(initialIndex, images.length - 1));
      setCurrentIndex(index);
      onIndexChange?.(index);
      // Scroll to the initial index when modal opens
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: index * SCREEN_WIDTH,
          animated: false,
        });
      }, 50);
    }
  }, [visible, initialIndex, images.length, onIndexChange]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      onIndexChange?.(newIndex);
      scrollViewRef.current?.scrollTo({
        x: newIndex * SCREEN_WIDTH,
        animated: true,
      });
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      onIndexChange?.(newIndex);
      scrollViewRef.current?.scrollTo({
        x: newIndex * SCREEN_WIDTH,
        animated: true,
      });
    }
  };

  const handleSelect = (index: number) => {
    setCurrentIndex(index);
    onIndexChange?.(index);
    scrollViewRef.current?.scrollTo({
      x: index * SCREEN_WIDTH,
      animated: true,
    });
  };

  if (!visible || images.length === 0) return null;

  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;
  const canGoPrev = hasMultiple && currentIndex > 0;
  const canGoNext = hasMultiple && currentIndex < images.length - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Image Container */}
        <View style={styles.imageContainer}>
          {/* Previous Button */}
          {hasMultiple && (
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.navButtonLeft,
                !canGoPrev && styles.navButtonDisabled,
              ]}
              onPress={handlePrevious}
              disabled={!canGoPrev}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={canGoPrev ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)'}
              />
            </TouchableOpacity>
          )}

          {/* Image ScrollView */}
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setCurrentIndex(index);
              onIndexChange?.(index);
            }}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
          >
            {images.map((imageUrl, index) => {
              const resolvedUrl = resolveRemoteUrl(imageUrl);
              if (!resolvedUrl) return null;
              return (
                <View key={index} style={styles.imageWrapper}>
                  <Image
                    source={{ uri: resolvedUrl }}
                    style={styles.image}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={200}
                  />
                </View>
              );
            })}
          </ScrollView>

          {/* Next Button */}
          {hasMultiple && (
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.navButtonRight,
                !canGoNext && styles.navButtonDisabled,
              ]}
              onPress={handleNext}
              disabled={!canGoNext}
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={canGoNext ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)'}
              />
            </TouchableOpacity>
          )}

          {/* Close Button with Golden Fill */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <View style={styles.closeButtonInner}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Info Section with Liberty Social Theme - Always show */}
        <LinearGradient
          colors={['#A31717', '#6E0E0E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.infoContainer}
        >
          <View style={styles.infoContent}>
            {/* Action Button - Prioritized */}
            {actionButton && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={actionButton.onPress}
                activeOpacity={0.8}
              >
                <Text style={styles.actionButtonText}>{actionButton.label}</Text>
              </TouchableOpacity>
            )}

            {/* Title and Timestamp - Only show if no action button or if explicitly needed */}
            {!actionButton && (title || timestamp) && (
              <View style={styles.titleSection}>
                {title && (
                  <Text style={styles.titleText}>{title}</Text>
                )}
                {timestamp && (
                  <Text style={styles.timestampText}>
                    {new Date(timestamp).toLocaleString()}
                  </Text>
                )}
              </View>
            )}

            {/* Caption - Only show if no action button */}
            {!actionButton && caption && (
              <Text style={styles.captionText}>{caption}</Text>
            )}

            {/* Image Indicators */}
            {hasMultiple && (
              <View style={styles.indicatorsContainer}>
                {images.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.indicator,
                      index === currentIndex && styles.indicatorActive,
                    ]}
                    onPress={() => handleSelect(index)}
                  />
                ))}
              </View>
            )}

            {/* Image Counter */}
            {hasMultiple && (
              <Text style={styles.counterText}>
                {currentIndex + 1} of {images.length}
              </Text>
            )}
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  navButtonLeft: {
    left: 16,
  },
  navButtonRight: {
    right: 16,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 10,
  },
  closeButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#C8A25F', // Golden fill
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#C8A25F',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  infoContainer: {
    borderTopWidth: 2,
    borderTopColor: '#C8A25F', // Golden border
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
    maxHeight: 140,
  },
  infoContent: {
    alignItems: 'center',
  },
  titleSection: {
    marginBottom: 12,
    alignItems: 'center',
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  timestampText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  captionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  indicatorsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  indicatorActive: {
    width: 32,
    backgroundColor: '#C8A25F', // Golden
  },
  counterText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  actionButton: {
    marginTop: 0,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#192A4A',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#C8A25F',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    width: '100%',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

