import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { authRouter } from './routes/auth.routes';
import { teamsRouter } from './routes/teams.routes';
import { invitationsRouter } from './routes/invitations.routes';
import { shiftsRouter } from './routes/shifts.routes';
import { swapsRouter } from './routes/swaps.routes';
import { preferencesRouter } from './routes/preferences.routes';
import { activityRouter } from './routes/activity.routes';
import { devicesRouter } from './routes/devices.routes';
import { webhooksRouter } from './routes/webhooks.routes';
import { paymentCallbackRouter } from './routes/payment-callback.routes';
import { logger } from './observability/logger';
import { generalApiRateLimiter } from './middleware/rate-limiter';

export const app = express();

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(generalApiRateLimiter);

// Correlation ID & Request Logging Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  res.setHeader('x-request-id', requestId);
  (req as unknown as { requestId: string }).requestId = requestId;

  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info('HTTP Request handled', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
});

import { getPoolConfig } from './data/db';

// Health check endpoint with database pool diagnostics
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'rota-api',
    pool: getPoolConfig(),
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/', invitationsRouter);
app.use('/api/auth', authRouter);
app.use('/api', teamsRouter);
app.use('/api', shiftsRouter);
app.use('/api', swapsRouter);
app.use('/api', preferencesRouter);
app.use('/api', activityRouter);
app.use('/api', devicesRouter);
app.use('/', devicesRouter);
app.use('/api', webhooksRouter);
app.use('/api', paymentCallbackRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler (Never leak secrets or stack traces to client)
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId = (req as unknown as { requestId?: string }).requestId;

  // Handle bounded pool waiting timeout (Prisma P2024: pool exhaustion)
  if ((err as { code?: string })?.code === 'P2024') {
    logger.warn('Database connection pool exhausted; shedding load with 503', {
      requestId,
      error: err.message,
    });
    res.setHeader('Retry-After', '1');
    res.status(503).json({
      error: 'Database connection pool is temporarily saturated. Please retry shortly.',
      code: 'POOL_EXHAUSTED',
      requestId,
    });
    return;
  }

  logger.error('Unhandled server exception', err, { requestId });
  res.status(500).json({ error: 'Internal server error', requestId });
});
