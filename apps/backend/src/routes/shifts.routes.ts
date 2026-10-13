import { Router, Response } from 'express';
import {
  Role,
  CreateShiftInputSchema,
  ShiftItem,
} from '@rota/shared';
import { prismaPrimary } from '../data/db';
import { authenticate, requireTeamMembership, AuthenticatedRequest } from '../auth/guards';
import { logger } from '../observability/logger';

export const shiftsRouter = Router();

/**
 * GET /api/teams/:teamId/shifts - View shifts for the team
 * Accessible to OWNER, MANAGER, and STAFF.
 */
shiftsRouter.get(
  '/teams/:teamId/shifts',
  authenticate,
  requireTeamMembership([Role.OWNER, Role.MANAGER, Role.STAFF]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { teamId } = req.params;

    const shifts = await prismaPrimary.shift.findMany({
      where: {
        teamId,
        status: 'PUBLISHED',
      },
      include: {
        assignee: {
          select: {
            id: true,
            email: true,
            memberships: {
              where: { teamId },
              select: { role: true },
            },
          },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    const items: ShiftItem[] = shifts.map((s) => ({
      id: s.id,
      teamId: s.teamId,
      assigneeId: s.assigneeId,
      assigneeName: s.assignee.email.split('@')[0],
      assigneeRole: s.assignee.memberships[0]?.role || 'STAFF',
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
      status: s.status as any,
      version: s.version,
    }));

    res.status(200).json(items);
  }
);

/**
 * POST /api/teams/:teamId/shifts - Create and publish a shift
 * Restricted to OWNER and MANAGER. STAFF rejected with 403.
 */
shiftsRouter.post(
  '/teams/:teamId/shifts',
  authenticate,
  requireTeamMembership([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { teamId } = req.params;

    const parseResult = CreateShiftInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { assigneeId, startAt, endAt } = parseResult.data;
    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    if (endDate <= startDate) {
      res.status(400).json({ error: 'End time must be after start time' });
      return;
    }

    // 8-week horizon constraint (PRD Section 10)
    const now = new Date();
    const maxHorizon = new Date(now.getTime() + 8 * 7 * 24 * 60 * 60 * 1000);
    if (startDate > maxHorizon) {
      res.status(400).json({ error: 'Shifts cannot be scheduled beyond the 8-week horizon' });
      return;
    }

    // Verify assignee belongs to the team
    const assigneeMembership = await prismaPrimary.membership.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: assigneeId,
        },
      },
    });

    if (!assigneeMembership || assigneeMembership.status !== 'ACTIVE') {
      res.status(400).json({ error: 'Assignee is not an active member of this team' });
      return;
    }

    // Check for overlapping shifts for the same assignee
    const overlapping = await prismaPrimary.shift.findFirst({
      where: {
        assigneeId,
        status: 'PUBLISHED',
        startAt: { lt: endDate },
        endAt: { gt: startDate },
      },
    });

    if (overlapping) {
      res.status(409).json({ error: 'This member has another shift that overlaps with this time window' });
      return;
    }

    const shift = await prismaPrimary.$transaction(async (tx) => {
      const created = await tx.shift.create({
        data: {
          teamId,
          assigneeId,
          startAt: startDate,
          endAt: endDate,
          status: 'PUBLISHED',
          version: 1,
        },
      });

      await tx.activityEvent.create({
        data: {
          teamId,
          actorId: req.user!.userId,
          type: 'SHIFT_PUBLISHED',
          targetId: created.id,
          payload: {
            assigneeId,
            startAt: created.startAt.toISOString(),
            endAt: created.endAt.toISOString(),
          },
        },
      });

      return created;
    });

    logger.info('Shift published successfully', {
      shiftId: shift.id,
      teamId,
      assigneeId,
      actorId: req.user!.userId,
    });

    res.status(201).json({
      id: shift.id,
      teamId: shift.teamId,
      assigneeId: shift.assigneeId,
      startAt: shift.startAt.toISOString(),
      endAt: shift.endAt.toISOString(),
      status: shift.status,
      version: shift.version,
    });
  }
);

/**
 * DELETE /api/teams/:teamId/shifts/:shiftId - Cancel/delete a shift
 * Restricted to OWNER and MANAGER. STAFF rejected with 403.
 */
shiftsRouter.delete(
  '/teams/:teamId/shifts/:shiftId',
  authenticate,
  requireTeamMembership([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { teamId, shiftId } = req.params;

    const existing = await prismaPrimary.shift.findFirst({
      where: { id: shiftId, teamId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Shift not found' });
      return;
    }

    await prismaPrimary.$transaction(async (tx) => {
      // Cancel any open swap requests involving this shift (AGENTS.md rule 15)
      await tx.swapRequest.updateMany({
        where: {
          teamId,
          requesterShiftId: shiftId,
          status: { in: ['PENDING_COLLEAGUE', 'PENDING_MANAGER'] },
        },
        data: {
          status: 'CANCELLED',
        },
      });

      await tx.shift.delete({
        where: { id: shiftId },
      });

      await tx.activityEvent.create({
        data: {
          teamId,
          actorId: req.user!.userId,
          type: 'SHIFT_CANCELLED',
          targetId: shiftId,
          payload: { shiftId },
        },
      });
    });

    logger.info('Shift cancelled successfully', { shiftId, teamId, actorId: req.user!.userId });
    res.status(200).json({ message: 'Shift deleted successfully' });
  }
);
