import { QueryClient } from '@tanstack/react-query';

/**
 * Central TanStack Query Client for Rota Mobile.
 * Configured per PRD F5.1 starting stale times:
 * - calendar: 60 seconds
 * - roster: 5 minutes (300 seconds)
 * - feed: 30 seconds
 * - settings & subscription: refetched on access / foreground (staleTime: 0)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 60 seconds default
      gcTime: 10 * 60 * 1000, // 10 minutes cache retention
      retry: (failureCount, error: any) => {
        // Do not retry 401 or 403 authorization failures
        const msg = error?.message || '';
        if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized') || msg.includes('Forbidden')) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false, // Prevent continuous query storms when focusing or modal switching
      refetchOnReconnect: true,
    },
  },
});

export const QUERY_KEYS = {
  ME: ['me'],
  TEAM: (teamId: string) => ['team', teamId],
  ROSTER: (teamId: string) => ['roster', teamId],
  SHIFTS: (teamId: string) => ['shifts', teamId],
  FEED: (teamId: string) => ['feed', teamId],
  SETTINGS: ['settings'],
  SUBSCRIPTION: (teamId: string) => ['subscription', teamId],
};
