import { create } from 'zustand';
import { AuthUser } from '@rota/shared';
import { appConfig } from '../config';

// Safe wrapper for SecureStore to prevent crashes when running in Expo Go or builds without the native module compiled
let SecureStore: typeof import('expo-secure-store') | null = null;
try {
  SecureStore = require('expo-secure-store');
} catch (e) {
  console.warn('[SecureStore] ExpoSecureStore native module unavailable in this build:', e);
}

const ACCESS_TOKEN_KEY = 'rota_access_token';
const REFRESH_TOKEN_KEY = 'rota_refresh_token';
const USER_PROFILE_KEY = 'rota_user_profile';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  selectedTeamId: string | null;
  isLoading: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<void>;
  setUser: (user: AuthUser) => void;
  setSelectedTeamId: (teamId: string | null) => void;
  logout: () => Promise<void>;
  loadSavedAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  selectedTeamId: null,
  isLoading: true,

  setAuth: async (user: AuthUser, accessToken: string, refreshToken: string) => {
    if (SecureStore) {
      try {
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
        await SecureStore.setItemAsync(USER_PROFILE_KEY, JSON.stringify(user));
      } catch {
        // In dev environment or tests without hardware keystore, continue
      }
    }
    set({ user, accessToken, refreshToken, isLoading: false });
  },

  setUser: (user: AuthUser) => {
    if (SecureStore) {
      try {
        SecureStore.setItemAsync(USER_PROFILE_KEY, JSON.stringify(user));
      } catch {
        // Ignore
      }
    }
    set({ user });
  },

  setSelectedTeamId: (selectedTeamId: string | null) => {
    set({ selectedTeamId });
  },

  logout: async () => {
    const currentToken = get().accessToken;
    if (currentToken) {
      fetch(`${appConfig.apiUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
      }).catch(() => {});
    }

    if (SecureStore) {
      try {
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_PROFILE_KEY);
      } catch {
        // Ignore
      }
    }
    set({ user: null, accessToken: null, refreshToken: null, selectedTeamId: null, isLoading: false });
  },

  loadSavedAuth: async () => {
    if (SecureStore) {
      try {
        const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        const userRaw = await SecureStore.getItemAsync(USER_PROFILE_KEY);
        let user: AuthUser | null = null;
        if (userRaw) {
          try {
            user = JSON.parse(userRaw);
          } catch {
            // Ignore parse error
          }
        }

        if (accessToken && refreshToken) {
          set({ user, accessToken, refreshToken, isLoading: false });
          return;
        }
      } catch {
        // Fallback
      }
    }
    set({ isLoading: false });
  },
}));
