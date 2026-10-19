import request from 'supertest';
import { app } from '../src/app';
import { redisConnection, closeQueue } from '../src/jobs/queue';
import { prismaPrimary } from '../src/data/db';

describe('Distributed Redis Rate Limiting (PRD Requirement 4 & AGENTS.md Rule 19)', () => {
  const testIp = '198.51.100.42';
  const testEmail = `ratelimit-${Date.now()}@example.com`;
  const normalizedKey = `rl:login:${testIp}:${testEmail.toLowerCase()}`;

  beforeAll(async () => {
    // Ensure clean state for our test key
    await redisConnection.del(normalizedKey);
  });

  afterAll(async () => {
    await redisConnection.del(normalizedKey);
    await closeQueue();
    await prismaPrimary.$disconnect();
  });

  it('allows requests within the limit and includes X-RateLimit headers', async () => {
    // Send 1st attempt
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', testIp)
      .set('X-Test-Rate-Limit', 'true')
      .send({ email: testEmail, password: 'WrongPassword1!' });

    // Expect 401 because credentials are intentionally invalid, but NOT 429
    expect(res.status).toBe(401);
    expect(res.headers['x-ratelimit-limit']).toBe('5');
    expect(res.headers['x-ratelimit-remaining']).toBe('4');
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('enforces shared Redis limit across sequential requests and returns HTTP 429 when exhausted', async () => {
    // Send 4 more attempts to reach the 5-request limit
    for (let i = 2; i <= 5; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', testIp)
      .set('X-Test-Rate-Limit', 'true')
        .send({ email: testEmail, password: 'WrongPassword1!' });

      expect(res.status).toBe(401);
      expect(res.headers['x-ratelimit-remaining']).toBe(String(5 - i));
    }

    // 6th attempt should be rejected with 429 Too Many Requests
    const blockedRes = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', testIp)
      .set('X-Test-Rate-Limit', 'true')
      .send({ email: testEmail, password: 'WrongPassword1!' });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error).toMatch(/too many login attempts|too many requests/i);
    expect(blockedRes.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(blockedRes.headers['retry-after']).toBeDefined();
    expect(blockedRes.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('verifies distributed Redis state is shared across requests targeting the same namespace', async () => {
    const redisCount = await redisConnection.get(normalizedKey);
    expect(Number(redisCount)).toBeGreaterThanOrEqual(6);

    const ttl = await redisConnection.ttl(normalizedKey);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(15 * 60);
  });

  it('resets and allows requests again once the rate-limit window expires or key is cleared', async () => {
    // Simulate window expiry by deleting the Redis counter
    await redisConnection.del(normalizedKey);

    const resetRes = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', testIp)
      .set('X-Test-Rate-Limit', 'true')
      .send({ email: testEmail, password: 'WrongPassword1!' });

    expect(resetRes.status).toBe(401); // Normal auth rejection, NOT 429
    expect(resetRes.headers['x-ratelimit-remaining']).toBe('4');
  });
});
