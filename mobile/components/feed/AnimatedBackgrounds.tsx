/**
 * Animated Feed Backgrounds
 * 
 * This component provides animated backgrounds for the feed using react-native-reanimated
 * to replicate the CSS animations from the frontend globals.css.
 * 
 * Available animated themes (ALL 16 themes):
 * - American: Twinkling stars with patriotic gradient
 * - Christmas: Falling snowflakes with festive colors  
 * - Halloween: Floating ghosts with spooky gradient
 * - Clouds: Drifting clouds across sky
 * - Nature: Falling and rotating leaves
 * - Space: Floating particles and twinkling stars
 * - Ocean: Animated wave layers
 * - Forest: Tall tree silhouettes with gradient
 * - Sunset: Warm gradient sunset colors
 * - Stars: Dense twinkling star field
 * - Butterflies: Floating butterflies with wave motion
 * - Dragons: Floating dragon emojis with pulsing effect
 * - Christmas Trees: Sliding pattern of tree emojis
 * - Music Notes: Sliding pattern of music note emojis
 * - Pixel Hearts: Sliding pattern of heart emojis
 * 
 * All backgrounds include a dark overlay gradient at the top for text visibility.
 * Animations run on UI thread for 60fps performance using react-native-reanimated.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text as RNText } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Polygon, Ellipse } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// American Theme - Twinkling Stars
export const AmericanBackground = () => {
  const stars = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * SCREEN_WIDTH,
    y: Math.random() * SCREEN_HEIGHT,
    size: Math.random() * 2 + 1,
    delay: Math.random() * 3000,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#0d1b3a', '#1a237e', '#b71c1c', '#0d47a1', '#1a237e']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Svg style={StyleSheet.absoluteFill}>
        {stars.map((star) => (
          <TwinklingStar key={star.id} {...star} />
        ))}
      </Svg>
      {/* Overlay gradient for text visibility */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.2)', 'transparent']}
        style={styles.topOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.3, 0.6]}
      />
    </View>
  );
};

const TwinklingStar = ({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 + delay, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1000 + delay, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y }, animatedStyle]}>
      <Svg width={size * 2} height={size * 2}>
        <Circle cx={size} cy={size} r={size} fill="rgba(255, 255, 255, 0.9)" />
      </Svg>
    </Animated.View>
  );
};

// Christmas Theme - Falling Snowflakes
export const ChristmasBackground = () => {
  const snowflakes = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * SCREEN_WIDTH,
    startY: -Math.random() * SCREEN_HEIGHT,
    size: Math.random() * 3 + 2,
    duration: Math.random() * 5000 + 8000,
    delay: Math.random() * 5000,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#0d2818', '#1b5e20', '#2e7d32', '#c62828', '#1b5e20', '#2e7d32']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {snowflakes.map((flake) => (
        <Snowflake key={flake.id} {...flake} />
      ))}
      {/* Overlay gradient for text visibility */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.2)', 'transparent']}
        style={styles.topOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.3, 0.6]}
      />
    </View>
  );
};

const Snowflake = ({ x, startY, size, duration, delay }: {
  x: number;
  startY: number;
  size: number;
  duration: number;
  delay: number;
}) => {
  const translateY = useSharedValue(startY);
  const translateX = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(SCREEN_HEIGHT + 50, { duration, easing: Easing.linear })
      ),
      -1,
      false
    );

    translateX.value = withRepeat(
      withSequence(
        withTiming(15, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(-15, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: 0 }, animatedStyle]}>
      <Svg width={size * 2} height={size * 2}>
        <Circle cx={size} cy={size} r={size} fill="rgba(255, 255, 255, 0.8)" />
      </Svg>
    </Animated.View>
  );
};

