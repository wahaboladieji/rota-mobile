import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../observability/logger';
import { serverConfig } from '../config';

const redisUrl = serverConfig.redisUrl;

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

export const EMAIL_QUEUE_NAME = 'rota_emails';

export interface EmailJobData {
  type:
    | 'MAGIC_LINK'
    | 'PASSWORD_RESET'
    | 'INVITATION'
    | 'VERIFICATION_CODE'
    | 'SHIFT_NOTIFICATION';
  recipientEmail: string;
  tokenHash?: string;
  linkUrl?: string;
  code?: string;
  purpose?: string;
  teamName?: string;
  invitedRole?: string;
  subject?: string;
  html?: string;
  text?: string;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000,
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

export const PUSH_QUEUE_NAME = 'rota_push_notifications';

export type PushNotificationGroup = 'SHIFT' | 'SWAP' | 'BILLING';

export type PushEventType =
  | 'SHIFT_CHANGE'
  | 'SHIFT_CANCEL'
  | 'SWAP_APPROVAL'
  | 'SWAP_REJECTION'
  | 'NEW_SHIFT'
  | 'SWAP_REQUEST'
  | 'BILLING';

export interface PushJobData {
  userId: string;
  teamId?: string;
  group: PushNotificationGroup;
  title: string;
  body: string;
  data?: Record<string, any>;
  isUrgent?: boolean;
  eventType?: PushEventType;
  shiftStartAt?: string;
  scheduledFor?: string;
}

export const pushQueue = new Queue<PushJobData>(PUSH_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1500,
    },
    removeOnComplete: 200,
    removeOnFail: 500,
  },
});

export interface EnqueuePushOptions {
  delay?: number;
  requestId?: string;
}

export async function enqueuePushJob(
  data: PushJobData,
  options?: EnqueuePushOptions | string
): Promise<string> {
  const requestId = typeof options === 'string' ? options : options?.requestId;
  const delay = typeof options === 'object' ? options?.delay : undefined;

  try {
    const job = await pushQueue.add(`${data.group}_NOTIFICATION`, data, {
      delay,
    });
    logger.info(`Enqueued ${data.group} push notification job`, {
      requestId,
      jobId: job.id,
      userId: data.userId,
      title: data.title,
      delay,
    });
    return job.id as string;
  } catch (err) {
    logger.error(`Failed to enqueue push notification job`, err, {
      requestId,
      userId: data.userId,
      group: data.group,
    });
    return 'fallback-push-job-id';
  }
}

export const PAYMENT_WEBHOOK_QUEUE_NAME = 'rota_payment_webhooks';

export interface PaymentWebhookJobData {
  webhookEventId: string;
  provider: string;
  providerTransactionId: string | number;
  txRef: string;
  flwRef?: string;
  amount: number;
  currency: string;
}

export const paymentWebhookQueue = new Queue<PaymentWebhookJobData>(PAYMENT_WEBHOOK_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export async function enqueuePaymentWebhookJob(data: PaymentWebhookJobData, requestId?: string): Promise<string> {
  try {
    const job = await paymentWebhookQueue.add('PROCESS_WEBHOOK', data);
    logger.info('Enqueued payment webhook job', {
      requestId,
      jobId: job.id,
      txRef: data.txRef,
      transactionId: data.providerTransactionId,
    });
    return job.id as string;
  } catch (err) {
    logger.error('Failed to enqueue payment webhook job', err, {
      requestId,
      txRef: data.txRef,
    });
    return 'fallback-webhook-job-id';
  }
}

export async function closeQueue(): Promise<void> {
  try {
    await emailQueue.close();
    await pushQueue.close();
    await paymentWebhookQueue.close();
    await redisConnection.quit();
  } catch {
    // Ignore error on close
  }
}

