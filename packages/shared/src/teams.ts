import { z } from 'zod';
import { Role } from './roles';

export const CreateTeamInputSchema = z.object({
  name: z.string().trim().min(2, 'Team name must be at least 2 characters').max(100, 'Team name cannot exceed 100 characters'),
});
export type CreateTeamInput = z.infer<typeof CreateTeamInputSchema>;

export interface TeamMembershipSummary {
  id: string;
  teamId: string;
  name: string;
  role: Role;
  joinedAt: string;
}

export interface MeResponse {
  id: string;
  email: string;
  memberships: TeamMembershipSummary[];
}

export interface TeamResponse {
  id: string;
  name: string;
  role: Role;
}

export interface TeamOverviewResponse {
  id: string;
  name: string;
  role: Role;
  subscription: {
    planCode: string;
    status: string;
    paidSeatEntitlement: number;
    activeMemberCount: number;
  } | null;
}

export const InitiatePaymentInputSchema = z.object({
  planCode: z.enum(['STARTER', 'TEAM', 'BUSINESS']),
  targetSeats: z.number().int().positive().optional(),
  idempotencyKey: z.string().trim().min(1, 'Idempotency key is required'),
});
export type InitiatePaymentInput = z.infer<typeof InitiatePaymentInputSchema>;

export const QuotePlanInputSchema = z.object({
  targetPlanCode: z.enum(['STARTER', 'TEAM', 'BUSINESS']),
  targetSeats: z.number().int().positive().optional(),
  effectiveDate: z.string().optional(),
});
export type QuotePlanInput = z.infer<typeof QuotePlanInputSchema>;

export const QuoteSeatsInputSchema = z.object({
  targetSeats: z.number().int().positive(),
  effectiveDate: z.string().optional(),
});
export type QuoteSeatsInput = z.infer<typeof QuoteSeatsInputSchema>;

export const VerifyPaymentInputSchema = z.object({
  paymentAttemptId: z.string().uuid('Valid payment attempt ID required'),
  idempotencyKey: z.string().trim().min(1, 'Idempotency key is required'),
});
export type VerifyPaymentInput = z.infer<typeof VerifyPaymentInputSchema>;

export const CreateInvitationInputSchema = z.object({
  email: z.string().email('Valid email required').optional(),
  role: z.nativeEnum(Role).default(Role.STAFF),
});
export type CreateInvitationInput = z.infer<typeof CreateInvitationInputSchema>;

export interface BillingOverviewResponse {
  teamId: string;
  teamName: string;
  plan: {
    code: string;
    name: string;
    basePriceCents: number;
    includedSeats: number;
    extraSeatCents: number | null;
  };
  subscription: {
    status: 'PENDING_INITIAL_PAYMENT' | 'ACTIVE' | 'GRACE' | 'RESTRICTED';
    paidSeatEntitlement: number;
    activeMemberCount: number;
    pendingReservationCount: number;
    periodStart: string;
    periodEnd: string;
    nextRenewalAmountCents: number;
    graceEndAt: string | null;
    pendingPlanCode?: string | null;
  };
}

export interface TeamMemberItem {
  id: string;
  userId: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'REMOVED';
  joinedAt: string;
  isSelf: boolean;
}

export interface PendingInvitationItem {
  id: string;
  email: string | null;
  role: Role;
  expiresAt: string;
  shareableLink?: string;
}

export interface TeamMembersResponse {
  teamId: string;
  teamName: string;
  activeMemberCount: number;
  pendingReservationCount: number;
  paidSeatEntitlement: number;
  members: TeamMemberItem[];
  pendingInvitations: PendingInvitationItem[];
}
