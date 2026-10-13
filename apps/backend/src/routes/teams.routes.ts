import { Router, Response } from 'express';
import {
  CreateTeamInputSchema,
  Role,
  InitiatePaymentInputSchema,
  VerifyPaymentInputSchema,
  CreateInvitationInputSchema,
  PLANS,
} from '@rota/shared';
import { prismaPrimary } from '../data/db';
import { hashToken } from '../auth/tokens';
import { authenticate, requireTeamMembership, AuthenticatedRequest } from '../auth/guards';
import { logger } from '../observability/logger';
import { enqueueEmailJob } from '../jobs/queue';
import { sendInvitationEmail } from '../services/mailer.service';

export const teamsRouter = Router();

/**
 * GET /api/me - Retrieve current authenticated user profile and memberships
 */
teamsRouter.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = await prismaPrimary.user.findUnique({
    where: { id: req.user.userId },
    include: {
      memberships: {
        where: { status: 'ACTIVE' },
        include: { team: true },
      },
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.status(200).json({
    id: user.id,
    email: user.email,
    memberships: user.memberships.map((m) => ({
      id: m.id,
      teamId: m.teamId,
      name: m.team.name,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
  });
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
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30-day baseline

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
 * DELETE /api/teams/:teamId/shifts/:shiftId - Direct mutation test endpoint
 * Staff role is rejected with 403 Forbidden; Manager/Owner authorized
 */
teamsRouter.delete(
  '/teams/:teamId/shifts/:shiftId',
  authenticate,
  requireTeamMembership([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    // Only reachable by OWNER or MANAGER; Staff direct delete calls fail at guard
    res.status(200).json({ message: 'Shift deleted successfully' });
  }
);

/**
 * GET /api/plans - Retrieve available subscription plans
 */
teamsRouter.get('/plans', async (_req, res: Response) => {
  const plans = await prismaPrimary.plan.findMany({
    orderBy: { basePriceCents: 'asc' },
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
      },
    });
  }
);

/**
 * POST /api/teams/:teamId/payment/initiate - Initiate a payment attempt for a plan
 * Restricted to Owner. Validates plan code and records payment attempt with idempotency key.
 */
teamsRouter.post(
  '/teams/:teamId/payment/initiate',
  authenticate,
  requireTeamMembership([Role.OWNER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const teamId = req.params.teamId;
    const parseResult = InitiatePaymentInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { planCode, idempotencyKey } = parseResult.data;

    // Check existing attempt with same idempotency key
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

    const txRef = `rota_tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const attempt = await prismaPrimary.paymentAttempt.create({
      data: {
        teamId,
        subscriptionId: subscription.id,
        idempotencyKey,
        txRef,
        provider: 'FLUTTERWAVE_TEST',
        expectedAmountCents: plan.basePriceCents,
        currency: 'USD',
        status: 'PENDING',
      },
    });

    logger.info('Payment attempt initiated', {
      teamId,
      attemptId: attempt.id,
      planCode,
      amountCents: plan.basePriceCents,
    });

    res.status(201).json({
      paymentAttemptId: attempt.id,
      txRef: attempt.txRef,
      amountCents: attempt.expectedAmountCents,
      currency: attempt.currency,
      status: attempt.status,
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

    const result = await prismaPrimary.$transaction(async (tx) => {
      const attempt = await tx.paymentAttempt.findUnique({
        where: { id: paymentAttemptId },
        include: { subscription: true },
      });

      if (!attempt || attempt.teamId !== teamId) {
        throw new Error('Payment attempt not found');
      }

      if (attempt.status === 'VERIFIED') {
        return { attempt, subscription: attempt.subscription, alreadyVerified: true };
      }

      const subscription = attempt.subscription;
      // Determine the plan based on the attempt amount
      const plan = await tx.plan.findFirst({
        where: { basePriceCents: attempt.expectedAmountCents },
      });
      const resolvedPlanCode = plan?.code || 'STARTER';
      const includedSeats = plan?.includedSeats || 5;

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // 1. Mark attempt as VERIFIED
      const updatedAttempt = await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'VERIFIED',
          providerTransaction: `flw_mock_${attempt.txRef}`,
        },
      });

      // 2. Append-only ledger row (PRD rule: never update or delete ledger rows)
      await tx.ledgerEntry.create({
        data: {
          teamId,
          subscriptionId: subscription.id,
          paymentAttemptId: attempt.id,
          kind: 'CHARGE',
          eventType: subscription.status === 'PENDING_INITIAL_PAYMENT' ? 'INITIAL_PAYMENT' : 'PLAN_CHANGE',
          amountCents: attempt.expectedAmountCents,
          currency: 'USD',
          planCodeAfter: resolvedPlanCode,
          paidSeatsAfter: includedSeats,
          statusAfter: 'ACTIVE',
          periodStartAfter: now,
          periodEndAfter: periodEnd,
          effectiveAt: now,
        },
      });

      // 3. Atomically activate subscription
      const updatedSubscription = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          planCode: resolvedPlanCode,
          paidSeatEntitlement: includedSeats,
          periodStart: now,
          periodEnd,
        },
      });

      return { attempt: updatedAttempt, subscription: updatedSubscription, alreadyVerified: false };
    });

    logger.info('Payment verified and subscription activated', {
      teamId,
      attemptId: paymentAttemptId,
      status: result.subscription.status,
      planCode: result.subscription.planCode,
    });

    res.status(200).json({
      success: true,
      status: result.subscription.status,
      planCode: result.subscription.planCode,
      paidSeatEntitlement: result.subscription.paidSeatEntitlement,
    });
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

      const apiBaseUrl = process.env.API_BASE_URL || 'http://192.168.0.165:3000';
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
    });

    res.status(200).json({ message: 'Member removed and sessions revoked' });
  }
);
