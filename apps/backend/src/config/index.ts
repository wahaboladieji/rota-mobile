import dotenv from 'dotenv';
dotenv.config();

/**
 * Centralized, typed configuration for Rota Backend.
 * Every changeable operational, security, scheduling, rate limiting, and retention value is loaded
 * from environment variables with sensible, production-ready fallback defaults.
 */

export const serverConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiBaseUrl: process.env.API_BASE_URL || 'http://192.168.0.165:3000',
  appBaseUrl: process.env.APP_BASE_URL || 'rota://',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://admin@localhost:5432/rota_dev?schema=public',
  databaseReplicaUrl: process.env.DATABASE_REPLICA_URL || process.env.DATABASE_URL || 'postgresql://admin@localhost:5432/rota_dev?schema=public',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  sentryDsn: process.env.SENTRY_DSN || '',
  dbMaxLagToleranceMs: parseInt(process.env.DB_MAX_LAG_TOLERANCE_MS || '5000', 10),
  // Database Connection Pooling parameters (PRD A6, T1)
  dbPrimaryPoolSize: parseInt(process.env.DB_PRIMARY_POOL_SIZE || process.env.DB_POOL_SIZE || '10', 10),
  dbReplicaPoolSize: parseInt(process.env.DB_REPLICA_POOL_SIZE || process.env.DB_POOL_SIZE || '10', 10),
  dbWorkerPoolSize: parseInt(process.env.DB_WORKER_POOL_SIZE || '5', 10),
  dbPoolTimeoutSeconds: parseInt(process.env.DB_POOL_TIMEOUT_SECONDS || '5', 10),
  dbConnectTimeoutSeconds: parseInt(process.env.DB_CONNECT_TIMEOUT_SECONDS || '5', 10),
};

export const authConfig = {
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'rota-dev-access-secret-at-least-32-chars-long',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'rota-dev-refresh-secret-at-least-32-chars-long',
  accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  accessTokenExpiresInSeconds: parseInt(process.env.JWT_ACCESS_EXPIRES_IN_SECONDS || String(15 * 60), 10),
  refreshTokenExpiresInSeconds: parseInt(process.env.JWT_REFRESH_EXPIRES_IN_SECONDS || String(30 * 24 * 60 * 60), 10),
  magicLinkExpiresInSeconds: parseInt(process.env.MAGIC_LINK_EXPIRES_IN_SECONDS || String(15 * 60), 10),
  passwordResetExpiresInSeconds: parseInt(process.env.PASSWORD_RESET_EXPIRES_IN_SECONDS || String(60 * 60), 10),
  invitationExpiresInSeconds: parseInt(process.env.INVITATION_EXPIRES_IN_SECONDS || String(7 * 24 * 60 * 60), 10),
  verificationCodeExpiresInSeconds: parseInt(process.env.VERIFICATION_CODE_EXPIRES_IN_SECONDS || String(5 * 60), 10),
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
};

export const rateLimitConfig = {
  login: {
    maxRequests: parseInt(process.env.RL_LOGIN_MAX || '5', 10),
    windowSeconds: parseInt(process.env.RL_LOGIN_WINDOW || String(15 * 60), 10),
  },
  passwordReset: {
    maxRequests: parseInt(process.env.RL_RESET_MAX || '3', 10),
    windowSeconds: parseInt(process.env.RL_RESET_WINDOW || String(15 * 60), 10),
  },
  invitations: {
    maxRequests: parseInt(process.env.RL_INVITE_MAX || '15', 10),
    windowSeconds: parseInt(process.env.RL_INVITE_WINDOW || String(60 * 60), 10),
  },
  paymentInitiate: {
    maxRequests: parseInt(process.env.RL_PAY_MAX || '10', 10),
    windowSeconds: parseInt(process.env.RL_PAY_WINDOW || String(60 * 60), 10),
  },
  general: {
    maxRequests: parseInt(process.env.RL_GENERAL_MAX || '200', 10),
    windowSeconds: parseInt(process.env.RL_GENERAL_WINDOW || '60', 10),
  },
};

/**
 * Data retention periods (in days).
 * AGENTS.md Rule 20: "Never hard-code retention as an unchangeable constant."
 */
export const retentionConfig = {
  activityEventsDays: parseInt(process.env.RETENTION_ACTIVITY_EVENTS_DAYS || '365', 10), // 12 months
  logsDays: parseInt(process.env.RETENTION_LOGS_DAYS || '30', 10),                       // 30 days
  failedJobsDays: parseInt(process.env.RETENTION_FAILED_JOBS_DAYS || '30', 10),           // 30 days
  rawWebhooksDays: parseInt(process.env.RETENTION_RAW_WEBHOOKS_DAYS || '90', 10),        // 90 days
  permanent: ['LEDGER_ENTRIES', 'WEBHOOK_EVENT_IDS'] as const,
};

export const schedulingConfig = {
  maxHorizonWeeks: parseInt(process.env.SHIFT_MAX_HORIZON_WEEKS || '8', 10),
  offlineSnapshotDays: parseInt(process.env.OFFLINE_SNAPSHOT_DAYS || '14', 10),
  urgentShiftThresholdHours: parseInt(process.env.URGENT_SHIFT_THRESHOLD_HOURS || '12', 10),
  subscriptionGracePeriodDays: parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS || '7', 10),
  baselineBillingPeriodDays: parseInt(process.env.BASELINE_BILLING_PERIOD_DAYS || '30', 10),
};

export const providerConfig = {
  brevoApiKey: process.env.BREVO_API_KEY || '',
  brevoFrom: process.env.BREVO_FROM || process.env.SMTP_FROM || 'Rota <noreply@rota.app>',
  flutterwavePublicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || '',
  flutterwaveSecretKey: process.env.FLUTTERWAVE_SECRET_KEY || '',
  flutterwaveEncryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY || '',
  flutterwaveSecretHash: process.env.FLUTTERWAVE_SECRET_HASH || '',
};

export const defaultUserSettings = {
  timeZone: process.env.DEFAULT_TIMEZONE || 'Africa/Lagos',
  quietStart: process.env.DEFAULT_QUIET_START || '22:00',
  quietEnd: process.env.DEFAULT_QUIET_END || '07:00',
  language: process.env.DEFAULT_LANGUAGE || 'en',
  theme: process.env.DEFAULT_THEME || 'system',
};
