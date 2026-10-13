export interface LogContext {
  requestId?: string;
  userId?: string;
  teamId?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'refreshToken',
  'accessToken',
  'secret',
  'authorization',
  'cookie',
]);

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      clean[key] = redact(val as Record<string, unknown>);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

export const logger = {
  info(message: string, context: LogContext = {}) {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({ level: 'INFO', timestamp, message, ...redact(context) }));
  },
  warn(message: string, context: LogContext = {}) {
    const timestamp = new Date().toISOString();
    console.warn(JSON.stringify({ level: 'WARN', timestamp, message, ...redact(context) }));
  },
  error(message: string, error?: unknown, context: LogContext = {}) {
    const timestamp = new Date().toISOString();
    const errorDetails = error instanceof Error
      ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
      : { rawError: String(error) };
    console.error(JSON.stringify({ level: 'ERROR', timestamp, message, ...errorDetails, ...redact(context) }));
  },
};
