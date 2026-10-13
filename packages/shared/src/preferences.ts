import { z } from 'zod';

export const AvailabilityWindowSchema = z.object({
  weekday: z.number().int().min(0).max(6), // 0 = Sunday, 1 = Monday ... 6 = Saturday
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format must be HH:mm'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format must be HH:mm'),
});
export type AvailabilityWindowInput = z.infer<typeof AvailabilityWindowSchema>;

export interface AvailabilityItem {
  id: string;
  weekday: number;
  dayName: string;
  startTime: string;
  endTime: string;
}

export const UserSettingsSchema = z.object({
  quietStart: z.string().nullable().optional(),
  quietEnd: z.string().nullable().optional(),
  timeZone: z.string(),
  shiftPush: z.boolean().default(true),
  swapPush: z.boolean().default(true),
  billingPush: z.boolean().default(true),
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  language: z.string().default('en'),
});
export type UserSettingsInput = z.infer<typeof UserSettingsSchema>;
