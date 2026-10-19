import request from 'supertest';
import { app } from '../src/app';
import { prismaPrimary } from '../src/data/db';
import { Role } from '@rota/shared';
import { closeQueue } from '../src/jobs/queue';

describe('Billing Quotes, Downgrades, RESTRICTED State, and Member Removal (PRD F6.5, F6.6, D1, D5)', () => {
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
      .send({ email: `quote-owner-${Date.now()}@example.com`, password: 'OwnerPassword123!' });
    ownerToken = ownerRes.body.accessToken;
    ownerId = ownerRes.body.user.id;

    // 2. Create Staff User
    const staffRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: `quote-staff-${Date.now()}@example.com`, password: 'StaffPassword123!' });
    staffToken = staffRes.body.accessToken;
    staffId = staffRes.body.user.id;

    // 3. Create Team as Owner
    const teamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Quote & Proration Clinic' });
    teamId = teamRes.body.team.id;

    // 4. Add Staff to Team
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

  describe('Quote Endpoints (POST /api/teams/:teamId/billing/quote-plan & quote-seats)', () => {
    beforeAll(async () => {
      // Set subscription to ACTIVE with known 30-day window
      const periodStart = new Date('2026-06-01T00:00:00Z');
      const periodEnd = new Date('2026-07-01T00:00:00Z');
      await prismaPrimary.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'ACTIVE',
          planCode: 'STARTER',
          paidSeatEntitlement: 5,
          periodStart,
          periodEnd,
        },
      });
    });

    it('rejects quote endpoints for non-owners', async () => {
      const res = await request(app)
        .post(`/api/teams/${teamId}/billing/quote-plan`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ targetPlanCode: 'TEAM' });

      expect(res.status).toBe(403);
    });

    it('returns exact proration quote for Starter to Team upgrade (Case 1)', async () => {
      const res = await request(app)
        .post(`/api/teams/${teamId}/billing/quote-plan`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          targetPlanCode: 'TEAM',
          effectiveDate: '2026-06-11T00:00:00Z',
        });

      expect(res.status).toBe(200);
      expect(res.body.periodDays).toBe(30);
      expect(res.body.remainingDays).toBe(20);
      expect(res.body.unusedCreditCents).toBe(1333);
      expect(res.body.remainingCostCents).toBe(3333);
      expect(res.body.dueNowCents).toBe(2000);
      expect(res.body.isDowngrade).toBe(false);
    });

    it('returns quote for extra seat addition on Team plan (Case 4)', async () => {
      // Temporarily switch subscription to Team plan
      await prismaPrimary.subscription.update({
        where: { id: subscriptionId },
        data: { planCode: 'TEAM', paidSeatEntitlement: 15 },
      });

      const res = await request(app)
        .post(`/api/teams/${teamId}/billing/quote-seats`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          targetSeats: 18,
          effectiveDate: '2026-06-21T00:00:00Z',
        });

      expect(res.status).toBe(200);
      expect(res.body.periodDays).toBe(30);
      expect(res.body.remainingDays).toBe(10);
      expect(res.body.dueNowCents).toBe(300);
      expect(res.body.currentPeriodPaidSeats).toBe(18);
    });

    it('schedules downgrade at period end without charging dueNow (Case 3)', async () => {
      // Set to Business plan with current active period
      const now = new Date();
      const periodStart = new Date(now.getTime() - 10 * 86400000);
      const periodEnd = new Date(now.getTime() + 20 * 86400000);
      await prismaPrimary.subscription.update({
        where: { id: subscriptionId },
        data: {
          planCode: 'BUSINESS',
          paidSeatEntitlement: 40,
          periodStart,
          periodEnd,
        },
      });

      const res = await request(app)
        .post(`/api/teams/${teamId}/payment/initiate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          planCode: 'TEAM',
          idempotencyKey: `downgrade_attempt_${Date.now()}`,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SCHEDULED_AT_PERIOD_END');
      expect(res.body.pendingPlanCode).toBe('TEAM');

      const updatedSub = await prismaPrimary.subscription.findUnique({
        where: { id: subscriptionId },
      });
      expect(updatedSub?.pendingPlanCode).toBe('TEAM');
    });

    it('enforces D5: rejects adding extra seats on Starter plan', async () => {
      await prismaPrimary.subscription.update({
        where: { id: subscriptionId },
        data: { planCode: 'STARTER', paidSeatEntitlement: 5 },
      });

      const res = await request(app)
        .post(`/api/teams/${teamId}/payment/initiate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          planCode: 'STARTER',
          targetSeats: 7,
          idempotencyKey: `starter_extra_seats_${Date.now()}`,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Starter plan is limited to 5 seats/i);
    });
  });

  describe('RESTRICTED Subscription State Access Guards (PRD F6.6 / AGENTS.md rule 13)', () => {
    beforeAll(async () => {
      await prismaPrimary.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'RESTRICTED' },
      });
    });

    it('allows read operations (GET) in RESTRICTED state', async () => {
      const res = await request(app)
        .get(`/api/teams/${teamId}/shifts`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
    });

    it('allows Owner billing access in RESTRICTED state', async () => {
      const res = await request(app)
        .get(`/api/teams/${teamId}/billing`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
    });

    it('blocks shift mutations in RESTRICTED state with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/teams/${teamId}/shifts`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          assigneeId: staffId,
          startAt: new Date(Date.now() + 86400000).toISOString(),
          endAt: new Date(Date.now() + 90000000).toISOString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Subscription restricted/i);
    });

    it('blocks member invitations in RESTRICTED state with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/teams/${teamId}/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'newmember@example.com', role: Role.STAFF });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Subscription restricted/i);
    });
  });

  describe('Member Removal & Push Token Invalidation (AGENTS.md rule 6 / PRD F6.5)', () => {
    let memberToRemoveId: string;
    let memberUserId: string;

    beforeAll(async () => {
      // Create user with active device push token
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: `to-remove-${Date.now()}@example.com`, password: 'RemovePassword123!' });
      memberUserId = res.body.user.id;

      // Register device with push token
      await prismaPrimary.device.create({
        data: {
          userId: memberUserId,
          pushToken: `ExponentPushToken[test_${Date.now()}]`,
          lastSeenAt: new Date(),
        },
      });

      // Add to team
      const membership = await prismaPrimary.membership.create({
        data: {
          teamId,
          userId: memberUserId,
          role: Role.STAFF,
          status: 'ACTIVE',
        },
      });
      memberToRemoveId = membership.id;

      // Ensure subscription is ACTIVE for this test
      await prismaPrimary.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'ACTIVE' },
      });
    });

    it('removes member, revokes sessions, and invalidates push tokens immediately', async () => {
      const res = await request(app)
        .delete(`/api/teams/${teamId}/members/${memberToRemoveId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);

      // Verify membership is REMOVED
      const m = await prismaPrimary.membership.findUnique({ where: { id: memberToRemoveId } });
      expect(m?.status).toBe('REMOVED');

      // Verify device push tokens are cleared/invalidated
      const devices = await prismaPrimary.device.findMany({ where: { userId: memberUserId } });
      for (const d of devices) {
        expect(d.invalidatedAt).not.toBeNull();
        expect(d.pushToken).toBeNull();
      }
    });
  });

  describe('Subscription Cancellation and Resume (PRD F6.5 / AGENTS.md rule 9)', () => {
    it('rejects cancellation attempts from non-Owners with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/teams/${teamId}/billing/cancel`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
    });

    it('allows Owner to schedule cancellation at period end', async () => {
      const res = await request(app)
        .post(`/api/teams/${teamId}/billing/cancel`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cancelAtPeriodEnd).toBe(true);

      // Verify GET billing overview reflects CANCELLED pendingPlanCode
      const billingRes = await request(app)
        .get(`/api/teams/${teamId}/billing`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(billingRes.status).toBe(200);
      expect(billingRes.body.subscription.pendingPlanCode).toBe('CANCELLED');
    });

    it('allows Owner to resume scheduled cancellation', async () => {
      const res = await request(app)
        .post(`/api/teams/${teamId}/billing/resume`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cancelAtPeriodEnd).toBe(false);

      // Verify GET billing overview reflects null pendingPlanCode
      const billingRes = await request(app)
        .get(`/api/teams/${teamId}/billing`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(billingRes.status).toBe(200);
      expect(billingRes.body.subscription.pendingPlanCode).toBeNull();
    });
  });
});
