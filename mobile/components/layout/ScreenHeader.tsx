import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

interface ScreenHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  children?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  leftContent,
  rightContent,
  children,
  containerStyle,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingTop: insets.top + 12,
          paddingBottom: 16,
          paddingHorizontal: 20,
          backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        leftContent: {
          marginRight: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        titleWrapper: {
          flex: 1,
        },
        titleText: {
          fontSize: 28,
          fontWeight: '700',
          color: colors.text,
          letterSpacing: -0.3,
        },
        subtitleText: {
          marginTop: 4,
          fontSize: 14,
          color: colors.textSecondary,
        },
        rightContent: {
          marginLeft: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        childrenWrapper: {
          marginTop: 16,
        },
      }),
    [colors.backgroundSecondary, colors.border, colors.text, colors.textSecondary, insets.top, isDark]
  );

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.row}>
        {leftContent ? <View style={styles.leftContent}>{leftContent}</View> : null}
        <View style={styles.titleWrapper}>
          {typeof title === 'string' ? (
            <Text style={styles.titleText}>{title}</Text>
          ) : (
            title
          )}
          {subtitle
            ? typeof subtitle === 'string'
              ? <Text style={styles.subtitleText}>{subtitle}</Text>
              : subtitle
            : null}
        </View>
        {rightContent ? <View style={styles.rightContent}>{rightContent}</View> : null}
      </View>
      {children ? <View style={styles.childrenWrapper}>{children}</View> : null}
    </View>
  );
};

export default ScreenHeader;
