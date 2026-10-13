import { z } from 'zod';
import { SwapStatus } from './roles';

export const SwapStatusEnum = z.nativeEnum(SwapStatus);

export const CreateSwapInputSchema = z.object({
  requesterShiftId: z.string().uuid('Valid requester shift UUID required'),
  colleagueId: z.string().uuid('Valid colleague UUID required'),
});
export type CreateSwapInput = z.infer<typeof CreateSwapInputSchema>;

export const ColleagueSwapDecisionSchema = z.object({
  decision: z.enum(['ACCEPT', 'REJECT']),
});
export type ColleagueSwapDecision = z.infer<typeof ColleagueSwapDecisionSchema>;

export const ManagerSwapDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
});
export type ManagerSwapDecision = z.infer<typeof ManagerSwapDecisionSchema>;

export interface SwapRequestItem {
  id: string;
  teamId: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  colleagueId: string;
  colleagueName: string;
  colleagueEmail: string;
  requesterShiftId: string;
  requesterShiftStart: string;
  requesterShiftEnd: string;
  status: SwapStatus;
  createdAt: string;
  updatedAt: string;
}
