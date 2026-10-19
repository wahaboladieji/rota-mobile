import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { apiRequest } from '../../services/api';
import { useRateLimitCountdown } from '../../services/useRateLimitCountdown';

interface PasswordResetScreenProps {
  onNavigateToLogin: (email?: string) => void;
  onNavigateBack?: (email?: string) => void;
  initialEmail?: string;
}

export const PasswordResetScreen: React.FC<PasswordResetScreenProps> = ({
  onNavigateToLogin,
  onNavigateBack,
  initialEmail,
}) => {
  const { colors, typography, spacingCollection } = useTheme();

  const [email, setEmail] = useState(initialEmail ?? '');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [tokenTouched, setTokenTouched] = useState(false);
  const [newPasswordTouched, setNewPasswordTouched] = useState(false);
  const [stage, setStage] = useState<'REQUEST' | 'CONFIRM' | 'SUCCESS'>('REQUEST');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(60);
  const rateLimit = useRateLimitCountdown('Too many password reset requests. Please try again in');

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
      setEmailError(null);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (stage !== 'CONFIRM' || resendCountdown <= 0) {
      return;
    }
    const id = setInterval(() => {
      setResendCountdown((count) => (count <= 1 ? 0 : count - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [stage, resendCountdown]);

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

  const handleTokenChange = (text: string) => {
    setToken(text);
    if (text.trim().length === 0) {
      if (tokenTouched) {
        setTokenError('Reset token cannot be empty');
      } else {
        setTokenError(null);
      }
    } else {
      setTokenError(null);
    }
  };

  const handleTokenBlur = () => {
    setTokenTouched(true);
    if (!token || token.trim().length === 0) {
      setTokenError('Verification code cannot be empty');
    } else {
      setTokenError(null);
    }
  };

  const handleNewPasswordChange = (text: string) => {
    setNewPassword(text);
    if (text.length === 0) {
      if (newPasswordTouched) {
        setNewPasswordError('New password cannot be empty');
      } else {
        setNewPasswordError(null);
      }
    } else if (text.length < 8) {
      setNewPasswordError('Password must be at least 8 characters long');
    } else {
      setNewPasswordError(null);
    }
  };

  const handleNewPasswordBlur = () => {
    setNewPasswordTouched(true);
    if (!newPassword || newPassword.length === 0) {
      setNewPasswordError('New password cannot be empty');
    } else if (newPassword.length < 8) {
      setNewPasswordError('Password must be at least 8 characters long');
    } else {
      setNewPasswordError(null);
    }
  };

  const handleRequestReset = async () => {
    setErrorMessage(null);
    setEmailTouched(true);

    if (!email || email.trim().length === 0) {
      setEmailError('Email cannot be empty');
      return;
    }

    setLoading(true);
    try {
      await apiRequest<{ message: string }>('/api/auth/password-reset', {
        method: 'POST',
        requiresAuth: false,
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setStage('CONFIRM');
    } catch (err: unknown) {
      if (!rateLimit.handleApiError(err)) {
        setErrorMessage(err instanceof Error ? err.message : 'Reset request failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    setErrorMessage(null);
    setTokenTouched(true);
    setNewPasswordTouched(true);

    let hasError = false;
    if (!token || token.trim().length === 0) {
      setTokenError('Verification code cannot be empty');
      hasError = true;
    }
    if (!newPassword || newPassword.length === 0) {
      setNewPasswordError('New password cannot be empty');
      hasError = true;
    } else if (newPassword.length < 8) {
      setNewPasswordError('Password must be at least 8 characters long');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setLoading(true);
    try {
      await apiRequest<{ message: string }>('/api/auth/password-reset/confirm', {
        method: 'POST',
        requiresAuth: false,
        body: JSON.stringify({ token: token.trim(), newPassword, email: email.trim().toLowerCase() }),
      });
      setStage('SUCCESS');
    } catch (err: unknown) {
      if (!rateLimit.handleApiError(err)) {
        setErrorMessage(err instanceof Error ? err.message : 'Reset failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setErrorMessage(null);

    if (!email || email.trim().length === 0) {
      setEmailError('Email cannot be empty');
      return;
    }

    setLoading(true);
    try {
      await apiRequest<{ message: string }>('/api/auth/password-reset', {
        method: 'POST',
        requiresAuth: false,
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setResendCountdown(60);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Resend failed');
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  const maskEmail = (value: string) => {
    const trimmed = value.trim();
    const atIndex = trimmed.indexOf('@');
    if (atIndex <= 0) {
      return trimmed;
    }
    const local = trimmed.slice(0, atIndex);
    const domain = trimmed.slice(atIndex);
    const revealed = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
    return `${revealed}***${domain}`;
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
          onPress={() => onNavigateBack(email.trim() ? email.trim().toLowerCase() : undefined)}
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
          {stage === 'SUCCESS' ? 'Password Reset Complete' : 'Reset Password'}
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
          {stage === 'REQUEST' && 'Enter your email to receive your password reset code.'}
          {stage === 'CONFIRM' && `We have sent a one-time verification code to ${maskEmail(email)}.`}
          {stage === 'SUCCESS' && 'Your password has been securely updated. You can now sign in.'}
        </Text>
      </View>

      {rateLimit.isRateLimited || errorMessage ? (
        <View
          style={[
            styles.banner,
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

      {stage === 'REQUEST' && (
        <>
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
          <Button
            title={rateLimit.isRateLimited ? `Try again in ${rateLimit.secondsRemaining}s` : 'Send Reset Code'}
            onPress={handleRequestReset}
            loading={loading}
            disabled={rateLimit.isRateLimited}
            style={{ marginTop: spacingCollection.space100Base }}
          />
        </>
      )}

      {stage === 'CONFIRM' && (
        <>
          <Input
            label="Verification Code"
            placeholder="Verification code from email"
            autoCapitalize="none"
            value={token}
            onChangeText={handleTokenChange}
            onBlur={handleTokenBlur}
            error={tokenError || undefined}
          />
          <Input
            label="New Password"
            placeholder="••••••••"
            secureTextEntry
            value={newPassword}
            onChangeText={handleNewPasswordChange}
            onBlur={handleNewPasswordBlur}
            error={newPasswordError || undefined}
          />
          <Button
            title="Set New Password"
            onPress={handleConfirmReset}
            loading={loading}
            style={{ marginTop: spacingCollection.space100Base }}
          />

          <View style={styles.resendSection}>
            <Button
              variant="tonal"
              title={
                resendCountdown > 0
                  ? `Resend Code · ${formatCountdown(resendCountdown)}`
                  : 'Resend Code'
              }
              onPress={handleResendCode}
              disabled={resendCountdown > 0}
              style={{
                width: '100%',
                backgroundColor:
                  resendCountdown > 0 ? colors.surfaceContainerLow : undefined,
                ...(resendCountdown > 0 ? { borderColor: 'transparent' } : {}),
              }}
              textStyle={resendCountdown > 0 ? { color: colors.outlineVariant } : undefined}
            />
          </View>
        </>
      )}

      {stage === 'SUCCESS' && (
        <Button
          title="Proceed to Sign In"
          onPress={() => onNavigateToLogin(email.trim().toLowerCase())}
          style={{ marginTop: spacingCollection.space100Base }}
        />
      )}

      {stage !== 'SUCCESS' && (
        <View style={[styles.linkContainer, { marginTop: spacingCollection.space200 }]}>
          <TouchableOpacity onPress={() => onNavigateToLogin(email.trim() ? email.trim().toLowerCase() : undefined)}>
            <Text
              style={{
                color: colors.onSurfaceVariant,
                fontFamily: typography.roles.bodyMedium.fontFamily,
                fontSize: typography.roles.bodyMedium.fontSize,
                lineHeight: typography.roles.bodyMedium.lineHeight,
                letterSpacing: typography.roles.bodyMedium.letterSpacing,
              }}
            >
              Remembered your password?{' '}
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: typography.roles.labelLarge.fontFamily,
                  fontWeight: typography.roles.labelLarge.fontWeight,
                }}
              >
                Back to Sign In
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  banner: {
    borderWidth: 1,
  },
  linkContainer: {
    alignItems: 'center',
  },
  resendSection: {
    marginTop: 16,
  },
});
