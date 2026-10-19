import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme';
import { Button, FlashIcon } from '../../components/Button';
import { Input } from '../../components/Input';
import { apiRequest } from '../../services/api';
import { useRateLimitCountdown } from '../../services/useRateLimitCountdown';
import { useAuthStore } from '../../state/authStore';
import { AuthSessionResponse } from '@rota/shared';

interface LoginScreenProps {
  onNavigateToSignUp: () => void;
  onNavigateToMagicLink: () => void;
  onNavigateToPasswordReset: (email?: string) => void;
  onNavigateBack?: () => void;
  initialEmail?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onNavigateToSignUp,
  onNavigateToMagicLink,
  onNavigateToPasswordReset,
  onNavigateBack,
  initialEmail,
}) => {
  const { colors, typography, spacingCollection } = useTheme();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState(initialEmail ?? '');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const rateLimit = useRateLimitCountdown('Too many login attempts. Please try again in');

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
      setEmailError(null);
    }
  }, [initialEmail]);

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (text.trim().length === 0) {
      if (emailTouched) {
        setEmailError('Email cannot be empty');
      } else {
        setEmailError(null);
      }
    } else {
      setEmailError(null);
    }
  };

  const handleEmailBlur = () => {
    setEmailTouched(true);
    if (!email || email.trim().length === 0) {
      setEmailError('Email cannot be empty');
    } else {
      setEmailError(null);
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (text.length === 0) {
      if (passwordTouched) {
        setPasswordError('Password cannot be empty');
      } else {
        setPasswordError(null);
      }
    } else {
      setPasswordError(null);
    }
  };

  const handlePasswordBlur = () => {
    setPasswordTouched(true);
    if (!password || password.length === 0) {
      setPasswordError('Password cannot be empty');
    } else {
      setPasswordError(null);
    }
  };

  const handleLogin = async () => {
    setErrorMessage(null);
    setEmailTouched(true);
    setPasswordTouched(true);

    let hasError = false;
    if (!email || email.trim().length === 0) {
      setEmailError('Email cannot be empty');
      hasError = true;
    }
    if (!password || password.length === 0) {
      setPasswordError('Password cannot be empty');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest<AuthSessionResponse>('/api/auth/login', {
        method: 'POST',
        requiresAuth: false,
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      await setAuth(data.user, data.accessToken, data.refreshToken);
    } catch (err: unknown) {
      if (!rateLimit.handleApiError(err)) {
        setErrorMessage(err instanceof Error ? err.message : 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

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
          Welcome Back
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
          Manage shifts, team rosters, and requests
        </Text>
      </View>

      {rateLimit.isRateLimited || errorMessage ? (
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
            {rateLimit.isRateLimited ? rateLimit.formattedMessage : errorMessage}
          </Text>
        </View>
      ) : null}

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
        labelAccessory={
          <TouchableOpacity
            onPress={() => onNavigateToPasswordReset(email)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Forgot Password"
          >
            <Text
              style={[
                styles.secondaryLink,
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
              Forgot Password
            </Text>
          </TouchableOpacity>
        }
      />

      <Button
        title={rateLimit.isRateLimited ? `Try again in ${rateLimit.secondsRemaining}s` : 'Sign In'}
        onPress={handleLogin}
        loading={loading}
        disabled={rateLimit.isRateLimited || email.trim().length === 0 || password.length === 0}
        style={{ marginTop: spacingCollection.space100Base }}
      />

      <View style={[styles.linkContainer, { marginTop: spacingCollection.space200 }]}>
        <TouchableOpacity onPress={onNavigateToSignUp}>
          <Text
            style={{
              color: colors.onSurfaceVariant,
              fontFamily: typography.roles.bodyMedium.fontFamily,
              fontSize: typography.roles.bodyMedium.fontSize,
              lineHeight: typography.roles.bodyMedium.lineHeight,
              letterSpacing: typography.roles.bodyMedium.letterSpacing,
            }}
          >
            Don't have an account?{' '}
            <Text
              style={{
                color: colors.primary,
                fontFamily: typography.roles.labelLarge.fontFamily,
                fontWeight: typography.roles.labelLarge.fontWeight,
              }}
            >
              Create account
            </Text>
          </Text>
        </TouchableOpacity>

        <View
          style={[
            styles.orDivider,
            { marginVertical: spacingCollection.space250, width: '100%' },
          ]}
        >
          <View style={[styles.orLine, { backgroundColor: colors.inverseOnSurface }]} />
          <Text
            style={[
              styles.orText,
              {
                color: colors.onSurfaceVariant,
                fontFamily: typography.roles.bodyMedium.fontFamily,
                fontSize: typography.roles.bodyMedium.fontSize,
                lineHeight: typography.roles.bodyMedium.lineHeight,
                letterSpacing: typography.roles.bodyMedium.letterSpacing,
                marginHorizontal: spacingCollection.space100Base,
              },
            ]}
          >
            or
          </Text>
          <View style={[styles.orLine, { backgroundColor: colors.inverseOnSurface }]} />
        </View>

        <Button
          variant="tonal"
          title="Sign in with Magic Link"
          onPress={onNavigateToMagicLink}
          style={{ width: '100%' }}
          icon={<FlashIcon color={colors.onSurfaceVariant} size={16} />}
        />
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
  linkContainer: {
    alignItems: 'center',
  },
  secondaryLink: {},
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {},
});
