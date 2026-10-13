import { Router, Response } from 'express';
import { Role } from '@rota/shared';
import { prismaPrimary } from '../data/db';
import { authenticate, requireTeamMembership, AuthenticatedRequest } from '../auth/guards';

export const activityRouter = Router();

/**
 * GET /api/teams/:teamId/activity - Cursor-paginated activity feed (PRD F4)
 * Cursor is composed of ISO timestamp and UUID: `${createdAt}_${id}`.
 */
activityRouter.get(
  '/teams/:teamId/activity',
  authenticate,
  requireTeamMembership([Role.OWNER, Role.MANAGER, Role.STAFF]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { teamId } = req.params;
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10), 1), 50);
    const cursor = req.query.cursor as string | undefined;

    const whereClause: any = { teamId };

    if (cursor) {
      const [cursorTime, cursorId] = cursor.split('_');
      if (cursorTime && cursorId) {
        whereClause.OR = [
          {
            createdAt: { lt: new Date(cursorTime) },
          },
          {
            createdAt: new Date(cursorTime),
            id: { lt: cursorId },
          },
        ];
      }
    }

    const events = await prismaPrimary.activityEvent.findMany({
      where: whereClause,
      include: {
        actor: { select: { id: true, email: true } },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit + 1,
    });

    const hasMore = events.length > limit;
    const items = hasMore ? events.slice(0, limit) : events;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = `${lastItem.createdAt.toISOString()}_${lastItem.id}`;
    }

    res.status(200).json({
      items: items.map((e) => ({
        id: e.id,
        teamId: e.teamId,
        actorId: e.actorId,
        actorEmail: e.actor?.email || null,
        actorName: e.actor?.email ? e.actor.email.split('@')[0] : 'System',
        type: e.type,
        targetId: e.targetId,
        payload: e.payload,
        createdAt: e.createdAt.toISOString(),
      })),
      nextCursor,
      hasMore,
    });
  }
);
