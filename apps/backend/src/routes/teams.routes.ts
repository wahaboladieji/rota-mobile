import { Router, Response } from 'express';
import {
  CreateTeamInputSchema,
  Role,
  InitiatePaymentInputSchema,
  VerifyPaymentInputSchema,
  CreateInvitationInputSchema,
  QuotePlanInputSchema,
  QuoteSeatsInputSchema,
  PLANS,
} from '@rota/shared';
import { prismaPrimary } from '../data/db';
import { serverConfig, schedulingConfig } from '../config';
import { hashToken } from '../auth/tokens';
import { authenticate, requireTeamMembership, AuthenticatedRequest } from '../auth/guards';
import { logger } from '../observability/logger';
import { enqueueEmailJob } from '../jobs/queue';
import { sendInvitationEmail } from '../services/mailer.service';
import { FlutterwaveAdapter } from '../payments/flutterwave';
import { verifyAndSettlePaymentAttempt } from '../domain/payment-settlement.service';
import {
  calculatePlanChangeProration,
  calculateSeatChangeProration,
  calculateMonthlyPrice,
} from '../domain/proration.service';
import { invitationsRateLimiter, paymentInitiateRateLimiter } from '../middleware/rate-limiter';
import { getOrSetCache, invalidateCache, CACHE_TTL } from '../services/cache.service';

export const teamsRouter = Router();

/**
 * GET /api/me - Retrieve current authenticated user profile and memberships
 */
teamsRouter.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const userProfile = await getOrSetCache(
    `cache:user:${req.user.userId}:me`,
    CACHE_TTL.USER_PROFILE,
    async () => {
      const user = await prismaPrimary.user.findUnique({
        where: { id: req.user!.userId },
        include: {
          memberships: {
            where: { status: 'ACTIVE' },
            include: { team: true },
          },
        },
      });

      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        memberships: user.memberships.map((m) => ({
          id: m.id,
          teamId: m.teamId,
          name: m.team.name,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
        })),
      };
    }
  );

  if (!userProfile) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.status(200).json(userProfile);
});

/**
 * POST /api/teams - Create a team and establish server-controlled Owner membership
 */
teamsRouter.post('/teams', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parseResult = CreateTeamInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    return;
  }

  const { name } = parseResult.data;
  const now = new Date();
  const periodEnd = new Date(now.getTime() + schedulingConfig.baselineBillingPeriodDays * 24 * 60 * 60 * 1000); // Baseline billing period from config

  const result = await prismaPrimary.$transaction(async (tx) => {
    const team = await tx.team.create({
      data: {
        name,
        ownerId: req.user!.userId,
      },
    });

    const membership = await tx.membership.create({
      data: {
        teamId: team.id,
        userId: req.user!.userId,
        role: Role.OWNER,
        status: 'ACTIVE',
      },
    });

    // Create baseline subscription in PENDING_INITIAL_PAYMENT
    await tx.subscription.create({
      data: {
        teamId: team.id,
        planCode: 'STARTER',
        status: 'PENDING_INITIAL_PAYMENT',
        paidSeatEntitlement: 5,
        activeMemberCount: 1,
        periodStart: now,
        periodEnd,
      },
    });

    return {
      team: {
        id: team.id,
        name: team.name,
        role: membership.role,
      },
    };
  });

  await invalidateCache(`cache:user:${req.user.userId}:me`);

  logger.info('Team created with Owner membership', {
    teamId: result.team.id,
    userId: req.user.userId,
  });

  res.status(201).json(result);
});

/**
 * GET /api/teams/:teamId - Get team overview (Enforces active membership & team isolation)
 */
teamsRouter.get(
  '/teams/:teamId',
  authenticate,
  requireTeamMembership(),
  async (req: AuthenticatedRequest, res: Response) => {
    const team = await prismaPrimary.team.findUnique({
      where: { id: req.params.teamId },
      include: {
        subscription: true,
      },
    });

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    res.status(200).json({
      id: team.id,
      name: team.name,
      role: req.membership!.role,
      subscription: team.subscription
        ? {
            planCode: team.subscription.planCode,
            status: team.subscription.status,
            paidSeatEntitlement: team.subscription.paidSeatEntitlement,
            activeMemberCount: team.subscription.activeMemberCount,
          }
        : null,
    });
  }
);


