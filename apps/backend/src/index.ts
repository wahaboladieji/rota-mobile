import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';
import { logger } from './observability/logger';
import { createEmailWorker, createPushWorker } from './jobs/worker';

const PORT = parseInt(process.env.PORT || '3000', 10);

// Initialize background workers for emails and push notifications
const emailWorker = createEmailWorker();
const pushWorker = createPushWorker();

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Rota Express API listening on port ${PORT}`, { port: PORT });
  console.log('==========================================');
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📡 Local URL:      http://localhost:${PORT}`);
  console.log(`📱 Connect your mobile device or simulator`);
  console.log('==========================================');
});

const shutdown = async () => {
  logger.info('Shutting down server and background workers...');
  await emailWorker.close();
  await pushWorker.close();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
