import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Easing,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import AppNavbar from '../../components/layout/AppNavbar';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ReelsScreen() {
  const { colors, isDark } = useTheme();
  const [animatedValue] = useState(new Animated.Value(0));
  const [rotation] = useState(new Animated.Value(0));
  const [scale] = useState(new Animated.Value(1));
  const [bounce] = useState(new Animated.Value(0));
  const [glow] = useState(new Animated.Value(0));
  const [sparkles] = useState(
    Array.from({ length: 20 }, () => ({
      translateX: new Animated.Value(Math.random() * SCREEN_WIDTH),
      translateY: new Animated.Value(Math.random() * SCREEN_HEIGHT),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  );

  useEffect(() => {
    // Continuous rotation animation
    const rotateAnimation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Pulse animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Bounce animation
    const bounceAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.bounce),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 800,
          easing: Easing.in(Easing.bounce),
          useNativeDriver: true,
        }),
      ])
    );

    // Glow animation
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );

    // Sparkle animations
    const sparkleAnimations = sparkles.map((sparkle, index) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(index * 200),
          Animated.parallel([
            Animated.timing(sparkle.opacity, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(sparkle.scale, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(sparkle.opacity, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(sparkle.scale, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(Math.random() * 2000),
        ])
      );
    });

    rotateAnimation.start();
    pulseAnimation.start();
    bounceAnimation.start();
    glowAnimation.start();
    sparkleAnimations.forEach(anim => anim.start());

    return () => {
      rotateAnimation.stop();
      pulseAnimation.stop();
      bounceAnimation.stop();
      glowAnimation.stop();
      sparkleAnimations.forEach(anim => anim.stop());
    };
  }, []);

  const rotationInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const bounceY = bounce.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppNavbar title="Reels" showProfileImage={false} />
      
      <View style={styles.content}>
        {/* Sparkles */}
        {sparkles.map((sparkle, index) => (
          <Animated.View
            key={index}
            style={[
              styles.sparkle,
              {
                opacity: sparkle.opacity,
                transform: [
                  { translateX: sparkle.translateX },
                  { translateY: sparkle.translateY },
                  { scale: sparkle.scale },
                ],
              },
            ]}
          >
            <Ionicons name="star" size={12} color="#C8A25F" />
          </Animated.View>
        ))}

        {/* Main Icon with animations */}
        <Animated.View
          style={[
            styles.iconContainer,
            {
              transform: [
                { rotate: rotationInterpolate },
                { scale: scale },
                { translateY: bounceY },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.glowCircle,
              {
                opacity: glowOpacity,
              },
            ]}
          />
          <LinearGradient
            colors={['#C8A25F', '#192A4A', '#1a2335']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientCircle}
          >
            <Ionicons name="film" size={80} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]}>
          Reels Coming Soon!
        </Text>

        {/* Subtitle */}
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Get ready for an amazing video experience
        </Text>

        {/* Features List */}
        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <Ionicons name="videocam" size={24} color="#C8A25F" />
            <Text style={[styles.featureText, { color: colors.text }]}>
              Short-form videos
            </Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="musical-notes" size={24} color="#C8A25F" />
            <Text style={[styles.featureText, { color: colors.text }]}>
              Music & Sound effects
            </Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="sparkles" size={24} color="#C8A25F" />
            <Text style={[styles.featureText, { color: colors.text }]}>
              Creative filters & effects
            </Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="share-social" size={24} color="#C8A25F" />
            <Text style={[styles.featureText, { color: colors.text }]}>
              Share with friends
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    paddingBottom: 100,
  },
  iconContainer: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  glowCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#C8A25F',
  },
  gradientCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#C8A25F',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 32,
  },
  featuresContainer: {
    width: '100%',
    maxWidth: 300,
    marginBottom: 60,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  featureText: {
    fontSize: 16,
    marginLeft: 16,
    fontWeight: '500',
  },
  sparkle: {
    position: 'absolute',
  },
});

