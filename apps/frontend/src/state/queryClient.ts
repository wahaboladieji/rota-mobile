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
      retry: 2,
      refetchOnWindowFocus: true,
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
