import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { apiRequest } from '../../services/api';
import { useAuthStore } from '../../state/authStore';
import { AuthSessionResponse } from '@rota/shared';

interface MagicLinkScreenProps {
  onNavigateToLogin: () => void;
}

export const MagicLinkScreen: React.FC<MagicLinkScreenProps> = ({ onNavigateToLogin }) => {
  const { colors, typography, spacingCollection } = useTheme();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [tokenTouched, setTokenTouched] = useState(false);
  const [stage, setStage] = useState<'REQUEST' | 'VERIFY'>('REQUEST');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (text.trim().length === 0) {
      if (emailTouched) {
        setEmailError('Email address cannot be empty');
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
      setEmailError('Email address cannot be empty');
    } else {
      setEmailError(null);
    }
  };

  const handleTokenChange = (text: string) => {
    setToken(text);
    if (text.trim().length === 0) {
      if (tokenTouched) {
        setTokenError('Token code cannot be empty');
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
      setTokenError('Token code cannot be empty');
    } else {
      setTokenError(null);
    }
  };

  const handleRequestLink = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setEmailTouched(true);

    if (!email || email.trim().length === 0) {
      setEmailError('Email address cannot be empty');
      return;
    }

    setLoading(true);
    try {
      await apiRequest<{ message: string }>('/api/auth/magic-link', {
        method: 'POST',
        requiresAuth: false,
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setInfoMessage('If your email is registered, a single-use sign-in link has been sent.');
      setStage('VERIFY');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyToken = async () => {
    setErrorMessage(null);
    setTokenTouched(true);

    if (!token || token.trim().length === 0) {
      setTokenError('Token code cannot be empty');
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest<AuthSessionResponse>('/api/auth/magic-link/verify', {
        method: 'POST',
        requiresAuth: false,
        body: JSON.stringify({ token: token.trim() }),
      });
      await setAuth(data.user, data.accessToken, data.refreshToken);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Verification failed');
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
          {stage === 'REQUEST' ? 'Magic Link Sign In' : 'Verify Magic Link'}
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
          {stage === 'REQUEST'
            ? 'We will send a single-use sign-in token to your email.'
            : 'Enter the single-use token received in your email to authenticate.'}
        </Text>
      </View>

      {errorMessage ? (
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
            {errorMessage}
          </Text>
        </View>
      ) : null}

      {infoMessage ? (
        <View
          style={[
            styles.banner,
            {
              backgroundColor: colors.secondaryContainer,
              borderColor: colors.secondary,
              padding: spacingCollection.space150,
              borderRadius: 8,
              marginBottom: spacingCollection.space200,
            },
          ]}
        >
          <Text
            style={{
              color: colors.onSecondaryContainer,
              fontFamily: typography.roles.bodySmall.fontFamily,
              fontSize: typography.roles.bodySmall.fontSize,
              lineHeight: typography.roles.bodySmall.lineHeight,
              letterSpacing: typography.roles.bodySmall.letterSpacing,
            }}
          >
            {infoMessage}
          </Text>
        </View>
      ) : null}

      {stage === 'REQUEST' ? (
        <>
          <Input
            label="Email Address"
            placeholder="you@team.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={handleEmailChange}
            onBlur={handleEmailBlur}
            error={emailError || undefined}
          />
          <Button
            title="Send Magic Link"
            onPress={handleRequestLink}
            loading={loading}
            style={{ marginTop: spacingCollection.space100Base }}
          />
        </>
      ) : (
        <>
          <Input
            label="Token Code"
            placeholder="Paste token from email"
            autoCapitalize="none"
            value={token}
            onChangeText={handleTokenChange}
            onBlur={handleTokenBlur}
            error={tokenError || undefined}
          />
          <Button
            title="Authenticate"
            onPress={handleVerifyToken}
            loading={loading}
            style={{ marginTop: spacingCollection.space100Base }}
          />
          <Button
            title="Back to Email Input"
            variant="outline"
            onPress={() => setStage('REQUEST')}
            style={{ marginTop: spacingCollection.space100Base }}
          />
        </>
      )}

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
            Prefer password?{' '}
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
  title: {},
  subtitle: {},
  banner: {
    borderWidth: 1,
  },
  linkContainer: {
    alignItems: 'center',
  },
});
