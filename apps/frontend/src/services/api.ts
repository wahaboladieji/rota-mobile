import { useAuthStore } from '../state/authStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { requiresAuth = true, headers: customHeaders = {}, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (requiresAuth) {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const url = `${API_BASE_URL}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(url, { headers, ...rest });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Unable to reach server (${API_BASE_URL}): ${errorMsg}`);
  }

  // Handle 401 Unauthorized with token refresh attempt
  if (response.status === 401 && requiresAuth) {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken) {
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
            // Retry original request with new access token
            headers['Authorization'] = `Bearer ${newTokens.accessToken}`;
            response = await fetch(url, { headers, ...rest });
          }
        } else {
          // Refresh token invalid or compromised: log out
          await useAuthStore.getState().logout();
        }
      } catch {
        await useAuthStore.getState().logout();
      }
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `Request failed with status ${response.status}`);
  }

  return data as T;
}
