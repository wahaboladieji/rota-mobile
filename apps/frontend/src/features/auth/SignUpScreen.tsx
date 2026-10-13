import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { apiRequest } from '../../services/api';
import { useAuthStore } from '../../state/authStore';
import { AuthSessionResponse } from '@rota/shared';

interface SignUpScreenProps {
  onNavigateToLogin: () => void;
  onNavigateBack?: () => void;
  initialEmail?: string;
}

/**
 * Renders a password requirement item with a red '✕' (close icon) when unmet
 * and a green '✓' (check icon) when met.
 */
const RequirementItem: React.FC<{
  label: string;
  met: boolean;
}> = ({ label, met }) => {
  const { colors, typography } = useTheme();
  const greenColor = '#16A34A';
  const redColor = colors.error;

  return (
    <View style={checklistStyles.itemRow}>
      <View
        style={[
          checklistStyles.iconBadge,
          {
            backgroundColor: met ? 'rgba(22, 163, 74, 0.12)' : 'rgba(220, 38, 38, 0.12)',
            borderColor: met ? greenColor : redColor,
          },
        ]}
      >
        <Text
          style={[
            checklistStyles.iconText,
            { color: met ? greenColor : redColor },
          ]}
        >
          {met ? '✓' : '✕'}
        </Text>
      </View>
      <Text
        style={[
          checklistStyles.itemLabel,
          {
            color: met ? greenColor : redColor,
            fontFamily: typography.roles.bodySmall.fontFamily,
            fontSize: typography.roles.bodySmall.fontSize,
            lineHeight: typography.roles.bodySmall.lineHeight,
            letterSpacing: typography.roles.bodySmall.letterSpacing,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

export const SignUpScreen: React.FC<SignUpScreenProps> = ({
  onNavigateToLogin,
  onNavigateBack,
  initialEmail,
}) => {
  const { colors, typography, spacingCollection, borderRadius } = useTheme();
  const setAuth = useAuthStore((state) => state.setAuth);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
      setEmailError(null);
    }
  }, [initialEmail]);

  // Field Errors
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Touched Flags (for blur validation)
  const [fullNameTouched, setFullNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── Real-Time Full Name Validation ───
  const handleFullNameChange = (text: string) => {
    setFullName(text);

    // 1. Check for numbers or special characters during key time / key up
    if (/[^a-zA-Z\s]/.test(text)) {
      setFullNameError('Full names must use letters');
      return;
    }

    if (text.trim().length === 0) {
      if (fullNameTouched) {
        setFullNameError('Full name cannot be empty');
      } else {
        setFullNameError(null);
      }
      return;
    }

    // 2. Check for at least 2 words: check for space after first word and word following
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) {
      if (fullNameTouched || text.includes(' ')) {
        setFullNameError('Full name must contain at least 2 words');
      } else {
        setFullNameError(null);
      }
    } else {
      setFullNameError(null);
    }
  };

  const handleFullNameBlur = () => {
    setFullNameTouched(true);
    if (!fullName || fullName.trim().length === 0) {
      setFullNameError('Full name cannot be empty');
    } else if (/[^a-zA-Z\s]/.test(fullName)) {
      setFullNameError('Full names must use letters');
    } else {
      const words = fullName.trim().split(/\s+/).filter(Boolean);
      if (words.length < 2) {
        setFullNameError('Full name must contain at least 2 words');
      } else {
        setFullNameError(null);
      }
    }
  };

  // ─── Real-Time Email Validation ───
  const handleEmailChange = (text: string) => {
    setEmail(text);

    if (text.length === 0) {
      if (emailTouched) {
        setEmailError('Email cannot be empty');
      } else {
        setEmailError(null);
      }
      return;
    }

    // Display "Enter A Valid Email Address" while typing,
    // and stop displaying the moment user types domain after @
    const atIndex = text.indexOf('@');
    if (atIndex === -1) {
      setEmailError('Enter A Valid Email Address');
    } else {
      const domainAfterAt = text.slice(atIndex + 1).trim();
      if (domainAfterAt.length === 0) {
        setEmailError('Enter A Valid Email Address');
      } else {
        setEmailError(null);
      }
    }
  };

  const handleEmailBlur = () => {
    setEmailTouched(true);
    if (!email || email.trim().length === 0) {
      setEmailError('Email cannot be empty');
    } else {
      const atIndex = email.indexOf('@');
      const domainAfterAt = atIndex !== -1 ? email.slice(atIndex + 1).trim() : '';
      if (atIndex === -1 || domainAfterAt.length === 0 || !domainAfterAt.includes('.')) {
        setEmailError('Enter A Valid Email Address');
      } else {
        setEmailError(null);
      }
    }
  };

  // ─── Real-Time Password Requirements ───
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const isPasswordRequirementsMet = hasMinLength && hasUpperCase && hasLowerCase;

  const handlePasswordChange = (text: string) => {
    setPassword(text);

    if (text.length === 0) {
      if (passwordTouched) {
        setPasswordError('Password cannot be empty');
      } else {
        setPasswordError(null);
      }
      return;
    }

    // While typing, the checklist dynamically indicates met/unmet rules with green check and red close icons
    setPasswordError(null);
  };

  const handlePasswordBlur = () => {
    setPasswordTouched(true);
    if (!password || password.length === 0) {
      setPasswordError('Password cannot be empty');
    } else if (!hasMinLength || !hasUpperCase || !hasLowerCase) {
      setPasswordError('Password must meet all checklist requirements');
    } else {
      setPasswordError(null);
    }
  };

  // ─── Handle Form Submission ───
  const handleSignUp = async () => {
    setErrorMessage(null);
    setFullNameTouched(true);
    setEmailTouched(true);
    setPasswordTouched(true);

    let hasValidationError = false;

    // Full name checks
    if (!fullName || fullName.trim().length === 0) {
      setFullNameError('Full name cannot be empty');
      hasValidationError = true;
    } else if (/[^a-zA-Z\s]/.test(fullName)) {
      setFullNameError('Full names must use letters');
      hasValidationError = true;
    } else {
      const words = fullName.trim().split(/\s+/).filter(Boolean);
      if (words.length < 2) {
        setFullNameError('Full name must contain at least 2 words');
        hasValidationError = true;
      }
    }

    // Email checks
    if (!email || email.trim().length === 0) {
      setEmailError('Email cannot be empty');
      hasValidationError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Enter A Valid Email Address');
      hasValidationError = true;
    }

    // Password checks
    if (!password || password.length === 0) {
      setPasswordError('Password cannot be empty');
      hasValidationError = true;
    } else if (!hasMinLength || !hasUpperCase || !hasLowerCase) {
      setPasswordError('Password must meet all checklist requirements');
      hasValidationError = true;
    }

    if (hasValidationError) {
      return;
    }

    // Parse words for full name edge cases: first name, middle name, last name, additional names (>3 words)
    const words = fullName.trim().split(/\s+/).filter(Boolean);
    const firstName = words[0];
    const middleName = words.length >= 3 ? words[1] : undefined;
    const lastName = words.length >= 2 ? words[words.length - 1] : undefined;
    const additionalNames = words.length > 3 ? words.slice(2, words.length - 1) : undefined;

    setLoading(true);
    try {
      const data = await apiRequest<AuthSessionResponse>('/api/auth/signup', {
        method: 'POST',
        requiresAuth: false,
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          fullName: fullName.trim(),
          firstName,
          middleName,
          lastName,
          additionalNames,
        }),
      });
      await setAuth(data.user, data.accessToken, data.refreshToken);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Sign-up failed');
    } finally {
      setLoading(false);
    }
  };

  // Button is active only when all input fields are filled and meet all validation requirements
  const isFullNameValid =
    fullName.trim().length > 0 &&
    !/[^a-zA-Z\s]/.test(fullName) &&
    fullName.trim().split(/\s+/).filter(Boolean).length >= 2 &&
    !fullNameError;

  const isEmailValid =
    email.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    !emailError;

  const isPasswordValid =
    isPasswordRequirementsMet &&
    !passwordError;

  const isFormValid = Boolean(isFullNameValid && isEmailValid && isPasswordValid);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          backgroundColor: colors.background,
          padding: spacingCollection.space200,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {onNavigateBack && (
        <TouchableOpacity
          onPress={onNavigateBack}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Back to previous screen"
        >
          <Text
            style={[
              styles.backButtonText,
              {
                color: colors.primary,
                fontFamily: typography.roles.labelLarge.fontFamily,
                fontSize: typography.roles.labelLarge.fontSize,
                fontWeight: typography.roles.labelLarge.fontWeight,
                lineHeight: typography.roles.labelLarge.lineHeight,
                letterSpacing: typography.roles.labelLarge.letterSpacing,
              },
            ]}
          >
            ← Back
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.header}>
        <Text
          style={[
            styles.title,
            {
              color: colors.onBackground,
              fontFamily: typography.roles.titleLarge.fontFamily,
              fontSize: typography.roles.titleLarge.fontSize,
              fontWeight: typography.roles.titleLarge.fontWeight,
              lineHeight: typography.roles.titleLarge.lineHeight,
              letterSpacing: typography.roles.titleLarge.letterSpacing,
            },
          ]}
        >
          Create Account
        </Text>
        <Text
          style={[
            styles.subtitle,
            {
              color: colors.onSurfaceVariant,
              fontFamily: typography.roles.bodyMedium.fontFamily,
              fontSize: typography.roles.bodyMedium.fontSize,
              fontWeight: typography.roles.bodyMedium.fontWeight,
              lineHeight: typography.roles.bodyMedium.lineHeight,
              letterSpacing: typography.roles.bodyMedium.letterSpacing,
              marginTop: spacingCollection.space50,
            },
          ]}
        >
          Sign up to schedule shifts and manage your team
        </Text>
      </View>

      {errorMessage ? (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: colors.errorContainer,
              borderColor: colors.error,
              padding: spacingCollection.space150,
              borderRadius: 8,
              marginBottom: spacingCollection.space200,
            },
          ]}
        >
          <Text
            style={{
              color: colors.onErrorContainer,
              fontFamily: typography.roles.bodySmall.fontFamily,
              fontSize: typography.roles.bodySmall.fontSize,
              lineHeight: typography.roles.bodySmall.lineHeight,
              letterSpacing: typography.roles.bodySmall.letterSpacing,
            }}
          >
            {errorMessage}
          </Text>
        </View>
      ) : null}

      <Input
        label="Full Name"
        placeholder="e.g. Jane Doe"
        autoCapitalize="words"
        value={fullName}
        onChangeText={handleFullNameChange}
        onBlur={handleFullNameBlur}
        error={fullNameError || undefined}
      />

      <Input
        label="Email"
        placeholder="you@team.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={handleEmailChange}
        onBlur={handleEmailBlur}
        error={emailError || undefined}
      />

      <Input
        label="Password"
        placeholder="••••••••"
        secureTextEntry
        value={password}
        onChangeText={handlePasswordChange}
        onBlur={handlePasswordBlur}
        error={passwordError || undefined}
      />

      {password.length > 0 && (
        <View
          style={[
            styles.passwordChecklist,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.surfaceVariant,
              borderRadius: borderRadius.md,
              padding: spacingCollection.space100Base,
              marginBottom: spacingCollection.space150,
            },
          ]}
        >
          <Text
            style={[
              styles.checklistHeading,
              {
                color: colors.onSurfaceVariant,
                fontFamily: typography.roles.labelSmall.fontFamily,
                fontSize: typography.roles.labelSmall.fontSize,
                fontWeight: typography.roles.labelSmall.fontWeight,
                lineHeight: typography.roles.labelSmall.lineHeight,
                letterSpacing: typography.roles.labelSmall.letterSpacing,
                marginBottom: spacingCollection.space75,
              },
            ]}
          >
            Password requirements:
          </Text>
          <RequirementItem label="Minimum 8 characters" met={hasMinLength} />
          <RequirementItem label="At least one uppercase letter" met={hasUpperCase} />
          <RequirementItem label="At least one lowercase letter" met={hasLowerCase} />
        </View>
      )}

      <Button
        title="Create Account"
        onPress={handleSignUp}
        loading={loading}
        disabled={!isFormValid}
        style={{ marginTop: spacingCollection.space100Base }}
      />

      <View style={[styles.linkContainer, { marginTop: spacingCollection.space200 }]}>
        <TouchableOpacity onPress={onNavigateToLogin}>
          <Text
            style={{
              color: colors.onSurfaceVariant,
              fontFamily: typography.roles.bodyMedium.fontFamily,
              fontSize: typography.roles.bodyMedium.fontSize,
              lineHeight: typography.roles.bodyMedium.lineHeight,
              letterSpacing: typography.roles.bodyMedium.letterSpacing,
            }}
          >
            Already have an account?{' '}
            <Text
              style={{
                color: colors.primary,
                fontFamily: typography.roles.labelLarge.fontFamily,
                fontWeight: typography.roles.labelLarge.fontWeight,
              }}
            >
              Sign In
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    marginBottom: 16,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {},
  subtitle: {},
  errorBanner: {
    borderWidth: 1,
  },
  passwordChecklist: {
    borderWidth: 1,
  },
  checklistHeading: {},
  linkContainer: {
    alignItems: 'center',
  },
});

const checklistStyles = StyleSheet.create({
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  iconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  iconText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 12,
    textAlign: 'center',
  },
  itemLabel: {
    flex: 1,
  },
});
