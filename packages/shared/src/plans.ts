/**
 * Plan definitions seeded in integer cents per month.
 * Source of truth: Rota PRD v2 Section 8.
 */
export interface PlanDefinition {
  code: string;
  name: string;
  basePriceCents: number;
  includedSeats: number;
  extraSeatCents: number | null;
}

export const PLANS: Record<string, PlanDefinition> = {
  STARTER: {
    code: 'STARTER',
    name: 'Starter',
    basePriceCents: 2000,
    includedSeats: 5,
    extraSeatCents: null,
  },
  TEAM: {
    code: 'TEAM',
    name: 'Team',
    basePriceCents: 5000,
    includedSeats: 15,
    extraSeatCents: 300,
  },
  BUSINESS: {
    code: 'BUSINESS',
    name: 'Business',
    basePriceCents: 12000,
    includedSeats: 40,
    extraSeatCents: 200,
  },
} as const;

export type PlanCode = keyof typeof PLANS;
