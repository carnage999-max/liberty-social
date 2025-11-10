import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './Skeleton';
import { useTheme } from '../../contexts/ThemeContext';

export const SkeletonPrivacy: React.FC = () => {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.section}>
        <Skeleton width={150} height={18} borderRadius={4} style={{ marginBottom: 16 }} />
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Skeleton width={120} height={16} borderRadius={4} style={{ marginBottom: 8 }} />
            <Skeleton width="80%" height={12} borderRadius={4} />
          </View>
          <Skeleton width={50} height={30} borderRadius={15} />
        </View>
      </View>

      <View style={styles.section}>
        <Skeleton width={150} height={18} borderRadius={4} style={{ marginBottom: 16 }} />
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Skeleton width={120} height={16} borderRadius={4} style={{ marginBottom: 8 }} />
            <Skeleton width="80%" height={12} borderRadius={4} />
          </View>
          <Skeleton width={50} height={30} borderRadius={15} />
        </View>
      </View>

      <View style={styles.section}>
        <Skeleton width={150} height={18} borderRadius={4} style={{ marginBottom: 16 }} />
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Skeleton width={120} height={16} borderRadius={4} style={{ marginBottom: 8 }} />
            <Skeleton width="80%" height={12} borderRadius={4} />
          </View>
          <Skeleton width={50} height={30} borderRadius={15} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    marginBottom: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
});