// Clouds Theme - Drifting Clouds
export const CloudsBackground = () => {
  const clouds = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    startX: -200 - Math.random() * 200,
    y: Math.random() * SCREEN_HEIGHT * 0.6,
    size: Math.random() * 80 + 100,
    duration: Math.random() * 20000 + 30000,
    delay: Math.random() * 10000,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#87ceeb', '#b0e0e6', '#e0f6ff', '#87ceeb', '#b0e0e6']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {clouds.map((cloud) => (
        <DriftingCloud key={cloud.id} {...cloud} />
      ))}
      {/* Overlay gradient for text visibility */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.15)', 'transparent']}
        style={styles.topOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.3, 0.6]}
      />
    </View>
  );
};

const DriftingCloud = ({ startX, y, size, duration, delay }: {
  startX: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}) => {
  const translateX = useSharedValue(startX);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Fade in at start
    opacity.value = withTiming(0.6, { duration: 2000 });

    // Move cloud across screen
    translateX.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(SCREEN_WIDTH + 200, { duration, easing: Easing.linear })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: y }, animatedStyle]}>
      <Svg width={size * 1.8} height={size}>
        {/* Simple cloud shape using ellipses */}
        <Circle cx={size * 0.3} cy={size * 0.6} r={size * 0.3} fill="rgba(255, 255, 255, 0.7)" />
        <Circle cx={size * 0.5} cy={size * 0.5} r={size * 0.35} fill="rgba(255, 255, 255, 0.7)" />
        <Circle cx={size * 0.7} cy={size * 0.55} r={size * 0.32} fill="rgba(255, 255, 255, 0.7)" />
        <Circle cx={size * 0.9} cy={size * 0.6} r={size * 0.28} fill="rgba(255, 255, 255, 0.7)" />
      </Svg>
    </Animated.View>
  );
};

// Space Theme - Floating Stars and Particles
export const SpaceBackground = () => {
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * SCREEN_WIDTH,
    y: Math.random() * SCREEN_HEIGHT,
    size: Math.random() * 1.5 + 0.5,
    duration: Math.random() * 3000 + 2000,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#1A237E', '#283593', '#3949AB']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Svg style={StyleSheet.absoluteFill}>
        {particles.map((particle) => (
          <TwinklingParticle key={particle.id} {...particle} />
        ))}
      </Svg>
      {/* Overlay gradient for text visibility */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.2)', 'transparent']}
        style={styles.topOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.3, 0.6]}
      />
    </View>
  );
};

const TwinklingParticle = ({ x, y, size, duration }: {
  x: number;
  y: number;
  size: number;
  duration: number;
}) => {
  const opacity = useSharedValue(0.2);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.2, { duration, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y }, animatedStyle]}>
      <Svg width={size * 2} height={size * 2}>
        <Circle cx={size} cy={size} r={size} fill="rgba(255, 255, 255, 0.9)" />
      </Svg>
    </Animated.View>
  );
};

// Halloween Theme - Floating Ghosts
export const HalloweenBackground = () => {
  const ghosts = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    startY: SCREEN_HEIGHT + Math.random() * 200,
    x: Math.random() * SCREEN_WIDTH,
    duration: Math.random() * 15000 + 20000,
    delay: Math.random() * 8000,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#FF6600', '#1A1A1A', '#FFA500']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {ghosts.map((ghost) => (
        <FloatingGhost key={ghost.id} {...ghost} />
      ))}
      {/* Overlay gradient for text visibility */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.5)', 'rgba(0, 0, 0, 0.25)', 'transparent']}
        style={styles.topOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.3, 0.6]}
      />
    </View>
  );
};

const FloatingGhost = ({ startY, x, duration, delay }: {
  startY: number;
  x: number;
  duration: number;
  delay: number;
}) => {
  const translateY = useSharedValue(startY);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(-SCREEN_HEIGHT - 100, { duration, easing: Easing.linear })
      ),
      -1,
      false
    );

    translateX.value = withRepeat(
      withSequence(
        withTiming(20, { duration: duration / 3, easing: Easing.inOut(Easing.ease) }),
        withTiming(-20, { duration: duration / 3, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: duration / 3, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: 0 }, animatedStyle]}>
      <Svg width={40} height={50}>
        {/* Simple ghost shape */}
        <Path
          d="M20 5 Q5 5 5 20 L5 40 L10 35 L15 40 L20 35 L25 40 L30 35 L35 40 L35 20 Q35 5 20 5"
          fill="rgba(255, 255, 255, 0.3)"
        />
        {/* Eyes */}
        <Circle cx={15} cy={18} r={2} fill="rgba(0, 0, 0, 0.6)" />
        <Circle cx={25} cy={18} r={2} fill="rgba(0, 0, 0, 0.6)" />
      </Svg>
    </Animated.View>
  );
};

