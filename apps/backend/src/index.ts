import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';
import { serverConfig } from './config';
import { logger } from './observability/logger';
import { createEmailWorker, createPushWorker, createPaymentWebhookWorker } from './jobs/worker';
import { disconnectDbClients } from './data/db';

const PORT = serverConfig.port;

// Initialize background workers for emails, push notifications, and payment webhook verification
const emailWorker = createEmailWorker();
const pushWorker = createPushWorker();
const paymentWorker = createPaymentWebhookWorker();

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Rota Express API listening on port ${PORT}`, { port: PORT });
  console.log('==========================================');
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📡 Local URL:      http://localhost:${PORT}`);
  console.log(`📱 Connect your mobile device or simulator`);
  console.log('==========================================');
});

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Shutting down HTTP server, workers, and database connection pools...`);

  // Enforce a hard timeout to avoid hanging if any socket or worker stalls
  const forceExitTimer = setTimeout(() => {
    logger.warn('Forcing process exit after shutdown timeout');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  try {
    await emailWorker.close();
    await pushWorker.close();
    await paymentWorker.close();

    await new Promise<void>((resolve) => {
      server.close((err) => {
        if (err) {
          logger.error('Error closing HTTP server', err);
        }
        resolve();
      });
    });

    await disconnectDbClients();
    logger.info('Graceful shutdown completed successfully');
    process.exit(0);
  } catch (err) {
    logger.error('Error during graceful shutdown', err);
    await disconnectDbClients().catch(() => {});
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Nodemon restarts process via SIGUSR2 in development
process.once('SIGUSR2', async () => {
  logger.info('Nodemon restart (SIGUSR2) detected: closing database connection pool...');
  try {
    await disconnectDbClients();
  } finally {
    process.kill(process.pid, 'SIGUSR2');
  }
});
