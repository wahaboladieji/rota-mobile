import { Request, Response, NextFunction } from 'express';
import { redisConnection } from '../jobs/queue';
import { logger } from '../observability/logger';
import { rateLimitConfig } from '../config';

export interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix: string;
  keyGenerator?: (req: Request) => string | string[];
  message?: string | ((retryAfter: number) => string);
  skip?: (req: Request) => boolean;
}

/**
 * Extracts and normalizes client IP address, supporting proxy headers.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Atomic Redis Lua script to increment counter and establish window TTL in a single roundtrip.
 * Prevents orphaned keys without TTL if node crashes between INCR and EXPIRE.
 */
const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`;

/**
 * Creates a Redis-backed distributed rate limiting middleware.
 * Uses atomic Lua script increments with TTL and graceful fail-open on Redis errors.
 * Supports dual/multi-dimensional keys (e.g. per-user AND per-IP).
 */
export function createRateLimiter(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Check if skipped (e.g., in test mode or bypass conditions)
    if (options.skip && options.skip(req)) {
      return next();
    }

    const ip = getClientIp(req);
    const idResult = options.keyGenerator ? options.keyGenerator(req) : ip;
    const identifiers = Array.isArray(idResult) ? idResult : [idResult];

    try {
      let maxCount = 0;
      let maxTtl = 0;
      let rateLimitedKey: string | null = null;

      for (const id of identifiers) {
        const fullKey = `rl:${options.keyPrefix}:${id}`;
        const [count, ttl] = (await redisConnection.eval(
          RATE_LIMIT_LUA,
          1,
          fullKey,
          options.windowSeconds
        )) as [number, number];

        if (count > maxCount) maxCount = count;
        if (ttl > maxTtl) maxTtl = ttl;

        if (count > options.maxRequests) {
          rateLimitedKey = fullKey;
          break;
        }
      }

      const retryAfter = maxTtl > 0 ? maxTtl : options.windowSeconds;
      const remaining = Math.max(0, options.maxRequests - maxCount);

      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + retryAfter);

      if (maxCount > options.maxRequests) {
        logger.warn('Rate limit exceeded', {
          key: rateLimitedKey,
          count: maxCount,
          max: options.maxRequests,
          ip,
          path: req.originalUrl || req.path,
        });

        const errorMessage =
          typeof options.message === 'function'
            ? options.message(retryAfter)
            : options.message ||
              `Too many requests. Please try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`;

        res.setHeader('Retry-After', retryAfter);
        res.status(429).json({
          error: errorMessage,
          retryAfterSeconds: retryAfter,
        });
        return;
      }

      next();
    } catch (err: unknown) {
      // Graceful fail-open: do not block legitimate requests if Redis is temporarily unreachable
      logger.warn('Redis rate limiter encountered an error; failing open', {
        identifiers,
        error: err instanceof Error ? err.message : String(err),
      });
      next();
    }
  };
}

const isTestEnv = () => process.env.NODE_ENV === 'test';
const testOptInSkip = (req: Request) => isTestEnv() && !req.headers['x-test-rate-limit'];

/**
 * Rate Limiter for Login Endpoint
 * Dual-tier protection: limits by IP AND by normalized email.
 */
export const loginRateLimiter = createRateLimiter({
  keyPrefix: 'login',
  windowSeconds: rateLimitConfig.login.windowSeconds,
  maxRequests: rateLimitConfig.login.maxRequests,
  keyGenerator: (req: Request) => {
    const ip = getClientIp(req);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'no-email';
    return `${ip}:${email}`;
  },
  message: (retryAfter: number) =>
    `Too many login attempts. Please try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
  skip: testOptInSkip,
});

/**
 * Rate Limiter for Password Reset & Magic Link Requests
 * Scoped by IP address and normalized email.
 */
export const passwordResetRateLimiter = createRateLimiter({
  keyPrefix: 'reset',
  windowSeconds: rateLimitConfig.passwordReset.windowSeconds,
  maxRequests: rateLimitConfig.passwordReset.maxRequests,
  keyGenerator: (req: Request) => {
    const ip = getClientIp(req);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'no-email';
    return `${ip}:${email}`;
  },
  message: (retryAfter: number) =>
    `Too many password reset requests. Please try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
  skip: testOptInSkip,
});

/**
 * Rate Limiter for Team Member Invitations
 * Scoped by team, user ID, and IP address.
 */
export const invitationsRateLimiter = createRateLimiter({
  keyPrefix: 'invite',
  windowSeconds: rateLimitConfig.invitations.windowSeconds,
  maxRequests: rateLimitConfig.invitations.maxRequests,
  keyGenerator: (req: Request) => {
    const teamId = (req.params.teamId || 'global') as string;
    const ip = getClientIp(req);
    const user = (req as unknown as { user?: { userId: string } }).user;
    return user?.userId ? [`team:${teamId}`, `user:${user.userId}`, `ip:${ip}`] : [`team:${teamId}`, `ip:${ip}`];
  },
  message: (retryAfter: number) =>
    `Too many invitations sent from this team. Please try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
  skip: testOptInSkip,
});

/**
 * Rate Limiter for Payment Initiation
 * Scoped by team, user ID, and IP address.
 */
export const paymentInitiateRateLimiter = createRateLimiter({
  keyPrefix: 'payment_init',
  windowSeconds: rateLimitConfig.paymentInitiate.windowSeconds,
  maxRequests: rateLimitConfig.paymentInitiate.maxRequests,
  keyGenerator: (req: Request) => {
    const teamId = (req.params.teamId || 'global') as string;
    const ip = getClientIp(req);
    const user = (req as unknown as { user?: { userId: string } }).user;
    return user?.userId ? [`team:${teamId}`, `user:${user.userId}`, `ip:${ip}`] : [`team:${teamId}`, `ip:${ip}`];
  },
  message: (retryAfter: number) =>
    `Too many payment attempts initiated for this team. Please try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
  skip: testOptInSkip,
});

/**
 * General API Rate Limiter
 * Per-User (if authenticated) and Per-IP distributed rate limiter.
 */
export const generalApiRateLimiter = createRateLimiter({
  keyPrefix: 'general',
  windowSeconds: rateLimitConfig.general.windowSeconds,
  maxRequests: rateLimitConfig.general.maxRequests,
  keyGenerator: (req: Request) => {
    const ip = getClientIp(req);
    const user = (req as unknown as { user?: { userId: string } }).user;
    return user?.userId ? [`user:${user.userId}`, `ip:${ip}`] : `ip:${ip}`;
  },
  message: (retryAfter: number) =>
    `Too many requests. Please try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
  skip: testOptInSkip,
});
