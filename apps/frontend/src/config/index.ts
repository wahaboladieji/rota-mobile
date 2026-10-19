/**
 * Centralized configuration for Rota Mobile Application.
 *
 * Security & Disclosure Notice (AGENTS.md Rule 20 & SECURITY.md Threat 3):
 * Every `EXPO_PUBLIC_*` variable is bundled into the client code and is fully public.
 * ONLY public endpoints and telemetry keys may be exposed here.
 * NEVER place server secrets, database credentials, or provider signing keys here.
 */

export const appConfig = {
  /**
   * The base URL for the Rota backend Express API.
   * Can be configured per environment (e.g. staging, local dev IP, production).
   */
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',

  /**
   * Optional Sentry client DSN for mobile crash reporting and telemetry.
   */
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',

  /**
   * Approved offline shift cache window (PRD F5.3 & AGENTS.md Rule 17: exactly 14 days).
   */
  offlineSnapshotDays: 14,
};
