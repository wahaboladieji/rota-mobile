import { useAuthStore } from '../state/authStore';
import { UserSettingsResponse, UserSettingsPatchInput } from '@rota/shared';
import { appConfig } from '../config';

const API_BASE_URL = appConfig.apiUrl;

export class ApiError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

let activeRefreshPromise: Promise<string | null> | null = null;

async function refreshAuthTokens(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) {
    return null;
  }

  try {
    const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshRes.ok) {
      const newTokens = (await refreshRes.json()) as { accessToken: string; refreshToken: string };
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        await useAuthStore.getState().setAuth(currentUser, newTokens.accessToken, newTokens.refreshToken);
      }
      return newTokens.accessToken;
    } else {
      await useAuthStore.getState().logout();
      return null;
    }
  } catch {
    await useAuthStore.getState().logout();
    return null;
  } finally {
    activeRefreshPromise = null;
  }
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { requiresAuth = true, headers: customHeaders = {}, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  const initialToken = useAuthStore.getState().accessToken;
  if (requiresAuth && initialToken) {
    headers['Authorization'] = `Bearer ${initialToken}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(url, { headers, ...rest });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Unable to reach server (${API_BASE_URL}): ${errorMsg}`);
  }

  // Handle 401 Unauthorized with single-flight token refresh
  if (response.status === 401 && requiresAuth) {
    const currentToken = useAuthStore.getState().accessToken;
    let newToken: string | null = null;

    // If another concurrent request already refreshed the access token while this was in flight
    if (currentToken && currentToken !== initialToken) {
      newToken = currentToken;
    } else {
      // Deduplicate refresh so only one request hits /api/auth/refresh
      if (!activeRefreshPromise) {
        activeRefreshPromise = refreshAuthTokens();
      }
      newToken = await activeRefreshPromise;
    }

    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      try {
        response = await fetch(url, { headers, ...rest });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        throw new Error(`Unable to reach server (${API_BASE_URL}): ${errorMsg}`);
      }
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorData = data as { error?: string; retryAfterSeconds?: number };
    let retryAfter = errorData.retryAfterSeconds;
    if (!retryAfter && response.headers.get('Retry-After')) {
      const parsed = parseInt(response.headers.get('Retry-After')!, 10);
      if (!isNaN(parsed) && parsed > 0) {
        retryAfter = parsed;
      }
    }
    const message = errorData.error || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, retryAfter);
  }

  return data as T;
}

export async function registerPushTokenApi(
  pushToken: string,
  oldPushToken?: string
): Promise<{ success: boolean; deviceId: string }> {
  return apiRequest<{ success: boolean; deviceId: string }>('/devices/push-token', {
    method: 'POST',
    body: JSON.stringify({ pushToken, oldPushToken }),
  });
}

export async function deletePushTokenApi(pushToken: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>('/devices/push-token', {
    method: 'DELETE',
    body: JSON.stringify({ pushToken }),
  });
}

export async function sendTestNotificationApi(pushToken?: string): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>('/notifications/test', {
    method: 'POST',
    body: JSON.stringify({ pushToken }),
  });
}

export async function getSettingsApi(): Promise<UserSettingsResponse> {
  return apiRequest<UserSettingsResponse>('/api/settings', {
    method: 'GET',
  });
}

export async function updateSettingsApi(patch: UserSettingsPatchInput): Promise<UserSettingsResponse> {
  return apiRequest<UserSettingsResponse>('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function logoutApi(pushToken?: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ pushToken }),
  });
}

