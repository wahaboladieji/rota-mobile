import { prismaPrimary } from '../data/db';
import { logger } from '../observability/logger';
import { enqueueEmailJob } from '../jobs/queue';
import { Role } from '@rota/shared';

export interface RenewalJobResult {
  graceAlertsSent: number;
  teamsRestricted: number;
  downgradesApplied: number;
}

/**
 * Marks a subscription as failed renewal and transitions to 7-day GRACE period.
 * Sends Day 0 immediate notification to Owner.
 * PRD v2 F6.6.
 */
export async function handleFailedRenewal(teamId: string, errorReason?: string): Promise<void> {
  const sub = await prismaPrimary.subscription.findUnique({
    where: { teamId },
    include: {
      team: {
        include: {
          memberships: {
            where: { role: Role.OWNER, status: 'ACTIVE' },
            include: { user: true },
          },
        },
      },
    },
  });

  if (!sub) {
    logger.warn('handleFailedRenewal: subscription not found', { teamId });
    return;
  }

  const now = new Date();
  const graceEndAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 calendar days

  await prismaPrimary.$transaction(async (tx) => {
    // 1. Transition to GRACE
    await tx.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'GRACE',
        graceEndAt,
      },
    });

    // 2. Append-only ledger record
    await tx.ledgerEntry.create({
      data: {
        teamId,
        subscriptionId: sub.id,
        kind: 'CREDIT',
        eventType: 'RENEWAL_FAILED',
        amountCents: 0,
        currency: 'USD',
        planCodeAfter: sub.planCode,
        paidSeatsAfter: sub.paidSeatEntitlement,
        statusAfter: 'GRACE',
        periodStartAfter: sub.periodStart,
        periodEndAfter: sub.periodEnd,
        effectiveAt: now,
      },
    });
  });

  // 3. Send Day 0 immediate alert to Owner
  const owner = sub.team.memberships[0]?.user;
  if (owner?.email) {
    await enqueueEmailJob({
      type: 'VERIFICATION_CODE',
      recipientEmail: owner.email,
      tokenHash: 'RENEWAL_FAILED_DAY_0',
      purpose: 'Urgent: Your Rota subscription renewal failed. Please update payment method within 7 days to avoid service restriction.',
      teamName: sub.team.name,
    });
  }

  logger.warn('Team subscription moved to GRACE period due to failed renewal', {
    teamId,
    graceEndAt,
    errorReason,
  });
}

/**
 * Checks all active and grace subscriptions:
 * 1. Restricts teams whose 7-day grace has expired (PRD F6.6).
 * 2. Sends alerts on Day 3 and Day 6 of grace.
 * 3. Applies scheduled downgrades when current periodEnd has passed.
 */
export async function processSubscriptionMaintenance(currentDate = new Date()): Promise<RenewalJobResult> {
  const result: RenewalJobResult = {
    graceAlertsSent: 0,
    teamsRestricted: 0,
    downgradesApplied: 0,
  };

  const nowMs = currentDate.getTime();

  // 1. Process GRACE subscriptions
  const graceSubscriptions = await prismaPrimary.subscription.findMany({
    where: { status: 'GRACE' },
    include: {
      team: {
        include: {
          memberships: {
            where: { role: Role.OWNER, status: 'ACTIVE' },
            include: { user: true },
          },
        },
      },
    },
  });

  for (const sub of graceSubscriptions) {
    const graceEndMs = sub.graceEndAt ? sub.graceEndAt.getTime() : 0;

    // Past 7-day grace -> Transition to RESTRICTED
    if (nowMs >= graceEndMs) {
      await prismaPrimary.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: 'RESTRICTED' },
        });

        await tx.ledgerEntry.create({
          data: {
            teamId: sub.teamId,
            subscriptionId: sub.id,
            kind: 'CREDIT',
            eventType: 'RESTRICTED_ACCESS',
            amountCents: 0,
            currency: 'USD',
            planCodeAfter: sub.planCode,
            paidSeatsAfter: sub.paidSeatEntitlement,
            statusAfter: 'RESTRICTED',
            periodStartAfter: sub.periodStart,
            periodEndAfter: sub.periodEnd,
            effectiveAt: currentDate,
          },
        });
      });

      result.teamsRestricted++;
      logger.info('Subscription transitioned to RESTRICTED after 7-day grace expired', { teamId: sub.teamId });
      continue;
    }

    // Days remaining in grace
    const daysRemaining = Math.ceil((graceEndMs - nowMs) / (1000 * 60 * 60 * 24));
    const ownerEmail = sub.team.memberships[0]?.user?.email;

    // Day 3 alert (4 days remaining of 7) or Day 6 alert (1 day remaining of 7)
    if (ownerEmail && (daysRemaining === 4 || daysRemaining === 1)) {
      await enqueueEmailJob({
        type: 'VERIFICATION_CODE',
        recipientEmail: ownerEmail,
        tokenHash: `GRACE_ALERT_DAY_${7 - daysRemaining}`,
        purpose: `Reminder: Your Rota subscription has ${daysRemaining} days of grace remaining before scheduling is restricted.`,
        teamName: sub.team.name,
      });
      result.graceAlertsSent++;
    }
  }

  // 2. Process Scheduled Downgrades
  const eligibleDowngrades = await prismaPrimary.subscription.findMany({
    where: {
      status: 'ACTIVE',
      pendingPlanCode: { not: null },
      periodEnd: { lte: currentDate },
    },
    include: { plan: true },
  });

  for (const sub of eligibleDowngrades) {
    if (!sub.pendingPlanCode) continue;

    const newPlan = await prismaPrimary.plan.findUnique({
      where: { code: sub.pendingPlanCode },
    });
    if (!newPlan) continue;

    const newPeriodEnd = new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prismaPrimary.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          planCode: newPlan.code,
          pendingPlanCode: null,
          paidSeatEntitlement: newPlan.includedSeats,
          periodStart: currentDate,
          periodEnd: newPeriodEnd,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          teamId: sub.teamId,
          subscriptionId: sub.id,
          kind: 'CREDIT',
          eventType: 'DOWNGRADE_APPLIED',
          amountCents: 0,
          currency: 'USD',
          planCodeAfter: newPlan.code,
          paidSeatsAfter: newPlan.includedSeats,
          statusAfter: 'ACTIVE',
          periodStartAfter: currentDate,
          periodEndAfter: newPeriodEnd,
          effectiveAt: currentDate,
        },
      });
    });

    result.downgradesApplied++;
    logger.info('Scheduled plan downgrade applied successfully', {
      teamId: sub.teamId,
      newPlan: newPlan.code,
    });
  }

  return result;
}
