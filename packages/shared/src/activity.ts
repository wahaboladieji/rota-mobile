import { z } from 'zod';

export const ActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export type ActivityQuery = z.infer<typeof ActivityQuerySchema>;

export interface ActivityEventItem {
  id: string;
  teamId: string;
  actorId: string | null;
  actorEmail: string | null;
  actorName: string;
  type: string;
  targetId: string | null;
  payload: any;
  createdAt: string;
}

export interface ActivityFeedResponse {
  items: ActivityEventItem[];
  nextCursor: string | null;
  hasMore: boolean;
}
