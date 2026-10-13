import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, SafeAreaView, StyleSheet, StatusBar, Linking } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
} from '@expo-google-fonts/roboto';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';

import { ThemeProvider, useTheme } from './src/theme';
import { queryClient } from './src/state/queryClient';
import { useAuthStore } from './src/state/authStore';
import { LoginScreen } from './src/features/auth/LoginScreen';
import { SignUpScreen } from './src/features/auth/SignUpScreen';
import { MagicLinkScreen } from './src/features/auth/MagicLinkScreen';
import { PasswordResetScreen } from './src/features/auth/PasswordResetScreen';
import { OnboardingScreen } from './src/features/onboarding/OnboardingScreen';
import { WelcomeScreen } from './src/features/welcome/WelcomeScreen';
import { DashboardScreen } from './src/features/dashboard/DashboardScreen';
import { InvitationAcceptScreen } from './src/features/invitation/InvitationAcceptScreen';

type AuthView = 'WELCOME' | 'LOGIN' | 'SIGNUP' | 'MAGIC_LINK' | 'PASSWORD_RESET' | 'INVITE';
type AppView = 'ONBOARDING' | 'DASHBOARD';

const MainNavigator: React.FC = () => {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isLoadingAuth = useAuthStore((state) => state.isLoading);
  const loadSavedAuth = useAuthStore((state) => state.loadSavedAuth);

  const [authView, setAuthView] = useState<AuthView>('WELCOME');
  const [appView, setAppView] = useState<AppView>('DASHBOARD');
  const [passwordResetEmail, setPasswordResetEmail] = useState('');
  const [loginInitialEmail, setLoginInitialEmail] = useState('');
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);

  useEffect(() => {
    loadSavedAuth();
  }, [loadSavedAuth]);

  // Deep linking listener for invitation links (rota://invite/:token, exp://.../--/invite/:token, http(s)://.../invite/:token)
  useEffect(() => {
    const extractInviteToken = (url: string | null) => {
      if (!url) return;
      try {
        const match = url.match(/invite\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          setPendingInviteToken(match[1]);
          setAuthView('INVITE');
        }
      } catch {
        // Ignored
      }
    };

    Linking.getInitialURL().then(extractInviteToken);

    const subscription = Linking.addEventListener('url', (event) => {
      extractInviteToken(event.url);
    });

    return () => subscription.remove();
  }, []);

  if (isLoadingAuth) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Unauthenticated Navigation Flow
  if (!accessToken || !user) {
    // If viewing an invitation while unauthenticated
    if (authView === 'INVITE' && pendingInviteToken) {
      return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
          <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
          <InvitationAcceptScreen
            token={pendingInviteToken}
            onSuccess={async () => {
              setPendingInviteToken(null);
              await queryClient.invalidateQueries();
              setAppView('DASHBOARD');
            }}
            onCancel={() => {
              setPendingInviteToken(null);
              setAuthView('WELCOME');
            }}
            onNavigateToLogin={(prefilledEmail) => {
              if (prefilledEmail) setLoginInitialEmail(prefilledEmail);
              setAuthView('LOGIN');
            }}
            onNavigateToSignUp={(prefilledEmail) => {
              if (prefilledEmail) setLoginInitialEmail(prefilledEmail);
              setAuthView('SIGNUP');
            }}
          />
        </SafeAreaView>
      );
    }

    // Welcome screen is full-bleed (no SafeAreaView) for immersive hero
    if (authView === 'WELCOME') {
      return (
        <WelcomeScreen
          onNavigateToLogin={() => setAuthView('LOGIN')}
          onNavigateToSignUp={() => setAuthView('SIGNUP')}
          onOpenInviteCode={(code) => {
            setPendingInviteToken(code);
            setAuthView('INVITE');
          }}
        />
      );
    }

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        {authView === 'LOGIN' && (
          <LoginScreen
            initialEmail={loginInitialEmail}
            onNavigateBack={() => {
              if (pendingInviteToken) {
                setAuthView('INVITE');
              } else {
                setAuthView('WELCOME');
              }
            }}
            onNavigateToSignUp={() => setAuthView('SIGNUP')}
            onNavigateToMagicLink={() => setAuthView('MAGIC_LINK')}
            onNavigateToPasswordReset={(email) => {
              setPasswordResetEmail(email ?? '');
              setAuthView('PASSWORD_RESET');
            }}
          />
        )}
        {authView === 'SIGNUP' && (
          <SignUpScreen
            initialEmail={loginInitialEmail}
            onNavigateBack={() => {
              if (pendingInviteToken) {
                setAuthView('INVITE');
              } else {
                setAuthView('WELCOME');
              }
            }}
            onNavigateToLogin={() => setAuthView('LOGIN')}
          />
        )}
        {authView === 'MAGIC_LINK' && (
          <MagicLinkScreen onNavigateToLogin={() => setAuthView('LOGIN')} />
        )}
        {authView === 'PASSWORD_RESET' && (
          <PasswordResetScreen
            onNavigateToLogin={(email) => {
              if (email) {
                setLoginInitialEmail(email);
              }
              setAuthView('LOGIN');
            }}
            onNavigateBack={(email) => {
              if (email) {
                setLoginInitialEmail(email);
              }
              setAuthView('LOGIN');
            }}
            initialEmail={passwordResetEmail}
          />
        )}
      </SafeAreaView>
    );
  }

  // Authenticated Navigation Flow
  // If an invitation token is still pending, display the Invitation Accept screen so the logged-in user can accept
  if (pendingInviteToken) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <InvitationAcceptScreen
          token={pendingInviteToken}
          onSuccess={async () => {
            setPendingInviteToken(null);
            await queryClient.invalidateQueries();
            setAppView('DASHBOARD');
          }}
          onCancel={() => setPendingInviteToken(null)}
          onNavigateToLogin={(prefilledEmail) => {
            if (prefilledEmail) setLoginInitialEmail(prefilledEmail);
            setAuthView('LOGIN');
          }}
          onNavigateToSignUp={(prefilledEmail) => {
            if (prefilledEmail) setLoginInitialEmail(prefilledEmail);
            setAuthView('SIGNUP');
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      {appView === 'ONBOARDING' ? (
        <OnboardingScreen
          onComplete={() => {
            queryClient.invalidateQueries();
            setAppView('DASHBOARD');
          }}
        />
      ) : (
        <DashboardScreen
          onLogout={() => {
            queryClient.clear();
            setLoginInitialEmail('');
            setPendingInviteToken(null);
            setAuthView('WELCOME');
          }}
          onNavigateToOnboarding={() => setAppView('ONBOARDING')}
        />
      )}
    </SafeAreaView>
  );
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
    JetBrainsMono_400Regular,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A56DB" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MainNavigator />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
