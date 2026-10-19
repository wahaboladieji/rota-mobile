import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import {
  EMAIL_QUEUE_NAME,
  EmailJobData,
  PUSH_QUEUE_NAME,
  PushJobData,
  pushQueue,
  PAYMENT_WEBHOOK_QUEUE_NAME,
  PaymentWebhookJobData,
  enqueuePushJob,
  redisConnection,
} from './queue';
import { prismaPrimary, disconnectDbClients } from '../data/db';
import { schedulingConfig } from '../config';
import { logger } from '../observability/logger';
import { FlutterwaveAdapter } from '../payments/flutterwave';
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
        // Fallback or generic/shift notification dispatch
        dispatchResult = await sendEmail({
          to: recipientEmail,
          subject: job.data.subject || `Rota Notification: ${type}`,
          html: job.data.html || `<p>Hello, you have a new ${type} notification from Rota.</p>`,
          text: job.data.text,
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

export async function processPushJob(
  data: PushJobData,
  jobContext?: { id?: string; attemptsMade?: number }
): Promise<{ status: string; reason?: string; delayMs?: number; scheduledFor?: string; deviceCount?: number }> {
  const { userId, teamId, group, title, body, data: customData, isUrgent, eventType, shiftStartAt } = data;
  const jobId = jobContext?.id || 'manual';
  const attemptsMade = jobContext?.attemptsMade || 0;

  logger.info(`Processing push notification job [${jobId}]`, {
    userId,
    teamId,
    group,
    title,
    eventType,
    attempt: attemptsMade + 1,
  });

  // 1. Authorization check: if teamId is present, verify active team membership
  if (teamId) {
    const membership = await prismaPrimary.membership.findFirst({
      where: {
        teamId,
        userId,
        status: 'ACTIVE',
      },
    });
    if (!membership) {
      logger.info(`Push notification suppressed: user is no longer an active team member`, {
        userId,
        teamId,
        jobId,
      });
      return { status: 'SKIPPED', reason: 'ACCESS_REVOKED' };
    }
  }

  // 2. Check user notification settings
  const settings = await prismaPrimary.userSetting.findUnique({
    where: { userId },
  });

  if (settings) {
    // Enforce notification group preferences (AGENTS.md rule 18: A disabled group always wins)
    if (group === 'SHIFT' && settings.shiftPush === false) {
      logger.info(`Push notification skipped: shiftPush disabled by user`, { userId, jobId });
      return { status: 'SKIPPED', reason: 'GROUP_DISABLED' };
    }
    if (group === 'SWAP' && settings.swapPush === false) {
      logger.info(`Push notification skipped: swapPush disabled by user`, { userId, jobId });
      return { status: 'SKIPPED', reason: 'GROUP_DISABLED' };
    }
    if (group === 'BILLING' && settings.billingPush === false) {
      logger.info(`Push notification skipped: billingPush disabled by user`, { userId, jobId });
      return { status: 'SKIPPED', reason: 'GROUP_DISABLED' };
    }

    // 3. Evaluate urgency at send time (PRD F7.5 & AGENTS.md rule 18)
    // Allowed urgent types: SHIFT_CHANGE, SHIFT_CANCEL, SWAP_APPROVAL, SWAP_REJECTION
    const isEligibleUrgentType =
      eventType === 'SHIFT_CHANGE' ||
      eventType === 'SHIFT_CANCEL' ||
      eventType === 'SWAP_APPROVAL' ||
      eventType === 'SWAP_REJECTION';

    let isTrulyUrgent = false;

    if (isEligibleUrgentType || isUrgent) {
      if (shiftStartAt) {
        const timeToShift = new Date(shiftStartAt).getTime() - Date.now();
        // Urgent ONLY if shift is in the future (> 0) and starts within urgentShiftThresholdHours (<= 12h default)
        if (timeToShift > 0 && timeToShift <= schedulingConfig.urgentShiftThresholdHours * 60 * 60 * 1000) {
          isTrulyUrgent = true;
        } else {
          isTrulyUrgent = false; // Past shift or > 12h cannot qualify as urgent
        }
      } else if (isEligibleUrgentType && isUrgent) {
        isTrulyUrgent = true;
      }
    }

    // 4. Check quiet hours (start-inclusive, end-exclusive [quietStart, quietEnd))
    if (settings.quietStart && settings.quietEnd && !isTrulyUrgent) {
      const userTz = settings.timeZone || 'UTC';
      let nowH = 0;
      let nowM = 0;
      let nowS = 0;

      try {
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: userTz,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).formatToParts(new Date(Date.now()));

        for (const p of parts) {
          if (p.type === 'hour') nowH = parseInt(p.value, 10);
          if (p.type === 'minute') nowM = parseInt(p.value, 10);
          if (p.type === 'second') nowS = parseInt(p.value, 10);
        }
      } catch {
        const d = new Date(Date.now());
        nowH = d.getUTCHours();
        nowM = d.getUTCMinutes();
        nowS = d.getUTCSeconds();
      }

      const [startH, startM] = settings.quietStart.split(':').map(Number);
      const [endH, endM] = settings.quietEnd.split(':').map(Number);

      const nowMins = nowH * 60 + nowM;
      const startMins = startH * 60 + startM;
      const endMins = endH * 60 + endM;

      let inQuietHours = false;
      if (startMins < endMins) {
        inQuietHours = nowMins >= startMins && nowMins < endMins;
      } else if (startMins > endMins) {
        // Spans midnight (e.g. 22:00 to 06:00)
        inQuietHours = nowMins >= startMins || nowMins < endMins;
      }

      if (inQuietHours) {
        // Calculate delay until quiet hours end in user's timezone
        let minutesUntilEnd = 0;
        if (nowMins < endMins) {
          minutesUntilEnd = endMins - nowMins;
        } else {
          minutesUntilEnd = 24 * 60 - nowMins + endMins;
        }

        const delayMs = Math.max(1000, (minutesUntilEnd * 60 - nowS) * 1000);
        const scheduledFor = new Date(Date.now() + delayMs).toISOString();

        // Reschedule delayed BullMQ job
        await pushQueue.add(
          `${group}_NOTIFICATION`,
          {
            ...data,
            scheduledFor,
          },
          {
            delay: delayMs,
          }
        );

        logger.info(`Push delayed until quiet hours end`, {
          userId,
          jobId,
          delayMs,
          scheduledFor,
          userTz,
        });

        return { status: 'DEFERRED_FOR_QUIET_HOURS', delayMs, scheduledFor };
      }
    }
  }

  // 5. Fetch all active, non-invalidated devices for this user
  const devices = await prismaPrimary.device.findMany({
    where: {
      userId,
      pushToken: { not: null },
      invalidatedAt: null,
    },
  });

  if (devices.length === 0) {
    logger.info(`No active push tokens found for user`, { userId, jobId });
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

  // 6. Construct push message payload
  const messages = validTokens.map((token) => ({
    to: token,
    sound: 'default',
    title,
    body,
    data: {
      group,
      ...(customData || {}),
    },
    priority: 'high',
    channelId: 'default',
  }));

  // 7. Dispatch to Expo Push Service
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    logger.warn(`Expo push service responded with HTTP ${response.status}`);
    throw new Error(`Expo push gateway returned HTTP ${response.status}`);
  }

  const responseJson = (await response.json()) as {
    data?: Array<{ status: string; message?: string; details?: { error?: string } }>;
  };

  logger.info(`Expo push dispatch response`, {
    status: response.status,
    recipientCount: validTokens.length,
  });

  // 8. Handle invalid tokens: when Expo reports DeviceNotRegistered, mark invalidated
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
}

export function createPushWorker(): Worker<PushJobData> {
  const worker = new Worker<PushJobData>(
    PUSH_QUEUE_NAME,
    async (job: Job<PushJobData>) => {
      return processPushJob(job.data, { id: job.id, attemptsMade: job.attemptsMade });
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

export function createPaymentWebhookWorker(): Worker<PaymentWebhookJobData> {
  const worker = new Worker<PaymentWebhookJobData>(
    PAYMENT_WEBHOOK_QUEUE_NAME,
    async (job: Job<PaymentWebhookJobData>) => {
      const { webhookEventId, providerTransactionId, txRef, amount, currency } = job.data;
      logger.info(`Processing payment webhook verification job [${job.id}]`, {
        webhookEventId,
        providerTransactionId,
        txRef,
        amount,
        currency,
        attempt: job.attemptsMade + 1,
      });

      // 1. Fetch WebhookEvent record
      const webhookEvent = await prismaPrimary.webhookEvent.findUnique({
        where: { id: webhookEventId },
      });

      if (!webhookEvent) {
        logger.error(`WebhookEvent not found: ${webhookEventId}`);
        throw new Error(`WebhookEvent not found: ${webhookEventId}`);
      }

      if (webhookEvent.status === 'PROCESSED') {
        logger.info(`WebhookEvent already processed: ${webhookEventId}`);
        return { status: 'ALREADY_PROCESSED' };
      }

      // 2. Fetch matching PaymentAttempt
      const attempt = await prismaPrimary.paymentAttempt.findUnique({
        where: { txRef },
        include: { subscription: true, team: true },
      });

      if (!attempt) {
        logger.error(`PaymentAttempt not found for txRef: ${txRef}`);
        await prismaPrimary.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            status: 'FAILED',
            failureReason: `PaymentAttempt not found for txRef: ${txRef}`,
          },
        });
        return { status: 'ATTEMPT_NOT_FOUND' };
      }

      if (attempt.status === 'VERIFIED') {
        logger.info(`PaymentAttempt already verified: ${attempt.id}`);
        await prismaPrimary.webhookEvent.update({
          where: { id: webhookEventId },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
        return { status: 'ALREADY_VERIFIED' };
      }

      // 3. Re-verify transaction with Flutterwave API
      const verification = await FlutterwaveAdapter.verifyTransaction(providerTransactionId);

      const expectedAmountUnits = attempt.expectedAmountCents / 100;
      const isStatusOk = verification.success && verification.status === 'successful';
      const isCurrencyOk = verification.currency.toUpperCase() === attempt.currency.toUpperCase();
      const isAmountOk = verification.amount >= expectedAmountUnits;
      const isTxRefOk = verification.txRef === attempt.txRef;

      if (!isStatusOk || !isCurrencyOk || !isAmountOk || !isTxRefOk) {
        const failureReason = `Verification mismatch: status=${verification.status}, currency=${verification.currency}(exp:${attempt.currency}), amount=${verification.amount}(exp:${expectedAmountUnits}), txRef=${verification.txRef}`;
        logger.error(failureReason, { attemptId: attempt.id, transactionId: providerTransactionId });

        await prismaPrimary.$transaction([
          prismaPrimary.paymentAttempt.update({
            where: { id: attempt.id },
            data: { status: 'FAILED' },
          }),
          prismaPrimary.webhookEvent.update({
            where: { id: webhookEventId },
            data: { status: 'FAILED', failureReason },
          }),
        ]);

        throw new Error(failureReason);
      }

      // 4. Verification succeeded - Execute single atomic transaction
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Determine plan parameters
      const plan = await prismaPrimary.plan.findFirst({
        where: { basePriceCents: attempt.expectedAmountCents },
      });
      const resolvedPlanCode = plan?.code || 'STARTER';
      const includedSeats = plan?.includedSeats || 5;

      await prismaPrimary.$transaction(async (tx) => {
        // a. Mark PaymentAttempt as VERIFIED
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: 'VERIFIED',
            providerTransaction: String(providerTransactionId),
          },
        });

        // b. Stage 4 PaymentLog: USER_PAID
        await tx.paymentLog.create({
          data: {
            teamId: attempt.teamId,
            paymentAttemptId: attempt.id,
            stage: 'USER_PAID',
            attemptCreatedAt: attempt.createdAt,
            createdAt: new Date(attempt.createdAt.getTime() + 3000),
            eventType: 'USER_PAID',
            message: `Payment of $${verification.amount.toFixed(2)} ${verification.currency} verified and settled successfully`,
            metadata: {
              transactionId: providerTransactionId,
              flwRef: verification.flwRef,
              amountCents: attempt.expectedAmountCents,
              planCode: resolvedPlanCode,
              paidSeats: includedSeats,
            },
          },
        });

        // c. Append-only ledger row
        await tx.ledgerEntry.create({
          data: {
            teamId: attempt.teamId,
            subscriptionId: attempt.subscriptionId,
            paymentAttemptId: attempt.id,
            kind: 'CHARGE',
            eventType: attempt.subscription.status === 'PENDING_INITIAL_PAYMENT' ? 'INITIAL_PAYMENT' : 'PLAN_CHANGE',
            amountCents: attempt.expectedAmountCents,
            currency: attempt.currency,
            planCodeAfter: resolvedPlanCode,
            paidSeatsAfter: includedSeats,
            statusAfter: 'ACTIVE',
            periodStartAfter: now,
            periodEndAfter: periodEnd,
            effectiveAt: now,
          },
        });

        // d. Atomically activate Subscription
        await tx.subscription.update({
          where: { id: attempt.subscriptionId },
          data: {
            status: 'ACTIVE',
            planCode: resolvedPlanCode,
            paidSeatEntitlement: includedSeats,
            periodStart: now,
            periodEnd,
          },
        });

        // e. Mark WebhookEvent as PROCESSED
        await tx.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            status: 'PROCESSED',
            processedAt: now,
          },
        });
      });

      logger.info('Payment verified and subscription activated successfully', {
        teamId: attempt.teamId,
        attemptId: attempt.id,
        planCode: resolvedPlanCode,
        seats: includedSeats,
      });

      // 5. Notify Team Owner via Push Notification
      try {
        await enqueuePushJob({
          userId: attempt.team.ownerId,
          teamId: attempt.teamId,
          group: 'BILLING',
          title: 'Subscription Activated',
          body: `Your team ${attempt.team.name} is now active on the ${resolvedPlanCode} plan (${includedSeats} seats).`,
          isUrgent: true,
        });
      } catch (pushErr) {
        logger.warn('Failed to dispatch owner billing push notification', { error: String(pushErr) });
      }

      return {
        status: 'SUCCESS',
        teamId: attempt.teamId,
        planCode: resolvedPlanCode,
      };
    },
    {
      connection: redisConnection,
      concurrency: 3,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(`Payment Webhook Job [${job?.id}] failed permanently after retries`, err, {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
    });
  });

  return worker;
}

// Standalone execution entrypoint
if (require.main === module) {
  logger.info('Starting Rota background workers (email + push + payment)...');
  const emailWorker = createEmailWorker();
  const pushWorker = createPushWorker();
  const paymentWorker = createPaymentWebhookWorker();

  const shutdown = async (signal?: string) => {
    logger.info(`Shutting down Rota background workers (${signal || 'signal'})...`);
    try {
      await emailWorker.close();
      await pushWorker.close();
      await paymentWorker.close();
      await disconnectDbClients();
      process.exit(0);
    } catch (err) {
      logger.error('Error shutting down background workers', err);
      await disconnectDbClients().catch(() => {});
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

