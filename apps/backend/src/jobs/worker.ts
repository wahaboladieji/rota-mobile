import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import {
  EMAIL_QUEUE_NAME,
  EmailJobData,
  PUSH_QUEUE_NAME,
  PushJobData,
  redisConnection,
} from './queue';
import { prismaPrimary } from '../data/db';
import { logger } from '../observability/logger';
import {
  sendVerificationCodeEmail,
  sendMagicLinkEmail,
  sendPasswordResetEmail,
  sendInvitationEmail,
  sendEmail,
} from '../services/mailer.service';

export function createEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { type, recipientEmail, linkUrl, code, purpose, teamName, invitedRole, tokenHash } = job.data;
      logger.info(`Processing email delivery job [${job.id}]`, {
        type,
        recipientEmail,
        attempt: job.attemptsMade + 1,
      });

      // Dispatch real email via Nodemailer
      let dispatchResult: { success: boolean; messageId?: string };

      if (type === 'VERIFICATION_CODE' && code) {
        dispatchResult = await sendVerificationCodeEmail(recipientEmail, code, purpose || 'Verification');
      } else if (type === 'MAGIC_LINK' && linkUrl) {
        dispatchResult = await sendMagicLinkEmail(recipientEmail, linkUrl);
      } else if (type === 'PASSWORD_RESET') {
        dispatchResult = await sendPasswordResetEmail(recipientEmail, linkUrl || '', code);
      } else if (type === 'INVITATION' && linkUrl) {
        dispatchResult = await sendInvitationEmail(
          recipientEmail,
          teamName || 'Your Team',
          invitedRole || 'Staff',
          linkUrl,
          code || tokenHash
        );
      } else {
        // Fallback or generic dispatch
        dispatchResult = await sendEmail({
          to: recipientEmail,
          subject: `Rota Notification: ${type}`,
          html: `<p>Hello, you have a new ${type} notification from Rota.</p>`,
        });
      }

      logger.info(`Email successfully dispatched via Nodemailer`, {
        type,
        recipientEmail,
        jobId: job.id,
        messageId: dispatchResult.messageId,
      });

      return { status: 'DELIVERED', messageId: dispatchResult.messageId, timestamp: new Date().toISOString() };
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(`Email Job [${job?.id}] failed permanently after retries`, err, {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
    });
  });

  return worker;
}

export function createPushWorker(): Worker<PushJobData> {
  const worker = new Worker<PushJobData>(
    PUSH_QUEUE_NAME,
    async (job: Job<PushJobData>) => {
      const { userId, group, title, body, data, isUrgent } = job.data;
      logger.info(`Processing push notification job [${job.id}]`, {
        userId,
        group,
        title,
        attempt: job.attemptsMade + 1,
      });

      // 1. Check user notification settings
      const settings = await prismaPrimary.userSetting.findUnique({
        where: { userId },
      });

      if (settings) {
        // Enforce notification group preferences (AGENTS.md rule 18: A disabled group always wins)
        if (group === 'SHIFT' && settings.shiftPush === false) {
          logger.info(`Push notification skipped: shiftPush disabled by user`, { userId, jobId: job.id });
          return { status: 'SKIPPED', reason: 'GROUP_DISABLED' };
        }
        if (group === 'SWAP' && settings.swapPush === false) {
          logger.info(`Push notification skipped: swapPush disabled by user`, { userId, jobId: job.id });
          return { status: 'SKIPPED', reason: 'GROUP_DISABLED' };
        }
        if (group === 'BILLING' && settings.billingPush === false) {
          logger.info(`Push notification skipped: billingPush disabled by user`, { userId, jobId: job.id });
          return { status: 'SKIPPED', reason: 'GROUP_DISABLED' };
        }

        // Check quiet hours (if set and not urgent)
        if (settings.quietStart && settings.quietEnd && !isUrgent) {
          const now = new Date();
          const userTz = settings.timeZone || 'UTC';
          try {
            const userHourMin = new Intl.DateTimeFormat('en-GB', {
              timeZone: userTz,
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }).format(now);

            const [startH, startM] = settings.quietStart.split(':').map(Number);
            const [endH, endM] = settings.quietEnd.split(':').map(Number);
            const [nowH, nowM] = userHourMin.split(':').map(Number);

            const nowMins = nowH * 60 + nowM;
            const startMins = startH * 60 + startM;
            const endMins = endH * 60 + endM;

            let inQuietHours = false;
            if (startMins <= endMins) {
              inQuietHours = nowMins >= startMins && nowMins < endMins;
            } else {
              // Spans midnight (e.g. 22:00 to 07:00)
              inQuietHours = nowMins >= startMins || nowMins < endMins;
            }

            if (inQuietHours) {
              logger.info(`Push delayed/suppressed due to quiet hours`, { userId, jobId: job.id });
              return { status: 'SUPPRESSED', reason: 'QUIET_HOURS' };
            }
          } catch (e: any) {
            logger.warn(`Failed to parse quiet hours timezone: ${e.message}`);
          }
        }
      }

      // 2. Fetch all active, non-invalidated devices for this user (supports multiple devices per user)
      const devices = await prismaPrimary.device.findMany({
        where: {
          userId,
          pushToken: { not: null },
          invalidatedAt: null,
        },
      });

      if (devices.length === 0) {
        logger.info(`No active push tokens found for user`, { userId, jobId: job.id });
        return { status: 'NO_DEVICES' };
      }

      // Filter for valid Expo Push Token format
      const validTokens = devices
        .map((d) => d.pushToken as string)
        .filter((t) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));

      if (validTokens.length === 0) {
        logger.warn(`No formatted Expo push tokens for user`, { userId, count: devices.length });
        return { status: 'NO_VALID_TOKENS' };
      }

      // 3. Construct push message payload
      const messages = validTokens.map((token) => ({
        to: token,
        sound: 'default',
        title,
        body,
        data: {
          group,
          ...(data || {}),
        },
        priority: 'high',
        channelId: 'default',
      }));

      // 4. Dispatch to Expo Push Service
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const responseJson = await response.json() as { data?: Array<{ status: string; message?: string; details?: { error?: string } }> };
      logger.info(`Expo push dispatch response`, {
        status: response.status,
        recipientCount: validTokens.length,
      });

      // 5. Handle invalid tokens: when Expo reports DeviceNotRegistered, delete or mark invalidated
      if (Array.isArray(responseJson.data)) {
        for (let i = 0; i < responseJson.data.length; i++) {
          const ticket = responseJson.data[i];
          const token = validTokens[i];

          if (ticket.status === 'error') {
            const errorCode = ticket.details?.error;
            logger.warn(`Push dispatch error for token`, { token, errorCode, message: ticket.message });

            if (errorCode === 'DeviceNotRegistered' || errorCode === 'InvalidCredentials') {
              logger.info(`Invalidating/removing stale push token: ${token}`);
              await prismaPrimary.device.updateMany({
                where: { pushToken: token },
                data: { invalidatedAt: new Date() },
              });
            }
          }
        }
      }

      return { status: 'DELIVERED', deviceCount: validTokens.length };
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(`Push Job [${job?.id}] failed permanently after retries`, err, {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
    });
  });

  return worker;
}

// Standalone execution entrypoint
if (require.main === module) {
  logger.info('Starting Rota background workers (email + push)...');
  const emailWorker = createEmailWorker();
  const pushWorker = createPushWorker();

  const shutdown = async () => {
    logger.info('Shutting down Rota background workers...');
    await emailWorker.close();
    await pushWorker.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

