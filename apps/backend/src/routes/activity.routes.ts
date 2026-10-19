import { Router, Response } from 'express';
import { Role, ActivityQuerySchema } from '@rota/shared';
import { z } from 'zod';
import { prismaPrimary } from '../data/db';
import { authenticate, requireTeamMembership, AuthenticatedRequest } from '../auth/guards';

export const activityRouter = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Encodes cursor timestamp and UUID into an opaque base64 string.
 */
export function encodeCursor(createdAt: Date, id: string): string {
  const payload = `${createdAt.toISOString()}_${id}`;
  return Buffer.from(payload, 'utf8').toString('base64');
}

/**
 * Decodes an opaque base64 cursor or plaintext `${iso}_${id}` cursor.
 * Returns null if invalid or malformed.
 */
export function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  if (!cursor || typeof cursor !== 'string') return null;

  let raw = cursor;
  // If base64 encoded, decode it
  if (!cursor.includes('_')) {
    try {
      raw = Buffer.from(cursor, 'base64').toString('utf8');
    } catch {
      return null;
    }
  }

  const delimiterIndex = raw.indexOf('_');
  if (delimiterIndex === -1) return null;

  const cursorTime = raw.substring(0, delimiterIndex);
  const cursorId = raw.substring(delimiterIndex + 1);

  const createdAt = new Date(cursorTime);
  if (isNaN(createdAt.getTime())) return null;

  if (!UUID_REGEX.test(cursorId)) return null;

  return { createdAt, id: cursorId };
}

/**
 * GET /api/teams/:teamId/activity - Cursor-paginated activity feed (PRD F4)
 * Returns feed items in descending (createdAt, id) order with an opaque cursor.
 */
activityRouter.get(
  '/teams/:teamId/activity',
  authenticate,
  requireTeamMembership([Role.OWNER, Role.MANAGER, Role.STAFF]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { teamId } = req.params;

    if (!UUID_REGEX.test(teamId)) {
      return res.status(400).json({ error: 'Invalid team ID format' });
    }

    const queryParsed = ActivityQuerySchema.safeParse(req.query);
    if (!queryParsed.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: queryParsed.error.issues,
      });
    }

    const { limit, cursor } = queryParsed.data;
    const whereClause: any = { teamId };

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (!decoded) {
        return res.status(400).json({ error: 'Invalid cursor parameter' });
      }

      whereClause.OR = [
        {
          createdAt: { lt: decoded.createdAt },
        },
        {
          createdAt: decoded.createdAt,
          id: { lt: decoded.id },
        },
      ];
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
      nextCursor = encodeCursor(lastItem.createdAt, lastItem.id);
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

