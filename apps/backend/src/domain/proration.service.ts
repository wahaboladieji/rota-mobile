import { PLANS, PlanDefinition } from '@rota/shared';

export interface PlanChangeQuoteInput {
  periodStart: string | Date;
  periodEnd: string | Date;
  changedAt: string | Date;
  fromPlan: string;
  toPlan: string;
  activeSeats?: number;
  reservedInvitations?: number;
  paidSeats?: number;
}

export interface PlanChangeQuoteResult {
  periodDays: number;
  remainingDays: number;
  unusedCreditCents: number;
  remainingCostCents: number;
  dueNowCents: number;
  refundCents: number;
  nextRenewalCents: number;
  isDowngrade?: boolean;
  currentPlan?: string;
  scheduledPlan?: string;
  effectiveAt?: string | Date;
}

export interface SeatChangeQuoteInput {
  periodStart: string | Date;
  periodEnd: string | Date;
  changedAt: string | Date;
  plan: string;
  activeBefore: number;
  activeAfter: number;
  paidSeats: number;
}

export interface SeatChangeQuoteResult {
  periodDays?: number;
  remainingDays?: number;
  unusedCreditCents: number;
  remainingCostCents?: number;
  dueNowCents: number;
  refundCents: number;
  currentPeriodPaidSeats: number;
  nextRenewalCents: number;
}

/**
 * Normalizes input plan strings to canonical PlanDefinition keys (STARTER, TEAM, BUSINESS).
 */
export function normalizePlanKey(plan: string): 'STARTER' | 'TEAM' | 'BUSINESS' {
  const upper = plan.trim().toUpperCase();
  if (upper === 'STARTER' || upper === 'TEAM' || upper === 'BUSINESS') {
    return upper;
  }
  throw new Error(`Invalid plan code: ${plan}`);
}

/**
 * Returns user-facing TitleCase plan name ('Starter', 'Team', 'Business').
 */
export function formatPlanName(plan: string): 'Starter' | 'Team' | 'Business' {
  const key = normalizePlanKey(plan);
  if (key === 'STARTER') return 'Starter';
  if (key === 'TEAM') return 'Team';
  return 'Business';
}

/**
 * Calculates monthly price in integer cents per PRD v2 Section 8.
 *
 * - Starter: 2000 cents (capacity cannot exceed 5 seats)
 * - Team: 5000 cents base (includes 15 seats) + 300 cents per extra seat
 * - Business: 12000 cents base (includes 40 seats) + 200 cents per extra seat
 */
export function calculateMonthlyPrice(plan: string, chargeableSeats: number): number {
  const key = normalizePlanKey(plan);
  const def = PLANS[key];

  if (key === 'STARTER') {
    if (chargeableSeats > 5) {
      throw new Error(`Starter capacity cannot exceed 5 seats. Current seats: ${chargeableSeats}`);
    }
    return def.basePriceCents;
  }

  const extraSeats = Math.max(0, chargeableSeats - def.includedSeats);
  const extraRate = def.extraSeatCents || 0;
  return def.basePriceCents + extraSeats * extraRate;
}

/**
 * Calculates whole UTC calendar days between two dates, and elapsed/remaining days.
 * The periodEnd date is exclusive.
 */
export function calculatePeriodDays(
  periodStart: string | Date,
  periodEnd: string | Date,
  changedAt: string | Date
): { periodDays: number; elapsedDays: number; remainingDays: number } {
  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);
  const changeDate = new Date(changedAt);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || isNaN(changeDate.getTime())) {
    throw new Error('Invalid date provided to calculatePeriodDays');
  }

  const utcStart = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
  const utcEnd = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
  const utcChange = Date.UTC(changeDate.getUTCFullYear(), changeDate.getUTCMonth(), changeDate.getUTCDate());

  const msPerDay = 1000 * 60 * 60 * 24;
  const periodDays = Math.round((utcEnd - utcStart) / msPerDay);

  if (periodDays <= 0) {
    throw new Error(`Invalid billing period: periodEnd (${endDate.toISOString()}) must be after periodStart (${startDate.toISOString()})`);
  }

  // Validate change belongs to the recorded period
  if (utcChange < utcStart || utcChange >= utcEnd) {
    throw new Error(
      `Changed date (${changeDate.toISOString()}) is outside the recorded billing period [${startDate.toISOString()} - ${endDate.toISOString()})`
    );
  }

  const elapsedDays = Math.round((utcChange - utcStart) / msPerDay);
  const remainingDays = periodDays - elapsedDays;

  return { periodDays, elapsedDays, remainingDays };
}

/**
 * Computes proration quote for a mid-period plan change.
 * Enforces PRD Section 8 & AGENTS.md Rule 9 separate-floor rounding order:
 *
 * 1. unusedCreditCents = floor(oldMonthlyCents × remainingDays / periodDays)
 * 2. remainingCostCents = floor(newMonthlyCents × remainingDays / periodDays)
 * 3. dueNowCents = max(0, remainingCostCents - unusedCreditCents)
 *
 * Downgrades and cost reductions take effect next period with no immediate credit or refund.
 */