/**
 * GET /api/plans - Retrieve available subscription plans (Cached with 1-hour TTL)
 */
teamsRouter.get('/plans', async (_req, res: Response) => {
  const plans = await getOrSetCache('cache:plans', CACHE_TTL.PLANS, async () => {
    return prismaPrimary.plan.findMany({
      orderBy: { basePriceCents: 'asc' },
    });
  });
  res.status(200).json({ plans });
});

/**
 * GET /api/teams/:teamId/billing - Overview of billing, seats, renewal, and state
 * Restricted to team Owner on PostgreSQL primary.
 */
teamsRouter.get(
  '/teams/:teamId/billing',
  authenticate,
  requireTeamMembership([Role.OWNER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const teamId = req.params.teamId;

    const team = await prismaPrimary.team.findUnique({
      where: { id: teamId },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (!team || !team.subscription) {
      res.status(404).json({ error: 'Team subscription not found' });
      return;
    }

    const now = new Date();
    const activeMemberCount = await prismaPrimary.membership.count({
      where: { teamId, status: 'ACTIVE' },
    });

    const pendingReservationCount = await prismaPrimary.invitation.count({
      where: {
        teamId,
        revokedAt: null,
        acceptedAt: null,
        expiresAt: { gt: now },
      },
    });

    const sub = team.subscription;
    const plan = sub.plan;

    // Proration & Renewal calculation per PRD v2 Section 8
    let nextRenewalAmountCents = plan.basePriceCents;
    if (plan.extraSeatCents && activeMemberCount > plan.includedSeats) {
      const extraSeats = activeMemberCount - plan.includedSeats;
      nextRenewalAmountCents += extraSeats * plan.extraSeatCents;
    }

    res.status(200).json({
      teamId: team.id,
      teamName: team.name,
      plan: {
        code: plan.code,
        name: PLANS[plan.code]?.name || plan.code,
        basePriceCents: plan.basePriceCents,
        includedSeats: plan.includedSeats,
        extraSeatCents: plan.extraSeatCents,
      },
      subscription: {
        status: sub.status,
        paidSeatEntitlement: sub.paidSeatEntitlement,
        activeMemberCount,
        pendingReservationCount,
        periodStart: sub.periodStart.toISOString(),
        periodEnd: sub.periodEnd.toISOString(),
        nextRenewalAmountCents,
        graceEndAt: sub.graceEndAt ? sub.graceEndAt.toISOString() : null,
        pendingPlanCode: sub.pendingPlanCode || null,
      },
    });
  }
);

/**
 * POST /api/teams/:teamId/billing/cancel - Schedule subscription cancellation at periodEnd
 * Restricted to Owner.
 */
teamsRouter.post(
  '/teams/:teamId/billing/cancel',
  authenticate,
  requireTeamMembership([Role.OWNER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const teamId = req.params.teamId;

    const subscription = await prismaPrimary.subscription.findUnique({
      where: { teamId },
    });

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    if (subscription.status === 'PENDING_INITIAL_PAYMENT') {
      res.status(400).json({ error: 'Cannot cancel an unsubscribed team' });
      return;
    }

    await prismaPrimary.subscription.update({
      where: { id: subscription.id },
      data: { pendingPlanCode: 'CANCELLED' },
    });

    logger.info('Subscription cancellation scheduled at period end', {
      teamId,
      subscriptionId: subscription.id,
      effectiveAt: subscription.periodEnd,
    });

    res.status(200).json({
      success: true,
      cancelAtPeriodEnd: true,
      status: 'SCHEDULED_AT_PERIOD_END',
      message: `Subscription cancellation scheduled for ${subscription.periodEnd.toISOString()}. Full access remains active until then.`,
      pendingPlanCode: 'CANCELLED',
      effectiveAt: subscription.periodEnd.toISOString(),
    });
  }
);

/**
 * POST /api/teams/:teamId/billing/resume - Resume scheduled subscription cancellation
 * Restricted to Owner.
 */
teamsRouter.post(
  '/teams/:teamId/billing/resume',
  authenticate,
  requireTeamMembership([Role.OWNER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const teamId = req.params.teamId;

    const subscription = await prismaPrimary.subscription.findUnique({
      where: { teamId },
    });

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    await prismaPrimary.subscription.update({
      where: { id: subscription.id },
      data: { pendingPlanCode: null },
    });

    logger.info('Subscription cancellation reverted / resumed', {
      teamId,
      subscriptionId: subscription.id,
    });

    res.status(200).json({
      success: true,
      cancelAtPeriodEnd: false,
      status: 'ACTIVE',
      message: `Subscription resumed. Automatic renewal will proceed on ${subscription.periodEnd.toISOString()}.`,
      pendingPlanCode: null,
    });
  }
);

/**
 * POST /api/teams/:teamId/billing/quote-plan - Quote plan upgrade or downgrade proration
 * Restricted to Owner.
 */
teamsRouter.post(
  '/teams/:teamId/billing/quote-plan',
  authenticate,
  requireTeamMembership([Role.OWNER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const teamId = req.params.teamId;
    const parseResult = QuotePlanInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { targetPlanCode, targetSeats, effectiveDate } = parseResult.data;

    const subscription = await prismaPrimary.subscription.findUnique({
      where: { teamId },
      include: { plan: true },
    });

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    try {
      const quote = calculatePlanChangeProration({
        fromPlan: subscription.planCode,
        toPlan: targetPlanCode,
        paidSeats: subscription.paidSeatEntitlement,
        activeSeats: targetSeats ?? subscription.activeMemberCount,
        periodStart: subscription.periodStart,
        periodEnd: subscription.periodEnd,
        changedAt: effectiveDate ? new Date(effectiveDate) : new Date(),
      });

      res.status(200).json(quote);
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to quote plan change' });
    }
  }
);

/**
 * POST /api/teams/:teamId/billing/quote-seats - Quote seat change proration
 * Restricted to Owner.
 */
teamsRouter.post(
  '/teams/:teamId/billing/quote-seats',
  authenticate,
  requireTeamMembership([Role.OWNER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const teamId = req.params.teamId;
    const parseResult = QuoteSeatsInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { targetSeats, effectiveDate } = parseResult.data;

    const subscription = await prismaPrimary.subscription.findUnique({
      where: { teamId },
      include: { plan: true },
    });

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    try {
      const quote = calculateSeatChangeProration({
        plan: subscription.planCode,
        activeBefore: subscription.paidSeatEntitlement,
        activeAfter: targetSeats,
        paidSeats: subscription.paidSeatEntitlement,
        periodStart: subscription.periodStart,
        periodEnd: subscription.periodEnd,
        changedAt: effectiveDate ? new Date(effectiveDate) : new Date(),
      });

      res.status(200).json(quote);
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to quote seat change' });
    }
  }
);

/**
 * POST /api/teams/:teamId/payment/initiate - Initiate a payment attempt for a plan or seat upgrade
 * Restricted to Owner. Handles initial subscription, mid-period prorated upgrades, and scheduled downgrades.
 */
teamsRouter.post(
  '/teams/:teamId/payment/initiate',
  authenticate,
  requireTeamMembership([Role.OWNER]),
  paymentInitiateRateLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const teamId = req.params.teamId;
    const parseResult = InitiatePaymentInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { planCode, targetSeats, idempotencyKey } = parseResult.data;

    // Check existing attempt with same idempotency key (idempotency safety)
    const existing = await prismaPrimary.paymentAttempt.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      res.status(200).json({
        paymentAttemptId: existing.id,
        txRef: existing.txRef,
        amountCents: existing.expectedAmountCents,
        currency: existing.currency,
        status: existing.status,
      });
      return;
    }

    const plan = await prismaPrimary.plan.findUnique({
      where: { code: planCode },
    });
    if (!plan) {
      res.status(404).json({ error: 'Selected plan not found' });
      return;
    }

    const subscription = await prismaPrimary.subscription.findUnique({
      where: { teamId },
    });
    if (!subscription) {
      res.status(404).json({ error: 'Subscription record not found' });
      return;
    }

    // D5 Decision validation: Starter has strict 5-seat cap; Team & Business require >= includedSeats
    const desiredSeats = targetSeats ?? plan.includedSeats;
    if (planCode === 'STARTER' && desiredSeats > 5) {
      res.status(400).json({
        error: 'Starter plan is limited to 5 seats. Upgrade to Team or Business for extra seats.',
      });
      return;
    }
    if (desiredSeats < plan.includedSeats) {
      res.status(400).json({
        error: `Cannot select fewer than ${plan.includedSeats} included seats for ${planCode}`,
      });
      return;
    }

    let chargeAmountCents = 0;
    let isMidPeriodUpgrade = false;
    let quoteMetadata: Record<string, unknown> = {};

    const now = new Date();

    try {
      if (subscription.status === 'PENDING_INITIAL_PAYMENT') {
        // Initial subscription setup: charges full monthly plan price
        chargeAmountCents = calculateMonthlyPrice(planCode, desiredSeats);
      } else {
        // Existing active or past_due subscription
        if (subscription.planCode === planCode) {
          // Seat change on the same plan
          if (desiredSeats < subscription.paidSeatEntitlement) {
            // Seat reduction: scheduled for next period per AGENTS.md rule 9 (no immediate refund)
            await prismaPrimary.subscription.update({
              where: { id: subscription.id },
              data: { pendingPlanCode: planCode },
            });
            res.status(200).json({
              status: 'SCHEDULED_AT_PERIOD_END',
              message: `Seat reduction to ${desiredSeats} seats scheduled for next billing period on ${subscription.periodEnd.toISOString()}`,
              targetSeats: desiredSeats,
              effectiveAt: subscription.periodEnd.toISOString(),
            });
            return;
          }

          const quote = calculateSeatChangeProration({
            plan: planCode,
            activeBefore: subscription.paidSeatEntitlement,
            activeAfter: desiredSeats,
            paidSeats: subscription.paidSeatEntitlement,
            periodStart: subscription.periodStart,
            periodEnd: subscription.periodEnd,
            changedAt: now,
          });

          chargeAmountCents = quote.dueNowCents;
          isMidPeriodUpgrade = true;
          quoteMetadata = { ...quote };
        } else {
          // Plan change
          const quote = calculatePlanChangeProration({
            fromPlan: subscription.planCode,
            toPlan: planCode,
            paidSeats: subscription.paidSeatEntitlement,
            activeSeats: desiredSeats,
            periodStart: subscription.periodStart,
            periodEnd: subscription.periodEnd,
            changedAt: now,
          });

          if (quote.isDowngrade) {
            // Downgrade: scheduled for next period per PRD Section 8 / AGENTS.md rule 9
            await prismaPrimary.subscription.update({
              where: { id: subscription.id },
              data: { pendingPlanCode: planCode },
            });
            res.status(200).json({
              status: 'SCHEDULED_AT_PERIOD_END',
              message: `Downgrade to ${planCode} scheduled for next billing period on ${subscription.periodEnd.toISOString()}`,
              pendingPlanCode: planCode,
              effectiveAt: subscription.periodEnd.toISOString(),
            });
            return;
          }

          chargeAmountCents = quote.dueNowCents;
          isMidPeriodUpgrade = true;
          quoteMetadata = { ...quote };
        }
      }
    } catch (calcErr: unknown) {
      res.status(400).json({ error: calcErr instanceof Error ? calcErr.message : 'Proration calculation failed' });
      return;
    }

    if (chargeAmountCents <= 0) {
      res.status(400).json({ error: 'No charge due for this operation' });
      return;
    }

    const user = await prismaPrimary.user.findUnique({
      where: { id: req.user!.userId },
    });

    const txRef = `rota_tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Call Flutterwave provider adapter to create hosted checkout link
    let checkoutUrl = '';
    try {
      const apiBase = serverConfig.apiBaseUrl;
      const flwInit = await FlutterwaveAdapter.initializePayment({
        txRef,
        amountCents: chargeAmountCents,
        currency: 'USD',
        customerEmail: user?.email || 'owner@rota.app',
        customerName: 'Rota Owner',
        redirectUrl: `${apiBase}/api/payment/callback`,
        title: isMidPeriodUpgrade ? `Rota Subscription Upgrade` : `Rota ${plan.code} Subscription`,
        description: isMidPeriodUpgrade
          ? `Mid-period upgrade to ${plan.code} (${desiredSeats} seats) - $${(chargeAmountCents / 100).toFixed(2)}`
          : `${plan.code} Plan (${desiredSeats} seats) - $${(chargeAmountCents / 100).toFixed(2)}/mo`,
        meta: {
          teamId,
          subscriptionId: subscription.id,
          planCode,
          targetSeats: String(desiredSeats),
          isMidPeriodUpgrade: String(isMidPeriodUpgrade),
        },
      });
      checkoutUrl = flwInit.checkoutUrl;
    } catch (err: unknown) {
      logger.error('Flutterwave payment initialization failed', err);
      res.status(502).json({ error: 'Payment gateway initiation failed' });
      return;
    }

    const attempt = await prismaPrimary.$transaction(async (tx) => {
      const createdAttempt = await tx.paymentAttempt.create({
        data: {
          teamId,
          subscriptionId: subscription.id,
          idempotencyKey,
          txRef,
          provider: 'FLUTTERWAVE_TEST',
          expectedAmountCents: chargeAmountCents,
          currency: 'USD',
          status: 'PENDING',
        },
      });

      // Stage 1 PaymentLog: USER_INITIATED
      await tx.paymentLog.create({
        data: {
          teamId,
          paymentAttemptId: createdAttempt.id,
          stage: 'USER_INITIATED',
          attemptCreatedAt: createdAttempt.createdAt,
          eventType: 'USER_INITIATED',
          message: isMidPeriodUpgrade
            ? `Owner initiated prorated upgrade to ${plan.code} (${desiredSeats} seats, $${(chargeAmountCents / 100).toFixed(2)})`
            : `Owner initiated payment for ${plan.code} plan (${desiredSeats} seats, $${(chargeAmountCents / 100).toFixed(2)})`,
          metadata: {
            planCode,
            targetSeats: desiredSeats,
            amountCents: chargeAmountCents,
            isMidPeriodUpgrade,
            txRef,
            checkoutUrl,
            ...quoteMetadata,
          },
        },
      });

      return createdAttempt;
    });

    logger.info('Payment attempt initiated', {
      teamId,
      attemptId: attempt.id,
      planCode,
      amountCents: chargeAmountCents,
      isMidPeriodUpgrade,
    });

    res.status(201).json({
      paymentAttemptId: attempt.id,
      txRef: attempt.txRef,
      amountCents: attempt.expectedAmountCents,
      currency: attempt.currency,
      status: attempt.status,
      checkoutUrl,
    });
  }
);

/**
 * POST /api/teams/:teamId/payment/verify - Verifies payment attempt and atomically activates subscription
 * Updates ledger, sets subscription to ACTIVE, and sets paidSeatEntitlement.
 */
teamsRouter.post(
  '/teams/:teamId/payment/verify',
  authenticate,
  requireTeamMembership([Role.OWNER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const teamId = req.params.teamId;
    const parseResult = VerifyPaymentInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { paymentAttemptId } = parseResult.data;

    const result = await verifyAndSettlePaymentAttempt({
      paymentAttemptId,
      source: 'SYNC',
    });

    if (!result.success && result.status !== 'ALREADY_VERIFIED') {
      res.status(400).json({ error: result.message || 'Payment verification failed' });
      return;
    }

    const subscription = result.subscription as {
      status?: string;
      planCode?: string;
      paidSeatEntitlement?: number;
    } | undefined;

    res.status(200).json({
      success: true,
      status: subscription?.status || 'ACTIVE',
      planCode: subscription?.planCode,
      paidSeatEntitlement: subscription?.paidSeatEntitlement,
    });
  }
);

/**
 * POST /api/teams/:teamId/payment/sync - Checks and syncs payment status with Flutterwave
 * Triggered by mobile PaymentPendingScreen or user "Check payment status" button.
 */
teamsRouter.post(
  '/teams/:teamId/payment/sync',
  authenticate,
  requireTeamMembership([Role.OWNER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const teamId = req.params.teamId;
    const { paymentAttemptId } = req.body || {};

    const attempt = await prismaPrimary.paymentAttempt.findFirst({
      where: {
        teamId,
        ...(paymentAttemptId ? { id: paymentAttemptId } : { status: 'PENDING' }),
      },
      orderBy: { createdAt: 'desc' },
      include: { subscription: true },
    });

    if (!attempt) {
      const sub = await prismaPrimary.subscription.findUnique({ where: { teamId } });
      res.status(200).json({
        success: sub?.status === 'ACTIVE',
        status: sub?.status === 'ACTIVE' ? 'VERIFIED' : 'NO_PENDING_ATTEMPT',
        subscription: sub,
      });
      return;
    }

    const result = await verifyAndSettlePaymentAttempt({
      paymentAttemptId: attempt.id,
      txRef: attempt.txRef,
      source: 'SYNC',
    });

    res.status(200).json({
      success: result.success,
      status: result.status,
      message: result.message,
      subscription: result.subscription,
    });
  }
);

/**
 * GET /api/teams/:teamId/payment-logs - Retrieve payment lifecycle audit logs (Owner only)
 */
teamsRouter.get(
  '/teams/:teamId/payment-logs',
  authenticate,
  requireTeamMembership([Role.OWNER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const teamId = req.params.teamId;
    const logs = await prismaPrimary.paymentLog.findMany({
      where: { teamId },
      orderBy: [
        { attemptCreatedAt: 'desc' },
        { createdAt: 'asc' },
      ],
      take: 50,
    });
    res.status(200).json({ logs });
  }
);

/**
 * GET /api/teams/:teamId/members - Retrieve active members and pending invitations
 */
teamsRouter.get(
  '/teams/:teamId/members',
  authenticate,
  requireTeamMembership(),
  async (req: AuthenticatedRequest, res: Response) => {
    const teamId = req.params.teamId;
    const now = new Date();

    const team = await prismaPrimary.team.findUnique({
      where: { id: teamId },
      include: {
        subscription: true,
        memberships: {
          where: { status: 'ACTIVE' },
          include: { user: true },
          orderBy: { joinedAt: 'asc' },
        },
        invitations: {
          where: {
            revokedAt: null,
            acceptedAt: null,
            expiresAt: { gt: now },
          },
          orderBy: { expiresAt: 'asc' },
        },
      },
    });

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const currentUserId = req.user!.userId;
    const isOwnerOrManager = req.membership!.role === Role.OWNER || req.membership!.role === Role.MANAGER;

    res.status(200).json({
      teamId: team.id,
      teamName: team.name,
      activeMemberCount: team.memberships.length,
      pendingReservationCount: team.invitations.length,
      paidSeatEntitlement: team.subscription?.paidSeatEntitlement || 5,
      members: team.memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user.email,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt.toISOString(),
        isSelf: m.userId === currentUserId,
      })),
      pendingInvitations: isOwnerOrManager
        ? team.invitations.map((inv) => ({
            id: inv.id,
            email: inv.email,
            role: inv.role,
            expiresAt: inv.expiresAt.toISOString(),
          }))
        : [],
    });
  }
);

/**
 * POST /api/teams/:teamId/invitations - Create invitation with concurrency-safe capacity check
 */
teamsRouter.post(
  '/teams/:teamId/invitations',
  authenticate,
  requireTeamMembership([Role.OWNER]),
  invitationsRateLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const teamId = req.params.teamId;
    const parseResult = CreateInvitationInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { email, role } = parseResult.data;
    const now = new Date();

    try {
      const { invitation, teamName, rawToken } = await prismaPrimary.$transaction(async (tx) => {
        const team = await tx.team.findUnique({
          where: { id: teamId },
          include: { subscription: true },
        });

        if (!team || !team.subscription) {
          throw new Error('Team or subscription not found');
        }

        // PRD D1 Check: Prepayment invitations blocked in PENDING_INITIAL_PAYMENT
        if (team.subscription.status === 'PENDING_INITIAL_PAYMENT') {
          const err = new Error('Subscription required: Complete payment before inviting team members');
          (err as unknown as { statusCode: number }).statusCode = 403;
          throw err;
        }

        const activeCount = await tx.membership.count({
          where: { teamId, status: 'ACTIVE' },
        });

        const pendingCount = await tx.invitation.count({
          where: {
            teamId,
            revokedAt: null,
            acceptedAt: null,
            expiresAt: { gt: now },
          },
        });

        const capacity = team.subscription.paidSeatEntitlement;
        if (activeCount + pendingCount >= capacity) {
          const err = new Error(`Capacity reached: ${capacity} seats are occupied or reserved.`);
          (err as unknown as { statusCode: number }).statusCode = 409;
          throw err;
        }

        const rawToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7-day expiration

        const created = await tx.invitation.create({
          data: {
            teamId,
            inviterId: req.user!.userId,
            email: email || null,
            role,
            tokenHash,
            expiresAt,
          },
        });

        return { invitation: created, teamName: team.name, rawToken };
      });

      const apiBaseUrl = serverConfig.apiBaseUrl;
      const inviteUrl = `${apiBaseUrl}/invite/${rawToken}`;

      // Dispatch invitation email if recipient email is provided
      if (email) {
        try {
          await enqueueEmailJob(
            {
              type: 'INVITATION',
              recipientEmail: email,
              tokenHash: rawToken,
              linkUrl: inviteUrl,
              teamName,
              invitedRole: role,
            },
            req.headers['x-request-id'] as string
          );
          logger.info('Invitation email enqueued successfully', { email, teamName, role });
        } catch (queueErr) {
          logger.warn('Redis job queue enqueue failed, falling back to direct Nodemailer dispatch', { queueErr });
          try {
            await sendInvitationEmail(email, teamName, role, inviteUrl, rawToken);
            logger.info('Invitation email dispatched directly via Nodemailer', { email });
          } catch (mailErr) {
            logger.error('Direct invitation email dispatch also failed', mailErr, { email });
          }
        }
      }

      res.status(201).json({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token: rawToken,
        inviteUrl,
        expiresAt: invitation.expiresAt.toISOString(),
      });
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode || 500;
      res.status(statusCode).json({ error: err instanceof Error ? err.message : 'Failed to create invitation' });
    }
  }
);

/**
 * DELETE /api/teams/:teamId/invitations/:invitationId - Revoke pending invitation
 */
teamsRouter.delete(
  '/teams/:teamId/invitations/:invitationId',
  authenticate,
  requireTeamMembership([Role.OWNER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { teamId, invitationId } = req.params;

    const result = await prismaPrimary.invitation.updateMany({
      where: {
        id: invitationId,
        teamId,
        revokedAt: null,
        acceptedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Invitation not found or already revoked/accepted' });
      return;
    }

    res.status(200).json({ message: 'Invitation revoked successfully' });
  }
);

/**
 * DELETE /api/teams/:teamId/members/:memberId - Remove member from team
 * Ends access immediately, revokes sessions, preserves paid capacity (no midperiod refund).
 */
teamsRouter.delete(
  '/teams/:teamId/members/:memberId',
  authenticate,
  requireTeamMembership([Role.OWNER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { teamId, memberId } = req.params;

    const membership = await prismaPrimary.membership.findFirst({
      where: { id: memberId, teamId },
      include: { team: true },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    if (membership.userId === req.user!.userId) {
      res.status(400).json({ error: 'Cannot remove yourself as Owner' });
      return;
    }

    await prismaPrimary.$transaction(async (tx) => {
      // 1. Mark membership as REMOVED
      await tx.membership.update({
        where: { id: memberId },
        data: { status: 'REMOVED' },
      });

      // 2. Revoke user's active sessions (PRD rule 6)
      await tx.session.updateMany({
        where: { userId: membership.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // 3. Immediately invalidate and clear push tokens for removed member (AGENTS.md rule 6 / PRD F6.5)
      await tx.device.updateMany({
        where: { userId: membership.userId, invalidatedAt: null },
        data: { invalidatedAt: new Date(), pushToken: null },
      });
    });

    await invalidateCache(`cache:user:${membership.userId}:me`);
    await invalidateCache(`cache:team:${teamId}:members`);

    res.status(200).json({ message: 'Member removed, sessions revoked, and push tokens cleared' });
  }
);
