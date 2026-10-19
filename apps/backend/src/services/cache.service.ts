import { redisConnection } from '../jobs/queue';
import { logger } from '../observability/logger';

/**
 * Cache TTL configuration constants in seconds.
 * PRD Assumption A6: 60-second team metadata cache TTL.
 */
export const CACHE_TTL = {
  TEAM_METADATA: 60,       // 60 seconds (PRD Assumption A6)
  TEAM_ROSTER: 120,        // 2 minutes
  USER_PROFILE: 120,       // 2 minutes
  USER_PREFERENCES: 300,   // 5 minutes
  USER_SETTINGS: 300,      // 5 minutes
  PLANS: 3600,             // 1 hour
} as const;

/**
 * Restricted keywords that must NEVER be cached in Redis.
 * AGENTS.md Rule 12 & PRD Section 7:
 * "Never cache active subscriptions, payment status, credit balances, or webhook idempotency records."
 */
const FORBIDDEN_CACHE_PATTERNS = [
  /subscription/i,
  /payment/i,
  /billing/i,
  /ledger/i,
  /credit/i,
  /webhook/i,
  /idempotency/i,
];

/**
 * Asserts that the cache key does not target restricted financial or webhook state.
 */
export function assertCacheKeyPermitted(key: string): void {
  for (const pattern of FORBIDDEN_CACHE_PATTERNS) {
    if (pattern.test(key)) {
      const errorMsg = `Security violation: Prohibited attempt to cache financial, payment, or webhook data in Redis (key: ${key})`;
      logger.error(errorMsg, undefined, { key });
      throw new Error(errorMsg);
    }
  }
}

/**
 * Cache-aside wrapper: checks Redis first; on miss, executes fetcher, caches result with TTL, and returns it.
 * Gracefully degrades to database fetcher if Redis encounters an error.
 */
export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  assertCacheKeyPermitted(key);

  try {
    const cached = await redisConnection.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    logger.warn('Redis cache lookup failed; falling back to primary query', {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Cache miss: execute underlying database fetcher
  const data = await fetcher();

  if (data !== undefined && data !== null) {
    try {
      await redisConnection.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    } catch (err) {
      logger.warn('Failed to set Redis cache value', {
        key,
        ttlSeconds,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return data;
}

/**
 * Explicit cache invalidation for a single key.
 */
export async function invalidateCache(key: string): Promise<void> {
  try {
    await redisConnection.del(key);
  } catch (err) {
    logger.warn('Failed to invalidate Redis cache key', {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Explicit cache invalidation for multiple keys.
 */
export async function invalidateCacheKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redisConnection.del(...keys);
  } catch (err) {
    logger.warn('Failed to invalidate Redis cache keys', {
      keys,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Explicit cache invalidation by prefix/pattern using non-blocking SCAN.
 */
export async function invalidateCachePrefix(pattern: string): Promise<void> {
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redisConnection.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redisConnection.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.warn('Failed to invalidate Redis cache pattern', {
      pattern,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
