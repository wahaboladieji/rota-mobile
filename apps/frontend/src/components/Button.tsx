import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  AccessibilityRole,
} from 'react-native';
import { useTheme } from '../theme';
import { FlashIcon } from './ReviewIcons';

export { FlashIcon };

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'tonal';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
  icon,
}) => {
  const { colors, typography, borderRadius, spacingCollection } = useTheme();

  const getBackgroundColor = () => {
    if (disabled) return colors.surfaceContainerHigh;
    if (variant === 'primary') return colors.primary;
    if (variant === 'secondary') return colors.secondaryContainer;
    if (variant === 'tonal') return 'transparent';
    return 'transparent';
  };

  const getTextColor = () => {
    if (disabled) return colors.onSurfaceVariant;
    if (variant === 'primary') return colors.onPrimary;
    if (variant === 'secondary') return colors.onSecondaryContainer;
    if (variant === 'tonal') return colors.onSurfaceVariant;
    return colors.primary;
  };

  const getBorderColor = () => {
    if (variant === 'outline') return disabled ? colors.outlineVariant : colors.outline;
    if (variant === 'tonal') return disabled ? colors.outlineVariant : colors.primary95;
    return 'transparent';
  };

  return (
    <TouchableOpacity
      accessibilityRole={'button' as AccessibilityRole}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: disabled || loading }}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.buttonBase,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderRadius: borderRadius.md,
          paddingVertical: spacingCollection.space125,
          paddingHorizontal: spacingCollection.space200,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {icon ? (
            <View style={{ marginRight: spacingCollection.space50 }}>{icon}</View>
          ) : null}
          <Text
            style={[
              styles.textBase,
              {
                color: getTextColor(),
                fontFamily: typography.roles.labelLarge.fontFamily,
                fontSize: typography.roles.labelLarge.fontSize,
                fontWeight: typography.roles.labelLarge.fontWeight,
                lineHeight: typography.roles.labelLarge.lineHeight,
                letterSpacing: typography.roles.labelLarge.letterSpacing,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  buttonBase: {
    minHeight: 48, // Exceeds 44pt touch target standard
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBase: {
    textAlign: 'center',
  },
});