// Ocean Theme - Animated Waves
export const OceanBackground = () => {
  const waves = Array.from({ length: 4 }, (_, i) => ({
    id: i,
    yOffset: i * 80,
    duration: 4000 + i * 1000,
    delay: i * 500,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#E1F5FE', '#B3E5FC', '#81D4FA']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {waves.map((wave) => (
        <WaveLayer key={wave.id} {...wave} />
      ))}
      {/* Overlay gradient for text visibility */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.15)', 'transparent']}
        style={styles.topOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.3, 0.6]}
      />
    </View>
  );
};

const WaveLayer = ({ yOffset, duration, delay }: {
  yOffset: number;
  duration: number;
  delay: number;
}) => {
  const translateX = useSharedValue(0);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(-SCREEN_WIDTH, { duration, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: yOffset,
          left: 0,
          width: SCREEN_WIDTH * 2,
          height: 60,
        },
        animatedStyle,
      ]}
    >
      <Svg width={SCREEN_WIDTH * 2} height={60}>
        <Path
          d={`M0 30 Q ${SCREEN_WIDTH / 4} 10, ${SCREEN_WIDTH / 2} 30 T ${SCREEN_WIDTH} 30 T ${SCREEN_WIDTH * 1.5} 30 T ${SCREEN_WIDTH * 2} 30 L ${SCREEN_WIDTH * 2} 60 L 0 60 Z`}
          fill={`rgba(255, 255, 255, ${0.3 - yOffset * 0.002})`}
        />
      </Svg>
    </Animated.View>
  );
};

// Nature Theme - Floating Leaves
export const NatureBackground = () => {
  const leaves = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    startX: Math.random() * SCREEN_WIDTH,
    startY: -Math.random() * 300,
    duration: Math.random() * 8000 + 12000,
    delay: Math.random() * 5000,
    rotation: Math.random() * 360,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#F1F8E9', '#DCEDC8', '#C5E1A5']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {leaves.map((leaf) => (
        <FallingLeaf key={leaf.id} {...leaf} />
      ))}
      {/* Overlay gradient for text visibility */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.15)', 'transparent']}
        style={styles.topOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.3, 0.6]}
      />
    </View>
  );
};

