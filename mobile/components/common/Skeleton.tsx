import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const { colors, isDark } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const skeletonColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: skeletonColor,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};

interface SkeletonPostProps {
  isDark?: boolean;
}

export const SkeletonPost: React.FC<SkeletonPostProps> = () => {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.postContainer,
        {
          backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
          borderColor: colors.border,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.postHeader}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={styles.postHeaderText}>
          <Skeleton width={120} height={16} borderRadius={4} style={{ marginBottom: 8 }} />
          <Skeleton width={80} height={12} borderRadius={4} />
        </View>
      </View>

      {/* Content */}
      <View style={styles.postContent}>
        <Skeleton width="100%" height={14} borderRadius={4} style={{ marginBottom: 8 }} />
        <Skeleton width="90%" height={14} borderRadius={4} style={{ marginBottom: 8 }} />
        <Skeleton width="70%" height={14} borderRadius={4} />
      </View>

      {/* Media placeholder */}
      <Skeleton width="100%" height={300} borderRadius={12} style={{ marginTop: 12 }} />

      {/* Actions */}
      <View style={styles.postActions}>
        <Skeleton width={60} height={20} borderRadius={4} />
        <Skeleton width={60} height={20} borderRadius={4} />
        <Skeleton width={60} height={20} borderRadius={4} />
      </View>
    </View>
  );
};

export const SkeletonProfile: React.FC = () => {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.profileHeader}>
        <View style={styles.profileTopSection}>
          <Skeleton width={90} height={90} borderRadius={45} />
          <View style={styles.profileInfo}>
            <Skeleton width={150} height={20} borderRadius={4} style={{ marginBottom: 8 }} />
            <Skeleton width={100} height={16} borderRadius={4} style={{ marginBottom: 12 }} />
            <Skeleton width={120} height={14} borderRadius={4} style={{ marginBottom: 8 }} />
            <Skeleton width={180} height={14} borderRadius={4} />
          </View>
        </View>
        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <Skeleton width={30} height={20} borderRadius={4} style={{ marginBottom: 4 }} />
            <Skeleton width={40} height={12} borderRadius={4} />
          </View>
          <View style={styles.stat}>
            <Skeleton width={30} height={20} borderRadius={4} style={{ marginBottom: 4 }} />
            <Skeleton width={50} height={12} borderRadius={4} />
          </View>
          <View style={styles.stat}>
            <Skeleton width={30} height={20} borderRadius={4} style={{ marginBottom: 4 }} />
            <Skeleton width={50} height={12} borderRadius={4} />
          </View>
        </View>
      </View>
    </View>
  );
};

export const SkeletonFriend: React.FC = () => {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.friendItem,
        {
          backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
        },
      ]}
    >
      <Skeleton width={50} height={50} borderRadius={25} />
      <View style={styles.friendInfo}>
        <Skeleton width={120} height={16} borderRadius={4} style={{ marginBottom: 8 }} />
        <Skeleton width={80} height={12} borderRadius={4} />
      </View>
    </View>
  );
};

export const SkeletonNotification: React.FC = () => {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.notificationItem,
        {
          backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
          borderColor: colors.border,
        },
      ]}
    >
      <Skeleton width={50} height={50} borderRadius={25} />
      <View style={styles.notificationContent}>
        <Skeleton width="80%" height={14} borderRadius={4} style={{ marginBottom: 8 }} />
        <Skeleton width="60%" height={12} borderRadius={4} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  postContainer: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  postHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  postContent: {
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  profileHeader: {
    padding: 20,
  },
  profileTopSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 20,
    paddingTop: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    marginTop: 12,
  },
  stat: {
    alignItems: 'center',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  notificationContent: {
    flex: 1,
    marginLeft: 12,
  },
});

