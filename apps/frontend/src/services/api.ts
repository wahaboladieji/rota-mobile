import { useAuthStore } from '../state/authStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

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
    throw new Error((data as { error?: string }).error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export async function registerPushTokenApi(pushToken: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>('/devices/push-token', {
    method: 'POST',
    body: JSON.stringify({ pushToken }),
  });
}

export async function sendTestNotificationApi(pushToken?: string): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>('/notifications/test', {
    method: 'POST',
    body: JSON.stringify({ pushToken }),
  });
}
