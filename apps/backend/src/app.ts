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
import { logger } from './observability/logger';

export const app = express();

app.use(cors());
app.use(express.json());

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

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'rota-api', timestamp: new Date().toISOString() });
});

// Routes
app.use('/', invitationsRouter);
app.use('/api/auth', authRouter);
app.use('/api', teamsRouter);
app.use('/api', shiftsRouter);
app.use('/api', swapsRouter);
app.use('/api', preferencesRouter);
app.use('/api', activityRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler (Never leak secrets or stack traces to client)
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId = (req as unknown as { requestId?: string }).requestId;
  logger.error('Unhandled server exception', err, { requestId });
  res.status(500).json({ error: 'Internal server error', requestId });
});
