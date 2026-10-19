import request from 'supertest';
import { app } from '../src/app';
import { prismaPrimary } from '../src/data/db';
import { Role } from '@rota/shared';
import { closeQueue } from '../src/jobs/queue';
import { FlutterwaveAdapter } from '../src/payments/flutterwave';

describe('Flutterwave Subscription Integration & Payment Logs (PRD F6.2, F6.3, Section 8, 10)', () => {
  let ownerToken: string;
  let ownerId: string;
  let staffToken: string;
  let staffId: string;
  let teamId: string;
  let subscriptionId: string;

  beforeAll(async () => {
    // 1. Create Owner User
    const ownerRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: `flw-owner-${Date.now()}@example.com`, password: 'OwnerPassword123!' });
    ownerToken = ownerRes.body.accessToken;
    ownerId = ownerRes.body.user.id;

    // 2. Create Staff User
    const staffRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: `flw-staff-${Date.now()}@example.com`, password: 'StaffPassword123!' });
    staffToken = staffRes.body.accessToken;
    staffId = staffRes.body.user.id;

    // 3. Create Team as Owner (creates team + initial subscription in PENDING_INITIAL_PAYMENT)
    const teamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Flutterwave Bistro' });
    teamId = teamRes.body.team.id;

    // 4. Add Staff to Team with STAFF role
    await prismaPrimary.membership.create({
      data: {
        teamId,
        userId: staffId,
        role: Role.STAFF,
        status: 'ACTIVE',
      },
    });

    // Fetch subscription
    const sub = await prismaPrimary.subscription.findUnique({
      where: { teamId },
    });
    subscriptionId = sub!.id;
  });

  afterAll(async () => {
    if (teamId) {
      await prismaPrimary.paymentLog.deleteMany({ where: { teamId } });
      await prismaPrimary.$executeRawUnsafe(`ALTER TABLE "LedgerEntry" DISABLE TRIGGER "ledger_entry_no_delete";`);
      await prismaPrimary.ledgerEntry.deleteMany({ where: { teamId } });
      await prismaPrimary.$executeRawUnsafe(`ALTER TABLE "LedgerEntry" ENABLE TRIGGER "ledger_entry_no_delete";`);
      await prismaPrimary.paymentAttempt.deleteMany({ where: { teamId } });
      await prismaPrimary.membership.deleteMany({ where: { teamId } });
      await prismaPrimary.subscription.deleteMany({ where: { teamId } });
      await prismaPrimary.team.deleteMany({ where: { id: teamId } });
    }
    await closeQueue();
  });

  describe('Stage 1: User Initiates Payment (POST /api/teams/:teamId/payment/initiate)', () => {
    it('rejects initiation by non-owner roles (Staff)', async () => {
      const res = await request(app)
        .post(`/api/teams/${teamId}/payment/initiate`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ planCode: 'STARTER', idempotencyKey: `staff_attempt_${Date.now()}` });

      expect(res.status).toBe(403);
    });

    it('creates PaymentAttempt and logs Stage 1 (USER_INITIATED) for Owner', async () => {
      jest.spyOn(FlutterwaveAdapter, 'initializePayment').mockResolvedValueOnce({
        checkoutUrl: 'https://checkout-v2.dev-flutterwave.com/v3/hosted/pay/mock123',
        txRef: 'mock_tx_ref',
      });

      const idempotencyKey = `flw_test_init_${Date.now()}`;
      const res = await request(app)
        .post(`/api/teams/${teamId}/payment/initiate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ planCode: 'STARTER', idempotencyKey });

      expect(res.status).toBe(201);
      expect(res.body.paymentAttemptId).toBeDefined();
      expect(res.body.txRef).toBeDefined();
      expect(res.body.amountCents).toBe(2000); // $20.00 in whole cents
      expect(res.body.currency).toBe('USD');
      expect(res.body.status).toBe('PENDING');
      expect(res.body.checkoutUrl).toBe('https://checkout-v2.dev-flutterwave.com/v3/hosted/pay/mock123');

      // Check PaymentLog in DB for Stage 1: USER_INITIATED
      const log = await prismaPrimary.paymentLog.findFirst({
        where: {
          teamId,
          paymentAttemptId: res.body.paymentAttemptId,
          stage: 'USER_INITIATED',
        },
      });
      expect(log).not.toBeNull();
      expect(log?.eventType).toBe('USER_INITIATED');
      expect(log?.message).toContain('STARTER');
    });

    it('enforces idempotency for repeated initiation keys without duplicating attempts', async () => {
      jest.spyOn(FlutterwaveAdapter, 'initializePayment').mockResolvedValueOnce({
        checkoutUrl: 'https://checkout-v2.dev-flutterwave.com/v3/hosted/pay/mock_repeat',
        txRef: 'mock_tx_repeat',
      });

      const idempotencyKey = `repeat_key_${Date.now()}`;

      const res1 = await request(app)
        .post(`/api/teams/${teamId}/payment/initiate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ planCode: 'STARTER', idempotencyKey });
      expect(res1.status).toBe(201);

      const res2 = await request(app)
        .post(`/api/teams/${teamId}/payment/initiate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ planCode: 'STARTER', idempotencyKey });
      expect(res2.status).toBe(200);
      expect(res2.body.paymentAttemptId).toBe(res1.body.paymentAttemptId);
      expect(res2.body.txRef).toBe(res1.body.txRef);
    });
  });

  describe('Webhook Ingestion (POST /api/webhooks/flutterwave) - Stages 2 & 3', () => {
    let testTxRef: string;
    let testAttemptId: string;
    const testSecretHash = process.env.FLUTTERWAVE_SECRET_HASH || 'rota_webhook_secret_hash_dev_test';

    beforeEach(async () => {
      // Create a fresh pending attempt
      const attempt = await prismaPrimary.paymentAttempt.create({
        data: {
          teamId,
          subscriptionId,
          idempotencyKey: `webhook_test_attempt_${Date.now()}_${Math.random()}`,
          txRef: `rota_tx_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          provider: 'FLUTTERWAVE_TEST',
          expectedAmountCents: 2000,
          currency: 'USD',
          status: 'PENDING',
        },
      });
      testTxRef = attempt.txRef;
      testAttemptId = attempt.id;
    });

    it('rejects webhooks with invalid or missing verif-hash signature (401)', async () => {
      const res = await request(app)
        .post('/api/webhooks/flutterwave')
        .set('verif-hash', 'wrong-signature-hash')
        .send({ event: 'charge.completed', data: { tx_ref: testTxRef, id: 9999 } });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid webhook signature');
    });

    it('accepts valid signed webhook, logs Stage 2 (PROVIDER_COLLECTED) and Stage 3 (WEBHOOK_RECEIVED)', async () => {
      const transactionId = Math.floor(Math.random() * 900000) + 100000;
      const payload = {
        event: 'charge.completed',
        data: {
          id: transactionId,
          tx_ref: testTxRef,
          flw_ref: `flw_mock_ref_${transactionId}`,
          amount: 20,
          currency: 'USD',
          status: 'successful',
          payment_type: 'card',
        },
      };

      const res = await request(app)
        .post('/api/webhooks/flutterwave')
        .set('verif-hash', testSecretHash)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);

      // Verify WebhookEvent stored
      const webhookRecord = await prismaPrimary.webhookEvent.findFirst({
        where: { providerEventId: String(transactionId) },
      });
      expect(webhookRecord).not.toBeNull();
      expect(webhookRecord?.status).toBe('RECEIVED');

      // Verify Stage 2: PROVIDER_COLLECTED logged
      const collectedLog = await prismaPrimary.paymentLog.findFirst({
        where: {
          teamId,
          paymentAttemptId: testAttemptId,
          stage: 'PROVIDER_COLLECTED',
        },
      });
      expect(collectedLog).not.toBeNull();
      expect(collectedLog?.message).toContain('Flutterwave collected funds');

      // Verify Stage 3: WEBHOOK_RECEIVED logged
      const webhookLog = await prismaPrimary.paymentLog.findFirst({
        where: {
          teamId,
          paymentAttemptId: testAttemptId,
          stage: 'WEBHOOK_RECEIVED',
        },
      });
      expect(webhookLog).not.toBeNull();
      expect(webhookLog?.message).toContain('Webhook received');
    });

    it('handles duplicate webhook deliveries idempotently without duplicate records', async () => {
      const transactionId = Math.floor(Math.random() * 900000) + 100000;
      const payload = {
        event: 'charge.completed',
        data: {
          id: transactionId,
          tx_ref: testTxRef,
          flw_ref: `flw_mock_ref_${transactionId}`,
          amount: 20,
          currency: 'USD',
          status: 'successful',
        },
      };

      // First delivery
      const res1 = await request(app)
        .post('/api/webhooks/flutterwave')
        .set('verif-hash', testSecretHash)
        .send(payload);
      expect(res1.status).toBe(200);
      expect(res1.body.received).toBe(true);

      // Duplicate delivery
      const res2 = await request(app)
        .post('/api/webhooks/flutterwave')
        .set('verif-hash', testSecretHash)
        .send(payload);
      expect(res2.status).toBe(200);
      expect(res2.body.status).toBe('duplicate_acknowledged');
    });
  });

  describe('Stage 4: User Has Paid & Verification (POST /api/teams/:teamId/payment/verify)', () => {
    let attempt: any;

    it('verifies payment, activates subscription, appends immutable LedgerEntry, and logs Stage 4 (USER_PAID)', async () => {
      // 1. Create a fresh attempt
      attempt = await prismaPrimary.paymentAttempt.create({
        data: {
          teamId,
          subscriptionId,
          idempotencyKey: `verify_test_attempt_${Date.now()}`,
          txRef: `rota_tx_verify_${Date.now()}`,
          provider: 'FLUTTERWAVE_TEST',
          expectedAmountCents: 2000,
          currency: 'USD',
          status: 'PENDING',
        },
      });

      // Create Stage 1 PaymentLog
      await prismaPrimary.paymentLog.create({
        data: {
          teamId,
          paymentAttemptId: attempt.id,
          stage: 'USER_INITIATED',
          attemptCreatedAt: attempt.createdAt,
          eventType: 'USER_INITIATED',
          message: 'Owner initiated payment',
        },
      });

      // 2. Call verify endpoint
      const res = await request(app)
        .post(`/api/teams/${teamId}/payment/verify`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          paymentAttemptId: attempt.id,
          idempotencyKey: `verify_idem_${Date.now()}`,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.planCode).toBe('STARTER');
      expect(res.body.paidSeatEntitlement).toBe(5);

      // 3. Verify PaymentAttempt status is VERIFIED
      const updatedAttempt = await prismaPrimary.paymentAttempt.findUnique({
        where: { id: attempt.id },
      });
      expect(updatedAttempt?.status).toBe('VERIFIED');

      // 4. Verify Stage 4: USER_PAID PaymentLog created
      const paidLog = await prismaPrimary.paymentLog.findFirst({
        where: {
          teamId,
          paymentAttemptId: attempt.id,
          stage: 'USER_PAID',
        },
      });
      expect(paidLog).not.toBeNull();
      expect(paidLog?.eventType).toBe('USER_PAID');
      expect(paidLog?.message).toContain('Payment verified');

      // 5. Verify immutable LedgerEntry created
      const ledger = await prismaPrimary.ledgerEntry.findFirst({
        where: {
          teamId,
          paymentAttemptId: attempt.id,
          kind: 'CHARGE',
        },
      });
      expect(ledger).not.toBeNull();
      expect(ledger?.amountCents).toBe(2000);
      expect(ledger?.currency).toBe('USD');
      expect(ledger?.planCodeAfter).toBe('STARTER');
      expect(ledger?.statusAfter).toBe('ACTIVE');

      // 6. Verify Subscription is ACTIVE
      const updatedSub = await prismaPrimary.subscription.findUnique({
        where: { teamId },
      });
      expect(updatedSub?.status).toBe('ACTIVE');
      expect(updatedSub?.paidSeatEntitlement).toBe(5);
    });

    it('allows Owner to inspect all 4 stages in exact lifecycle order via GET /api/teams/:teamId/payment-logs', async () => {
      const res = await request(app)
        .get(`/api/teams/${teamId}/payment-logs`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.logs)).toBe(true);
      expect(res.body.logs.length).toBeGreaterThanOrEqual(1);

      const stagesPresent = res.body.logs.map((l: any) => l.stage);
      expect(stagesPresent).toContain('USER_INITIATED');
      expect(stagesPresent).toContain('USER_PAID');

      // Filter to this attempt's logs
      const attemptLogs = res.body.logs.filter((l: any) => l.paymentAttemptId === attempt.id);
      expect(attemptLogs.length).toBe(4);
      expect(attemptLogs.map((l: any) => l.stage)).toEqual([
        'USER_INITIATED',
        'PROVIDER_COLLECTED',
        'WEBHOOK_RECEIVED',
        'USER_PAID',
      ]);
      // Verify chronological sequence within the attempt group
      for (let i = 0; i < attemptLogs.length - 1; i++) {
        expect(new Date(attemptLogs[i].createdAt).getTime()).toBeLessThan(
          new Date(attemptLogs[i + 1].createdAt).getTime()
        );
      }
    });
  });
});
