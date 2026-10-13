import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../theme';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  containerStyle?: ViewStyle;
  labelAccessory?: React.ReactNode;
}

/**
 * Modern vector-grade show/hide eye icon crafted with pure React Native primitives.
 * Employs rotated asymmetric curvature to create a streamlined almond eye contour,
 * centered iris & pupil, and an anti-collision micro-masked diagonal slash.
 */
const ModernEyeIcon: React.FC<{
  visible: boolean;
  color: string;
  backgroundColor: string;
}> = ({ visible, color, backgroundColor }) => {
  return (
    <View style={eyeStyles.container}>
      {/* Almond eye outline */}
      <View style={[eyeStyles.eyeFrame, { borderColor: color }]}>
        {/* Iris ring */}
        <View style={[eyeStyles.iris, { borderColor: color }]}>
          {/* Pupil center */}
          <View style={[eyeStyles.pupil, { backgroundColor: color }]} />
        </View>
      </View>

      {/* Modern diagonal slash when password is hidden */}
      {!visible && (
        <View style={eyeStyles.slashWrapper} pointerEvents="none">
          {/* Micro-mask to prevent line collision with eye frame */}
          <View style={[eyeStyles.slashMask, { backgroundColor }]} />
          {/* Sleek rounded slash line */}
          <View style={[eyeStyles.slashLine, { backgroundColor: color }]} />
        </View>
      )}
    </View>
  );
};

const eyeStyles = StyleSheet.create({
  container: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeFrame: {
    width: 14,
    height: 14,
    borderWidth: 1.6,
    borderTopLeftRadius: 13,
    borderBottomRightRadius: 13,
    borderTopRightRadius: 2.5,
    borderBottomLeftRadius: 2.5,
    transform: [{ rotate: '45deg' }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  iris: {
    width: 6.8,
    height: 6.8,
    borderRadius: 3.4,
    borderWidth: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pupil: {
    width: 2.2,
    height: 2.2,
    borderRadius: 1.1,
  },
  slashWrapper: {
    position: 'absolute',
    width: 22,
    height: 6,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '-45deg' }],
  },
  slashMask: {
    position: 'absolute',
    width: 22,
    height: 3.4,
    borderRadius: 1.7,
  },
  slashLine: {
    width: 20,
    height: 1.6,
    borderRadius: 1,
  },
});

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  labelAccessory,
  style,
  secureTextEntry,
  onFocus,
  onBlur,
  ...textInputProps
}) => {
  const { colors, typography, borderRadius, spacingCollection } = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const showPasswordToggle = Boolean(secureTextEntry);
  const effectiveSecureTextEntry = showPasswordToggle ? !isPasswordVisible : false;

  const handleFocus: NonNullable<TextInputProps['onFocus']> = (event) => {
    setIsFocused(true);
    onFocus?.(event);
  };

  const handleBlur: NonNullable<TextInputProps['onBlur']> = (event) => {
    setIsFocused(false);
    onBlur?.(event);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.labelRow, { marginBottom: spacingCollection.space50 }]}>
        <Text
          style={[
            styles.label,
            {
              color: colors.onSurface,
              fontFamily: typography.roles.labelLarge.fontFamily,
              fontSize: typography.roles.labelLarge.fontSize,
              fontWeight: typography.roles.labelLarge.fontWeight,
              lineHeight: typography.roles.labelLarge.lineHeight,
              letterSpacing: typography.roles.labelLarge.letterSpacing,
            },
          ]}
        >
          {label}
        </Text>
        {labelAccessory}
      </View>
      <View
        style={[
          styles.inputWrapper,
          {
            borderColor: error ? colors.error : isFocused ? colors.primary : colors.surfaceVariant,
            borderWidth: isFocused ? 2 : 1,
            borderRadius: borderRadius.md,
            backgroundColor: 'transparent',
          },
          style,
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              color: colors.onSurface,
              fontFamily: typography.roles.bodyLarge.fontFamily,
              fontSize: typography.roles.bodyLarge.fontSize,
              lineHeight: typography.roles.bodyLarge.lineHeight,
              letterSpacing: typography.roles.bodyLarge.letterSpacing,
              paddingLeft: spacingCollection.space150,
              paddingRight: showPasswordToggle ? spacingCollection.space50 : spacingCollection.space150,
            },
          ]}
          secureTextEntry={effectiveSecureTextEntry}
          placeholderTextColor={colors.outlineVariant}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...textInputProps}
        />
        {showPasswordToggle && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible((prev) => !prev)}
            style={styles.toggleButton}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
          >
            <ModernEyeIcon
              visible={isPasswordVisible}
              color={colors.onSurfaceVariant}
              backgroundColor={colors.background}
            />
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text
          style={[
            styles.errorText,
            {
              color: colors.error,
              fontFamily: typography.roles.bodySmall.fontFamily,
              fontSize: typography.roles.bodySmall.fontSize,
              lineHeight: typography.roles.bodySmall.lineHeight,
              letterSpacing: typography.roles.bodySmall.letterSpacing,
              marginTop: spacingCollection.space25,
            },
          ]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {},
  inputWrapper: {
    minHeight: 48, // 48pt touch target
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  input: {
    flex: 1,
    minHeight: 48,
    backgroundColor: 'transparent',
  },
  toggleButton: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
  },
  errorText: {},
});
