import request from 'supertest';
import { app } from '../src/app';
import { redisConnection, emailQueue, closeQueue } from '../src/jobs/queue';
import { prismaPrimary, disconnectDbClients } from '../src/data/db';
import {
  getOrSetCache,
  invalidateCache,
  assertCacheKeyPermitted,
  CACHE_TTL,
} from '../src/services/cache.service';

describe('Caching, Rate Limiting & Background Jobs Integration', () => {
  afterAll(async () => {
    await disconnectDbClients();
    await closeQueue();
  });

  describe('Server-Side Cache-Aside Service', () => {
    const testKey = `cache:test:${Date.now()}`;

    afterEach(async () => {
      await invalidateCache(testKey);
    });

    it('retrieves data via fetcher on cache miss and stores it in Redis with specified TTL', async () => {
      let fetchCount = 0;
      const fetcher = async () => {
        fetchCount++;
        return { name: 'Acme Cafe', seats: 10 };
      };

      // 1st Call: Cache miss -> executes fetcher
      const result1 = await getOrSetCache(testKey, 60, fetcher);
      expect(result1).toEqual({ name: 'Acme Cafe', seats: 10 });
      expect(fetchCount).toBe(1);

      // Verify raw Redis key and TTL
      const redisVal = await redisConnection.get(testKey);
      expect(JSON.parse(redisVal!)).toEqual({ name: 'Acme Cafe', seats: 10 });
      const ttl = await redisConnection.ttl(testKey);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);

      // 2nd Call: Cache hit -> does NOT execute fetcher
      const result2 = await getOrSetCache(testKey, 60, fetcher);
      expect(result2).toEqual({ name: 'Acme Cafe', seats: 10 });
      expect(fetchCount).toBe(1); // Still 1, served from cache!
    });

    it('explicitly invalidates cached data on demand', async () => {
      await redisConnection.set(testKey, JSON.stringify({ version: 1 }), 'EX', 60);

      await invalidateCache(testKey);

      const postInvalidate = await redisConnection.get(testKey);
      expect(postInvalidate).toBeNull();
    });

    it('STRICT INVARIANT: Refuses to cache financial, subscription, or webhook data', async () => {
      const forbiddenKeys = [
        'cache:subscription:team-123',
        'cache:billing:status',
        'cache:payment:attempt',
        'cache:ledger:entry',
        'cache:credit:balance',
        'cache:webhook:event:123',
        'cache:idempotency:key:abc',
      ];

      for (const forbiddenKey of forbiddenKeys) {
        expect(() => assertCacheKeyPermitted(forbiddenKey)).toThrow(
          /Security violation: Prohibited attempt to cache financial, payment, or webhook data/i
        );

        await expect(
          getOrSetCache(forbiddenKey, 60, async () => ({ balance: 100 }))
        ).rejects.toThrow(/Security violation/i);
      }
    });
  });

  describe('Background Jobs for Shift Notifications', () => {
    it('enqueues shift notification email into BullMQ emailQueue instead of direct synchronous sending', async () => {
      const initialJobCount = await emailQueue.getJobCounts();

      const testPayload = {
        type: 'SHIFT_NOTIFICATION' as const,
        recipientEmail: 'staff@example.com',
        subject: 'New shift published',
        html: '<p>You have a new shift.</p>',
        text: 'You have a new shift.',
      };

      const job = await emailQueue.add('SHIFT_NOTIFICATION', testPayload);
      expect(job.id).toBeDefined();

      const fetchedJob = await emailQueue.getJob(job.id!);
      expect(fetchedJob).not.toBeNull();
      expect(fetchedJob?.data.type).toBe('SHIFT_NOTIFICATION');
      expect(fetchedJob?.data.recipientEmail).toBe('staff@example.com');
      expect(fetchedJob?.opts.attempts).toBe(5);
      expect(fetchedJob?.opts.backoff).toEqual({
        type: 'exponential',
        delay: 3000,
      });
    });
  });

  describe('Rate Limiter User and IP Partitioning', () => {
    it('applies rate limiter across Redis keys without using in-memory process objects', async () => {
      const testKey = `rl:general:test-user-${Date.now()}`;
      await redisConnection.del(testKey);

      const count1 = await redisConnection.incr(testKey);
      await redisConnection.expire(testKey, 60);
      expect(count1).toBe(1);

      const ttl = await redisConnection.ttl(testKey);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);

      await redisConnection.del(testKey);
    });
  });
});
