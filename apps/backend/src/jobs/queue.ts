import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../observability/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

export const EMAIL_QUEUE_NAME = 'rota_emails';

export interface EmailJobData {
  type: 'MAGIC_LINK' | 'PASSWORD_RESET' | 'INVITATION' | 'VERIFICATION_CODE';
  recipientEmail: string;
  tokenHash: string;
  linkUrl?: string;
  code?: string;
  purpose?: string;
  teamName?: string;
  invitedRole?: string;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export async function enqueueEmailJob(data: EmailJobData, requestId?: string): Promise<string> {
  try {
    const job = await emailQueue.add(data.type, data);
    logger.info(`Enqueued ${data.type} email job`, {
      requestId,
      jobId: job.id,
      recipientEmail: data.recipientEmail,
    });
    return job.id as string;
  } catch (err) {
    logger.error(`Failed to enqueue ${data.type} email job`, err, {
      requestId,
      recipientEmail: data.recipientEmail,
    });
    return 'fallback-job-id';
  }
}

export async function closeQueue(): Promise<void> {
  try {
    await emailQueue.close();
    await redisConnection.quit();
  } catch {
    // Ignore error on close
  }
}
