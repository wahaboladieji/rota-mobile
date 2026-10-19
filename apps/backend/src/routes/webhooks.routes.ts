import { Router, Request, Response } from 'express';
import { prismaPrimary } from '../data/db';
import { logger } from '../observability/logger';
import { FlutterwaveAdapter } from '../payments/flutterwave';
import { enqueuePaymentWebhookJob } from '../jobs/queue';

export const webhooksRouter = Router();

/**
 * POST /api/webhooks/flutterwave
 * Ingests incoming webhooks from Flutterwave, verifies signature, records durable receipt and payment logs,
 * and enqueues worker verification.
 */
webhooksRouter.post('/webhooks/flutterwave', async (req: Request, res: Response) => {
  const signature = req.headers['verif-hash'];

  // 1. Verify webhook signature against configured secret hash
  if (!FlutterwaveAdapter.verifyWebhookSignature(signature as string | undefined)) {
    logger.warn('Rejected webhook: invalid or missing verif-hash signature', {
      ip: req.ip,
      receivedHash: signature ? 'PRESENT_BUT_MISMATCHED' : 'MISSING',
    });
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  const payload = req.body;
  const event = payload?.event;
  const data = payload?.data;

  logger.info('Received verified Flutterwave webhook', {
    event,
    txRef: data?.tx_ref,
    transactionId: data?.id,
  });

  if (!data || !data.tx_ref) {
    logger.warn('Webhook payload missing data or tx_ref; acknowledging without processing', { payload });
    res.status(200).json({ status: 'ignored_missing_data' });
    return;
  }

  const providerEventId = String(data.id || data.flw_ref || data.tx_ref);

  // 2. Durable Idempotency Check: prevent duplicate webhook ingestion
  const existingEvent = await prismaPrimary.webhookEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider: 'FLUTTERWAVE',
        providerEventId,
      },
    },
  });

  if (existingEvent) {
    logger.info('Duplicate webhook event received; returning prior outcome', {
      providerEventId,
      status: existingEvent.status,
    });
    res.status(200).json({ status: 'duplicate_acknowledged' });
    return;
  }

  // 3. Find matching PaymentAttempt
  const attempt = await prismaPrimary.paymentAttempt.findUnique({
    where: { txRef: data.tx_ref },
  });

  // 4. Durably persist WebhookEvent and PaymentLogs (Stage 2: PROVIDER_COLLECTED, Stage 3: WEBHOOK_RECEIVED)
  let webhookEventId = '';
  try {
    await prismaPrimary.$transaction(async (tx) => {
      const createdWebhook = await tx.webhookEvent.create({
        data: {
          provider: 'FLUTTERWAVE',
          providerEventId,
          payload,
          status: 'RECEIVED',
        },
      });
      webhookEventId = createdWebhook.id;

      if (attempt) {
        // Stage 2: PROVIDER_COLLECTED (When Flutterwave collects funds)
        await tx.paymentLog.create({
          data: {
            teamId: attempt.teamId,
            paymentAttemptId: attempt.id,
            stage: 'PROVIDER_COLLECTED',
            attemptCreatedAt: attempt.createdAt,
            createdAt: new Date(attempt.createdAt.getTime() + 1000),
            eventType: 'PROVIDER_COLLECTED',
            message: `Flutterwave collected funds: $${data.amount} ${data.currency} (status: ${data.status})`,
            metadata: {
              transactionId: data.id,
              flwRef: data.flw_ref,
              amount: data.amount,
              currency: data.currency,
              paymentType: data.payment_type,
            },
          },
        });

        // Stage 3: WEBHOOK_RECEIVED (Comes from webhook)
        await tx.paymentLog.create({
          data: {
            teamId: attempt.teamId,
            paymentAttemptId: attempt.id,
            stage: 'WEBHOOK_RECEIVED',
            attemptCreatedAt: attempt.createdAt,
            createdAt: new Date(attempt.createdAt.getTime() + 2000),
            eventType: 'WEBHOOK_RECEIVED',
            message: `Webhook received with event '${event}' for transaction ${data.id}`,
            metadata: {
              providerEventId,
              event,
              webhookEventId: createdWebhook.id,
            },
          },
        });
      }
    });
  } catch (err: unknown) {
    logger.error('Failed to commit durable webhook receipt to database', err);
    res.status(500).json({ error: 'Failed to record webhook event' });
    return;
  }

  // 5. Enqueue background verification worker
  await enqueuePaymentWebhookJob({
    webhookEventId,
    provider: 'FLUTTERWAVE',
    providerTransactionId: data.id,
    txRef: data.tx_ref,
    flwRef: data.flw_ref,
    amount: Number(data.amount),
    currency: data.currency,
  });

  // 6. Fast HTTP 200 acknowledgment to payment provider
  res.status(200).json({ received: true });
});