const FallingLeaf = ({ startX, startY, duration, delay, rotation: initialRotation }: {
  startX: number;
  startY: number;
  duration: number;
  delay: number;
  rotation: number;
}) => {
  const translateY = useSharedValue(startY);
  const translateX = useSharedValue(0);
  const rotation = useSharedValue(initialRotation);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(SCREEN_HEIGHT + 50, { duration, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    translateX.value = withRepeat(
      withSequence(
        withTiming(30, { duration: duration / 4, easing: Easing.inOut(Easing.ease) }),
        withTiming(-30, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: duration / 4, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    rotation.value = withRepeat(
      withTiming(initialRotation + 360, { duration, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: startX, top: 0 }, animatedStyle]}>
      <Svg width={20} height={25}>
        {/* Simple leaf shape */}
        <Path
          d="M10 0 Q15 8, 10 25 Q5 8, 10 0"
          fill="rgba(76, 175, 80, 0.6)"
        />
      </Svg>
    </Animated.View>
  );
};

// Forest Theme - Tall Trees
export const ForestBackground = () => {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#0d2818', '#1b4332', '#2d5016', '#40916c', '#1b4332']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Svg style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}>
        {/* Tall trees */}
        <Ellipse cx="5%" cy="20%" rx={30} ry={75} fill="rgba(27, 94, 32, 0.5)" />
        <Ellipse cx="20%" cy="55%" rx={28} ry={70} fill="rgba(27, 94, 32, 0.45)" />
        <Ellipse cx="75%" cy="30%" rx={33} ry={80} fill="rgba(27, 94, 32, 0.5)" />
        <Ellipse cx="90%" cy="70%" rx={29} ry={73} fill="rgba(27, 94, 32, 0.45)" />
        <Ellipse cx="50%" cy="10%" rx={31} ry={78} fill="rgba(27, 94, 32, 0.48)" />
        {/* Medium trees */}
        <Ellipse cx="12%" cy="65%" rx={20} ry={50} fill="rgba(46, 125, 50, 0.4)" />
        <Ellipse cx="35%" cy="80%" rx={19} ry={48} fill="rgba(46, 125, 50, 0.35)" />
        <Ellipse cx="68%" cy="75%" rx={21} ry={53} fill="rgba(46, 125, 50, 0.4)" />
      </Svg>
      {/* Overlay gradient for text visibility */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.2)', 'transparent']}
        style={styles.topOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.3, 0.6]}
      />
    </View>
  );
};

// Stars Theme - Twinkling Stars (more than Space)
export const StarsBackground = () => {
  const stars = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * SCREEN_WIDTH,
    y: Math.random() * SCREEN_HEIGHT,
    size: Math.random() * 1.5 + 0.5,
    delay: Math.random() * 3000,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#0f0c29', '#302b63', '#24243e', '#0f0c29', '#302b63']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Svg style={StyleSheet.absoluteFill}>
        {stars.map((star) => (
          <TwinklingStarSlow key={star.id} {...star} />
        ))}
      </Svg>
      {/* Overlay gradient for text visibility */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.2)', 'transparent']}
        style={styles.topOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.3, 0.6]}
      />
    </View>
  );
};

const TwinklingStarSlow = ({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) => {
  const opacity = useSharedValue(0.9);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1500 + delay, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.9, { duration: 1500 + delay, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y }, animatedStyle]}>
      <Svg width={size * 2} height={size * 2}>
        <Circle cx={size} cy={size} r={size} fill="rgba(255, 255, 255, 0.9)" />
      </Svg>
    </Animated.View>
  );
};

// Butterflies Theme - Floating Butterflies
export const ButterfliesBackground = () => {
  const butterflies = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    startX: Math.random() * SCREEN_WIDTH,
    y: Math.random() * SCREEN_HEIGHT * 0.8,
    duration: Math.random() * 15000 + 25000,
    delay: Math.random() * 8000,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#0d2419', '#143b2a', '#1f5b3f']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {butterflies.map((butterfly) => (
        <FloatingButterfly key={butterfly.id} {...butterfly} />
      ))}
      {/* Overlay gradient for text visibility */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.2)', 'transparent']}
        style={styles.topOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.3, 0.6]}
      />
    </View>
  );
};

const FloatingButterfly = ({ startX, y, duration, delay }: {
  startX: number;
  y: number;
  duration: number;
  delay: number;
}) => {
  const translateX = useSharedValue(startX);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0.85);

  useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(SCREEN_WIDTH + 100, { duration, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    translateY.value = withRepeat(
      withSequence(
        withTiming(-20, { duration: duration / 4, easing: Easing.inOut(Easing.ease) }),
        withTiming(20, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: duration / 4, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: y }, animatedStyle]}>
      <RNText style={{ fontSize: 32 }}>🦋</RNText>
    </Animated.View>
  );
};

// Dragons Theme - Floating Dragons
export const DragonsBackground = () => {
  const dragons = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    startX: Math.random() * SCREEN_WIDTH,
    y: Math.random() * SCREEN_HEIGHT * 0.7,
    duration: Math.random() * 20000 + 35000,
    delay: Math.random() * 10000,
    emoji: i % 2 === 0 ? '🐉' : '🐲',
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#120f1a', '#271629', '#3b1d2c']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {dragons.map((dragon) => (
        <FloatingDragon key={dragon.id} {...dragon} />
      ))}
      {/* Overlay gradient for text visibility */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.5)', 'rgba(0, 0, 0, 0.25)', 'transparent']}
        style={styles.topOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.3, 0.6]}
      />
    </View>
  );
};