export function calculatePlanChangeProration(input: PlanChangeQuoteInput): PlanChangeQuoteResult {
  const { periodStart, periodEnd, changedAt, fromPlan, toPlan } = input;
  const fromKey = normalizePlanKey(fromPlan);
  const toKey = normalizePlanKey(toPlan);

  const { periodDays, remainingDays } = calculatePeriodDays(periodStart, periodEnd, changedAt);

  const activeSeats = input.activeSeats ?? (fromKey === 'STARTER' ? 5 : 15);
  const paidSeats = input.paidSeats ?? (fromKey === 'STARTER' ? 5 : 15);

  const oldMonthlyCents = calculateMonthlyPrice(fromKey, paidSeats);
  const newMonthlyCents = calculateMonthlyPrice(toKey, activeSeats);

  // Determine if this is a downgrade or cost reduction
  const planOrder = { STARTER: 1, TEAM: 2, BUSINESS: 3 };
  const isPlanDowngrade = planOrder[toKey] < planOrder[fromKey];
  const isCostReduction = newMonthlyCents < oldMonthlyCents;

  if (isPlanDowngrade || isCostReduction) {
    // Capacity check: if downgrading to Starter, cannot exceed 5 seats
    if (toKey === 'STARTER' && activeSeats > 5) {
      throw new Error(`Cannot downgrade to Starter: active members (${activeSeats}) exceed Starter capacity (5).`);
    }

    return {
      periodDays,
      remainingDays,
      unusedCreditCents: 0,
      remainingCostCents: 0,
      dueNowCents: 0,
      refundCents: 0,
      isDowngrade: true,
      currentPlan: formatPlanName(fromPlan),
      scheduledPlan: formatPlanName(toPlan),
      effectiveAt: periodEnd,
      nextRenewalCents: newMonthlyCents,
    };
  }

  // Chargeable increase: Exact integer arithmetic with separate floor rounding
  const unusedCreditCents = Number((BigInt(oldMonthlyCents) * BigInt(remainingDays)) / BigInt(periodDays));
  const remainingCostCents = Number((BigInt(newMonthlyCents) * BigInt(remainingDays)) / BigInt(periodDays));
  const dueNowCents = Math.max(0, remainingCostCents - unusedCreditCents);

  return {
    periodDays,
    remainingDays,
    unusedCreditCents,
    remainingCostCents,
    dueNowCents,
    refundCents: 0,
    isDowngrade: false,
    currentPlan: formatPlanName(fromPlan),
    scheduledPlan: formatPlanName(toPlan),
    nextRenewalCents: newMonthlyCents,
  };
}

/**
 * Computes proration quote for seat capacity adjustments.
 * Enforces PRD Section 8:
 * - Removal creates no credit or refund, but preserves prepaid seat capacity for the current period.
 * - Refilling an already-paid place costs 0.
 * - Extra seat purchase charges proration for remaining days only when activeAfter > paidSeats.
 */
export function calculateSeatChangeProration(input: SeatChangeQuoteInput): SeatChangeQuoteResult {
  const { periodStart, periodEnd, changedAt, plan, activeBefore, activeAfter, paidSeats } = input;
  const planKey = normalizePlanKey(plan);

  const { periodDays, remainingDays } = calculatePeriodDays(periodStart, periodEnd, changedAt);

  // Case A: Member Removal (activeBefore > activeAfter)
  if (activeAfter < activeBefore) {
    const nextRenewalCents = calculateMonthlyPrice(planKey, activeAfter);
    return {
      dueNowCents: 0,
      unusedCreditCents: 0,
      refundCents: 0,
      currentPeriodPaidSeats: paidSeats, // prepaid capacity preserved
      nextRenewalCents,
    };
  }

  // Case B: Same-period Refill of Prepaid Seat (activeAfter <= paidSeats)
  if (activeAfter <= paidSeats) {
    const nextRenewalCents = calculateMonthlyPrice(planKey, activeAfter);
    return {
      dueNowCents: 0,
      unusedCreditCents: 0,
      refundCents: 0,
      currentPeriodPaidSeats: paidSeats,
      nextRenewalCents,
    };
  }

  // Case C: Seat Increase above prepaid capacity (activeAfter > paidSeats)
  if (planKey === 'STARTER' && activeAfter > 5) {
    throw new Error('Starter plan cannot add additional seats beyond 5 included seats.');
  }

  const oldMonthlyCents = calculateMonthlyPrice(planKey, paidSeats);
  const newMonthlyCents = calculateMonthlyPrice(planKey, activeAfter);

  const unusedCreditCents = Number((BigInt(oldMonthlyCents) * BigInt(remainingDays)) / BigInt(periodDays));
  const remainingCostCents = Number((BigInt(newMonthlyCents) * BigInt(remainingDays)) / BigInt(periodDays));
  const dueNowCents = Math.max(0, remainingCostCents - unusedCreditCents);
  const nextRenewalCents = newMonthlyCents;

  return {
    periodDays,
    remainingDays,
    unusedCreditCents,
    remainingCostCents,
    dueNowCents,
    refundCents: 0,
    currentPeriodPaidSeats: activeAfter,
    nextRenewalCents,
  };
}
