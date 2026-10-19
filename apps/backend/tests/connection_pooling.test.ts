import request from 'supertest';
import { app } from '../src/app';
import {
  formatPooledDatabaseUrl,
  redactDatabaseUrl,
  prismaPrimary,
  prismaReplica,
  disconnectDbClients,
} from '../src/data/db';
import { redisConnection } from '../src/jobs/queue';
import { PrismaClient } from '@prisma/client';

describe('Database Connection Pooling & Bounded Waiting', () => {
  afterAll(async () => {
    await disconnectDbClients();
    await redisConnection.quit().catch(() => {});
  });

  describe('URL Builder and Credentials Redaction', () => {
    it('correctly sets connection_limit, pool_timeout, and connect_timeout on connection URLs', () => {
      const rawUrl = 'postgresql://admin:secretPass@localhost:5432/rota_dev?schema=public';
      const pooledUrl = formatPooledDatabaseUrl(rawUrl, {
        connectionLimit: 10,
        poolTimeoutSeconds: 5,
        connectTimeoutSeconds: 5,
      });

      const parsed = new URL(pooledUrl);
      expect(parsed.searchParams.get('connection_limit')).toBe('10');
      expect(parsed.searchParams.get('pool_timeout')).toBe('5');
      expect(parsed.searchParams.get('connect_timeout')).toBe('5');
      expect(parsed.searchParams.get('schema')).toBe('public');
      expect(parsed.password).toBe('secretPass');
    });

    it('redacts database credentials in URLs for logging and telemetry', () => {
      const rawUrl = 'postgresql://admin:superSecretPassword@localhost:5432/rota_dev?schema=public';
      const masked = redactDatabaseUrl(rawUrl);

      expect(masked).not.toContain('superSecretPassword');
      expect(masked).toContain('admin:***@localhost:5432');
    });
  });

  describe('Health Check Pool Diagnostics', () => {
    it('returns masked connection pool configuration without leaking credentials', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.pool).toBeDefined();
      expect(res.body.pool.primaryPoolSize).toBeGreaterThan(0);
      expect(res.body.pool.poolTimeoutSeconds).toBeGreaterThan(0);
      expect(res.body.pool.primaryUrlMasked).not.toContain('password');
      expect(res.body.pool.primaryUrlMasked).toContain('connection_limit');
    });
  });

  describe('Bounded Waiting and Pool Exhaustion Handling', () => {
    it('times out and throws P2024 when connection acquisition exceeds pool_timeout', async () => {
      // Create a test client with connection_limit=1 and pool_timeout=1
      const testUrl = formatPooledDatabaseUrl(
        process.env.DATABASE_URL || 'postgresql://admin@localhost:5432/rota_test?schema=public',
        {
          connectionLimit: 1,
          poolTimeoutSeconds: 1,
          connectTimeoutSeconds: 1,
        }
      );

      const constrainedClient = new PrismaClient({
        datasources: { db: { url: testUrl } },
      });

      try {
        let secondQueryFailedWithP2024 = false;

        // Hold the single connection open for 2 seconds
        const holdingPromise = constrainedClient.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT pg_sleep(2)::text`;
        });

        // Delay 100ms so holdingPromise acquires the only connection
        await new Promise((r) => setTimeout(r, 100));

        // Second query attempts to acquire a connection, must time out after 1 second
        try {
          await constrainedClient.$queryRaw`SELECT 1 as test`;
        } catch (err: unknown) {
          const error = err as { code?: string; message?: string };
          if (error.code === 'P2024' || error.message?.includes('Timed out fetching a new connection')) {
            secondQueryFailedWithP2024 = true;
          }
        }

        await holdingPromise;
        expect(secondQueryFailedWithP2024).toBe(true);
      } finally {
        await constrainedClient.$disconnect();
      }
    });

    it('returns HTTP 503 with Retry-After when P2024 error is caught by error handler', async () => {
      // Simulate error reaching the Express error middleware
      const dummyReq = { headers: {} } as any;
      let statusCode = 0;
      let responseBody: any = null;
      let retryAfterHeader = '';

      const dummyRes = {
        setHeader: (name: string, val: string) => {
          if (name.toLowerCase() === 'retry-after') retryAfterHeader = val;
        },
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              responseBody = body;
            },
          };
        },
      } as any;

      const p2024Error = new Error('Timed out fetching a new connection from the connection pool');
      (p2024Error as any).code = 'P2024';

      // Call the app's error router
      const errorHandler = (app as any)._router.stack.filter((layer: any) => layer.handle.length === 4).pop()?.handle;

      expect(errorHandler).toBeDefined();
      errorHandler(p2024Error, dummyReq, dummyRes, () => {});

      expect(statusCode).toBe(503);
      expect(retryAfterHeader).toBe('1');
      expect(responseBody.code).toBe('POOL_EXHAUSTED');
      expect(responseBody.error).toContain('temporarily saturated');
    });
  });
});
