import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, EmailJobData, redisConnection } from './queue';
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
    logger.error(`Job [${job?.id}] failed permanently after retries`, err, {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
    });
  });

  return worker;
}

// Standalone execution entrypoint
if (require.main === module) {
  logger.info('Starting Rota background email worker process...');
  const worker = createEmailWorker();

  const shutdown = async () => {
    logger.info('Shutting down Rota background worker...');
    await worker.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