const FloatingDragon = ({ startX, y, duration, delay, emoji }: {
  startX: number;
  y: number;
  duration: number;
  delay: number;
  emoji: string;
}) => {
  const translateX = useSharedValue(startX);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(-SCREEN_WIDTH * 0.12, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(-SCREEN_WIDTH * 0.06, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    translateY.value = withRepeat(
      withSequence(
        withTiming(-30, { duration: duration / 3, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: duration / 3, easing: Easing.inOut(Easing.ease) }),
        withTiming(-15, { duration: duration / 3, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 10000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.92, { duration: 10000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 10000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.15, { duration: 10000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: startX, top: y }, animatedStyle]}>
      <RNText style={{ fontSize: 48 }}>{emoji}</RNText>
    </Animated.View>
  );
};

// Christmas Trees Theme - Sliding Pattern
export const ChristmasTreesBackground = () => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(-140, { duration: 55000, easing: Easing.linear }),
      -1,
      false
    );
    translateY.value = withRepeat(
      withTiming(-140, { duration: 55000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const trees = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: (i % 6) * 140,
    y: Math.floor(i / 6) * 140,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#0c2c1b', '#135233', '#187346']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Animated.View style={[{ position: 'absolute', opacity: 0.7 }, animatedStyle]}>
        {trees.map((tree) => (
          <View key={tree.id} style={{ position: 'absolute', left: tree.x, top: tree.y }}>
            <RNText style={{ fontSize: 40 }}>🎄</RNText>
          </View>
        ))}
      </Animated.View>
      {/* Overlay gradient for text visibility */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.2)', 'transparent']}
        style={styles.topOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.3, 0.6]}
      />
    </View>
  );
};

// Music Notes Theme - Sliding Pattern
export const MusicNotesBackground = () => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(-160, { duration: 65000, easing: Easing.linear }),
      -1,
      false
    );
    translateY.value = withRepeat(
      withTiming(-160, { duration: 65000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const notes = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: (i % 6) * 160,
    y: Math.floor(i / 6) * 160,
    emoji: i % 3 === 0 ? '🎵' : i % 3 === 1 ? '🎶' : '🎼',
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#1d1838', '#2b2a66']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Animated.View style={[{ position: 'absolute', opacity: 0.6 }, animatedStyle]}>
        {notes.map((note) => (
          <View key={note.id} style={{ position: 'absolute', left: note.x, top: note.y }}>
            <RNText style={{ fontSize: 36 }}>{note.emoji}</RNText>
          </View>
        ))}
      </Animated.View>
      {/* Overlay gradient for text visibility */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.2)', 'transparent']}
        style={styles.topOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.3, 0.6]}
      />
    </View>
  );
};

// Pixel Hearts Theme - Sliding Pattern
export const PixelHeartsBackground = () => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(-150, { duration: 75000, easing: Easing.linear }),
      -1,
      false
    );
    translateY.value = withRepeat(
      withTiming(-150, { duration: 75000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const hearts = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: (i % 6) * 150,
    y: Math.floor(i / 6) * 150,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#2a0f24', '#3d1434', '#551f46']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Animated.View style={[{ position: 'absolute', opacity: 0.65 }, animatedStyle]}>
        {hearts.map((heart) => (
          <View key={heart.id} style={{ position: 'absolute', left: heart.x, top: heart.y }}>
            <RNText style={{ fontSize: 38 }}>💖</RNText>
          </View>
        ))}
      </Animated.View>
      {/* Overlay gradient for text visibility */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.2)', 'transparent']}
        style={styles.topOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.3, 0.6]}
      />
    </View>
  );
};

// Sunset Theme - Warm Gradient
export const SunsetBackground = () => {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#FFF3E0', '#FFCCBC', '#FFAB91']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      {/* Overlay gradient for text visibility */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.15)', 'transparent']}
        style={styles.topOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.3, 0.6]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
});
