import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { AuthUser } from '@rota/shared';

const ACCESS_TOKEN_KEY = 'rota_access_token';
const REFRESH_TOKEN_KEY = 'rota_refresh_token';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  selectedTeamId: string | null;
  isLoading: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<void>;
  setSelectedTeamId: (teamId: string | null) => void;
  logout: () => Promise<void>;
  loadSavedAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  selectedTeamId: null,
  isLoading: true,

  setAuth: async (user: AuthUser, accessToken: string, refreshToken: string) => {
    try {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    } catch {
      // In dev environment or tests without hardware keystore, continue
    }
    set({ user, accessToken, refreshToken, isLoading: false });
  },

  setSelectedTeamId: (selectedTeamId: string | null) => {
    set({ selectedTeamId });
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      // Ignore
    }
    set({ user: null, accessToken: null, refreshToken: null, selectedTeamId: null, isLoading: false });
  },

  loadSavedAuth: async () => {
    try {
      const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (accessToken && refreshToken) {
        set({ accessToken, refreshToken, isLoading: false });
        return;
      }
    } catch {
      // Fallback
    }
    set({ isLoading: false });
  },
}));
