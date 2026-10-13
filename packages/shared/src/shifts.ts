import { z } from 'zod';
import { ShiftStatus } from './roles';

export const ShiftStatusEnum = z.nativeEnum(ShiftStatus);

export const CreateShiftInputSchema = z.object({
  assigneeId: z.string().uuid('Valid assignee UUID required'),
  startAt: z.string().datetime('Valid ISO start time required'),
  endAt: z.string().datetime('Valid ISO end time required'),
});
export type CreateShiftInput = z.infer<typeof CreateShiftInputSchema>;

export interface ShiftItem {
  id: string;
  teamId: string;
  assigneeId: string;
  assigneeName: string;
  assigneeRole: string;
  startAt: string;
  endAt: string;
  status: ShiftStatus;
  version: number;
}
