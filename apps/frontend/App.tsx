import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, SafeAreaView, StyleSheet, StatusBar, Linking, Platform, AppState } from 'react-native';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
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
import { queryClient, QUERY_KEYS } from './src/state/queryClient';
import { useAuthStore } from './src/state/authStore';
import { LoginScreen } from './src/features/auth/LoginScreen';
import { SignUpScreen } from './src/features/auth/SignUpScreen';
import { MagicLinkScreen } from './src/features/auth/MagicLinkScreen';
import { PasswordResetScreen } from './src/features/auth/PasswordResetScreen';
import { OnboardingScreen } from './src/features/onboarding/OnboardingScreen';
import { WelcomeScreen } from './src/features/welcome/WelcomeScreen';
import { DashboardScreen } from './src/features/dashboard/DashboardScreen';
import { InvitationAcceptScreen } from './src/features/invitation/InvitationAcceptScreen';
import { registerForPushNotificationsAsync } from './src/services/notifications';
import { registerPushTokenApi, getSettingsApi } from './src/services/api';

type AuthView = 'WELCOME' | 'LOGIN' | 'SIGNUP' | 'MAGIC_LINK' | 'PASSWORD_RESET' | 'INVITE';
type AppView = 'ONBOARDING' | 'DASHBOARD';

const MainNavigator: React.FC = () => {
  const { colors, isDark } = useTheme();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isLoadingAuth = useAuthStore((state) => state.isLoading);
  const loadSavedAuth = useAuthStore((state) => state.loadSavedAuth);

  const [authView, setAuthView] = useState<AuthView>('WELCOME');
  const [appView, setAppView] = useState<AppView>('DASHBOARD');
  const [dashboardTab, setDashboardTab] = useState<'HOME' | 'SCHEDULE' | 'SWAPS' | 'ACTIVITY' | 'MORE'>('HOME');
  const [passwordResetEmail, setPasswordResetEmail] = useState('');
  const [loginInitialEmail, setLoginInitialEmail] = useState('');
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);

  const [pendingNotificationTarget, setPendingNotificationTarget] = useState<any>(null);

  useEffect(() => {
    loadSavedAuth();
  }, [loadSavedAuth]);

  // Foreground listener: refetch server settings on app foreground (PRD F7.4)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SETTINGS });
      }
    });
    return () => sub.remove();
  }, []);

  // Register push notifications when user is authenticated
  useEffect(() => {
    if (accessToken && user) {
      registerForPushNotificationsAsync().then((pushToken) => {
        if (pushToken) {
          registerPushTokenApi(pushToken).catch((err) => {
            console.warn('[PushToken] Failed to register push token with backend:', err);
          });
        }
      });
    }
  }, [accessToken, user]);

  const handleNotificationData = (data: any) => {
    if (!data || typeof data !== 'object') return;
    console.log('[NotificationTap] Handling deep-link target:', data);

    const targetTeamId = data.teamId;
    if (targetTeamId) {
      useAuthStore.getState().setSelectedTeamId(targetTeamId);
    }

    const screen = data.screen || (data.group === 'SHIFT' ? 'SHIFTS' : data.group === 'SWAP' ? 'SWAPS' : 'HOME');

    if (screen === 'SHIFTS' || screen === 'SCHEDULE') {
      setDashboardTab('SCHEDULE');
    } else if (screen === 'SWAPS') {
      setDashboardTab('SWAPS');
    } else if (screen === 'ACTIVITY') {
      setDashboardTab('ACTIVITY');
    } else if (screen === 'BILLING') {
      setDashboardTab('MORE');
    }
  };

  // Check if there was a pending deep-link awaiting authentication
  useEffect(() => {
    if (accessToken && user && pendingNotificationTarget) {
      handleNotificationData(pendingNotificationTarget);
      setPendingNotificationTarget(null);
    }
  }, [accessToken, user, pendingNotificationTarget]);

  // Push notification tap listener (Deep linking into exact screens when app is warm/backgrounded)
  useEffect(() => {
    let Notifications: typeof import('expo-notifications') | null = null;
    try {
      Notifications = require('expo-notifications');
    } catch {
      // Native module unavailable
    }

    if (Notifications && typeof Notifications.addNotificationResponseReceivedListener === 'function') {
      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        try {
          const data = response.notification.request.content.data;
          if (!useAuthStore.getState().accessToken) {
            setPendingNotificationTarget(data);
          } else {
            handleNotificationData(data);
          }
        } catch (e) {
          console.warn('[NotificationTap] Error handling tap:', e);
        }
      });

      // Cold launch handler: check if app was opened directly from a notification tap
      if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
        Notifications.getLastNotificationResponseAsync().then((response) => {
          if (response) {
            const data = response.notification.request.content.data;
            if (!useAuthStore.getState().accessToken) {
              setPendingNotificationTarget(data);
            } else {
              handleNotificationData(data);
            }
          }
        }).catch(() => {});
      }

      return () => subscription.remove();
    }
  }, []);

  // Deep linking listener for invitation links (rota://invite/:token, exp://.../--/invite/:token, http(s)://.../invite/:token)
  useEffect(() => {
    const handleDeepLinkUrl = (url: string | null) => {
      if (!url) return;
      try {
        if (url.includes('billing/callback')) {
          queryClient.invalidateQueries();
          return;
        }

        const match = url.match(/invite\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          setPendingInviteToken(match[1]);
          setAuthView('INVITE');
        }
      } catch {
        // Ignored
      }
    };

    Linking.getInitialURL().then(handleDeepLinkUrl);

    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLinkUrl(event.url);
    });

    return () => subscription.remove();
  }, [queryClient]);

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
          <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
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
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
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
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      {appView === 'ONBOARDING' ? (
        <OnboardingScreen
          onComplete={() => {
            queryClient.invalidateQueries();
            setAppView('DASHBOARD');
          }}
        />
      ) : (
        <DashboardScreen
          initialTab={dashboardTab}
          onLogout={() => {
            queryClient.clear();
            setLoginInitialEmail('');
            setPendingInviteToken(null);
            setDashboardTab('HOME');
            setAuthView('WELCOME');
          }}
          onNavigateToOnboarding={() => setAppView('ONBOARDING')}
        />
      )}
    </SafeAreaView>
  );
};

const ThemedAppContainer: React.FC = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { data: serverSettings } = useQuery({
    queryKey: QUERY_KEYS.SETTINGS,
    queryFn: getSettingsApi,
    staleTime: 60000,
    enabled: Boolean(accessToken),
  });

  const forcedTheme = (serverSettings?.theme?.toLowerCase() as 'light' | 'dark' | 'system') || undefined;

  return (
    <ThemeProvider forcedTheme={forcedTheme}>
      <MainNavigator />
    </ThemeProvider>
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
      <ThemedAppContainer />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
