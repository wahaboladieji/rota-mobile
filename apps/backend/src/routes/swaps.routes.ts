import { Router, Response } from 'express';
import {
  Role,
  CreateSwapInputSchema,
  ColleagueSwapDecisionSchema,
  ManagerSwapDecisionSchema,
  SwapRequestItem,
} from '@rota/shared';
import { prismaPrimary } from '../data/db';
import { authenticate, requireTeamMembership, AuthenticatedRequest } from '../auth/guards';
import { logger } from '../observability/logger';
import { enqueuePushJob } from '../jobs/queue';

export const swapsRouter = Router();

/**
 * GET /api/teams/:teamId/swaps - List swaps
 * Staff sees swaps involving themselves; Managers/Owners see all.
 */
swapsRouter.get(
  '/teams/:teamId/swaps',
  authenticate,
  requireTeamMembership([Role.OWNER, Role.MANAGER, Role.STAFF]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { teamId } = req.params;
    const userId = req.user!.userId;
    const role = req.membership!.role;

    const whereClause: any = { teamId };
    if (role === Role.STAFF) {
      whereClause.OR = [{ requesterId: userId }, { colleagueId: userId }];
    }

    const swaps = await prismaPrimary.swapRequest.findMany({
      where: whereClause,
      include: {
        requester: { select: { id: true, email: true } },
        colleague: { select: { id: true, email: true } },
        requesterShift: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const items: SwapRequestItem[] = swaps.map((s) => ({
      id: s.id,
      teamId: s.teamId,
      requesterId: s.requesterId,
      requesterName: s.requester.email.split('@')[0],
      requesterEmail: s.requester.email,
      colleagueId: s.colleagueId,
      colleagueName: s.colleague.email.split('@')[0],
      colleagueEmail: s.colleague.email,
      requesterShiftId: s.requesterShiftId,
      requesterShiftStart: s.requesterShift.startAt.toISOString(),
      requesterShiftEnd: s.requesterShift.endAt.toISOString(),
      status: s.status as any,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));

    res.status(200).json(items);
  }
);

/**
 * POST /api/teams/:teamId/swaps - Request a shift swap
 */
swapsRouter.post(
  '/teams/:teamId/swaps',
  authenticate,
  requireTeamMembership([Role.OWNER, Role.MANAGER, Role.STAFF]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { teamId } = req.params;
    const userId = req.user!.userId;

    const parseResult = CreateSwapInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { requesterShiftId, colleagueId } = parseResult.data;

    if (colleagueId === userId) {
      res.status(400).json({ error: 'Cannot request a swap with yourself' });
      return;
    }

    // Verify shift exists, belongs to this team, and is assigned to caller
    const shift = await prismaPrimary.shift.findFirst({
      where: {
        id: requesterShiftId,
        teamId,
        assigneeId: userId,
        status: 'PUBLISHED',
      },
    });

    if (!shift) {
      res.status(404).json({ error: 'Shift not found or not assigned to you' });
      return;
    }

    // Verify colleague is an active member of this team
    const colleagueMembership = await prismaPrimary.membership.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: colleagueId,
        },
      },
    });

    if (!colleagueMembership || colleagueMembership.status !== 'ACTIVE') {
      res.status(400).json({ error: 'Colleague is not an active member of this team' });
      return;
    }

    // Prevent duplicate open swap requests for the same shift (AGENTS.md rule 15)
    const existingOpen = await prismaPrimary.swapRequest.findFirst({
      where: {
        requesterShiftId,
        status: { in: ['PENDING_COLLEAGUE', 'PENDING_MANAGER'] },
      },
    });

    if (existingOpen) {
      res.status(409).json({ error: 'An active swap request already exists for this shift' });
      return;
    }

    const swap = await prismaPrimary.$transaction(async (tx) => {
      const created = await tx.swapRequest.create({
        data: {
          teamId,
          requesterId: userId,
          colleagueId,
          requesterShiftId,
          requesterVersion: shift.version,
          status: 'PENDING_COLLEAGUE',
        },
      });

      await tx.activityEvent.create({
        data: {
          teamId,
          actorId: userId,
          type: 'SWAP_REQUESTED',
          targetId: created.id,
          payload: {
            requesterId: userId,
            colleagueId,
            requesterShiftId,
          },
        },
      });

      return created;
    });

    logger.info('Swap requested', { swapId: swap.id, teamId, requesterId: userId, colleagueId });

    // Enqueue background push notification to colleague
    const requesterName = req.user!.email ? req.user!.email.split('@')[0] : 'A teammate';
    enqueuePushJob({
      userId: colleagueId,
      teamId,
      group: 'SWAP',
      title: 'Shift Swap Request 🔄',
      body: `${requesterName} wants to swap a shift with you. Tap to review.`,
      data: {
        screen: 'SWAPS',
        swapId: swap.id,
        teamId,
      },
    }).catch((err) => logger.warn('Failed to enqueue swap request push notification', { error: err.message }));

    res.status(201).json(swap);
  }
);

/**
 * POST /api/teams/:teamId/swaps/:swapId/colleague-decision - Colleague accepts or rejects
 */
swapsRouter.post(
  '/teams/:teamId/swaps/:swapId/colleague-decision',
  authenticate,
  requireTeamMembership([Role.OWNER, Role.MANAGER, Role.STAFF]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { teamId, swapId } = req.params;
    const userId = req.user!.userId;

    const parseResult = ColleagueSwapDecisionSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { decision } = parseResult.data;

    const swap = await prismaPrimary.swapRequest.findFirst({
      where: { id: swapId, teamId },
    });

    if (!swap) {
      res.status(404).json({ error: 'Swap request not found' });
      return;
    }

    if (swap.colleagueId !== userId) {
      res.status(403).json({ error: 'Only the requested colleague can respond to this swap request' });
      return;
    }

    if (swap.status !== 'PENDING_COLLEAGUE') {
      res.status(400).json({ error: `Cannot respond to swap in status: ${swap.status}` });
      return;
    }

    const newStatus = decision === 'ACCEPT' ? 'PENDING_MANAGER' : 'REJECTED';

    const updated = await prismaPrimary.$transaction(async (tx) => {
      const resSwap = await tx.swapRequest.update({
        where: { id: swapId },
        data: { status: newStatus },
      });

      await tx.activityEvent.create({
        data: {
          teamId,
          actorId: userId,
          type: decision === 'ACCEPT' ? 'SWAP_COLLEAGUE_ACCEPTED' : 'SWAP_COLLEAGUE_REJECTED',
          targetId: swapId,
          payload: { decision, requesterId: swap.requesterId },
        },
      });

      return resSwap;
    });

    logger.info('Colleague decided swap', { swapId, decision, newStatus });

    const colleagueName = req.user!.email ? req.user!.email.split('@')[0] : 'Colleague';
    enqueuePushJob({
      userId: swap.requesterId,
      teamId,
      group: 'SWAP',
      title: decision === 'ACCEPT' ? 'Swap Accepted by Colleague 👍' : 'Swap Declined ❌',
      body: decision === 'ACCEPT'
        ? `${colleagueName} accepted your swap request! Pending manager approval.`
        : `${colleagueName} declined your swap request.`,
      data: {
        screen: 'SWAPS',
        swapId: swap.id,
        teamId,
      },
    }).catch((err) => logger.warn('Failed to enqueue colleague decision push notification', { error: err.message }));

    res.status(200).json(updated);
  }
);

/**
 * POST /api/teams/:teamId/swaps/:swapId/cancel - Requester cancels swap
 */
swapsRouter.post(
  '/teams/:teamId/swaps/:swapId/cancel',
  authenticate,
  requireTeamMembership([Role.OWNER, Role.MANAGER, Role.STAFF]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { teamId, swapId } = req.params;
    const userId = req.user!.userId;

    const swap = await prismaPrimary.swapRequest.findFirst({
      where: { id: swapId, teamId },
    });

    if (!swap) {
      res.status(404).json({ error: 'Swap request not found' });
      return;
    }

    if (swap.requesterId !== userId) {
      res.status(403).json({ error: 'Only the requester can cancel this swap request' });
      return;
    }

    if (!['PENDING_COLLEAGUE', 'PENDING_MANAGER'].includes(swap.status)) {
      res.status(400).json({ error: `Cannot cancel swap in status: ${swap.status}` });
      return;
    }

    const updated = await prismaPrimary.$transaction(async (tx) => {
      const resSwap = await tx.swapRequest.update({
        where: { id: swapId },
        data: { status: 'CANCELLED' },
      });

      await tx.activityEvent.create({
        data: {
          teamId,
          actorId: userId,
          type: 'SWAP_CANCELLED',
          targetId: swapId,
          payload: { cancelledBy: userId },
        },
      });

      return resSwap;
    });

    logger.info('Swap cancelled by requester', { swapId });
    res.status(200).json(updated);
  }
);

/**
 * POST /api/teams/:teamId/swaps/:swapId/manager-decision - Manager/Owner approves or rejects
 * Restricted to OWNER and MANAGER. STAFF rejected with 403.
 */
swapsRouter.post(
  '/teams/:teamId/swaps/:swapId/manager-decision',
  authenticate,
  requireTeamMembership([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { teamId, swapId } = req.params;
    const userId = req.user!.userId;

    const parseResult = ManagerSwapDecisionSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { decision } = parseResult.data;

    const swap = await prismaPrimary.swapRequest.findFirst({
      where: { id: swapId, teamId },
      include: { requesterShift: true },
    });

    if (!swap) {
      res.status(404).json({ error: 'Swap request not found' });
      return;
    }

    if (swap.status !== 'PENDING_MANAGER') {
      res.status(400).json({ error: `Manager can only decide on swaps that are PENDING_MANAGER (currently: ${swap.status})` });
      return;
    }

    // Recheck versions and assignments in one atomic transaction (AGENTS.md rule 15)
    const result = await prismaPrimary.$transaction(async (tx) => {
      const currentShift = await tx.shift.findUnique({
        where: { id: swap.requesterShiftId },
      });

      if (!currentShift || currentShift.status !== 'PUBLISHED' || currentShift.version !== swap.requesterVersion) {
        // Shift changed or deleted -> auto-cancel swap
        await tx.swapRequest.update({
          where: { id: swapId },
          data: { status: 'CANCELLED' },
        });
        throw new Error('Shift was modified or deleted since the swap was proposed');
      }

      if (decision === 'APPROVE') {
        // Transfer assignment to colleague and bump version
        await tx.shift.update({
          where: { id: swap.requesterShiftId },
          data: {
            assigneeId: swap.colleagueId,
            version: { increment: 1 },
          },
        });

        const updatedSwap = await tx.swapRequest.update({
          where: { id: swapId },
          data: {
            status: 'APPROVED',
            approverId: userId,
          },
        });

        await tx.activityEvent.create({
          data: {
            teamId,
            actorId: userId,
            type: 'SWAP_APPROVED',
            targetId: swapId,
            payload: {
              newAssigneeId: swap.colleagueId,
              shiftId: swap.requesterShiftId,
            },
          },
        });

        return updatedSwap;
      } else {
        const updatedSwap = await tx.swapRequest.update({
          where: { id: swapId },
          data: {
            status: 'REJECTED',
            approverId: userId,
          },
        });

        await tx.activityEvent.create({
          data: {
            teamId,
            actorId: userId,
            type: 'SWAP_REJECTED',
            targetId: swapId,
            payload: { rejectedBy: userId },
          },
        });

        return updatedSwap;
      }
    });

    logger.info('Manager decided swap', { swapId, decision });

    const isApproved = decision === 'APPROVE';
    const title = isApproved ? 'Swap Request Approved! 🎉' : 'Swap Request Denied';
    const body = isApproved
      ? 'A manager has approved your shift swap. Schedules have been updated.'
      : 'A manager declined your shift swap request.';

    // Notify requester
    enqueuePushJob({
      userId: swap.requesterId,
      teamId,
      group: 'SWAP',
      title,
      body,
      data: {
        screen: 'SWAPS',
        swapId: swap.id,
        teamId,
      },
    }).catch((err) => logger.warn('Failed to enqueue manager decision push to requester', { error: err.message }));

    // Notify colleague
    enqueuePushJob({
      userId: swap.colleagueId,
      teamId,
      group: 'SWAP',
      title,
      body,
      data: {
        screen: 'SWAPS',
        swapId: swap.id,
        teamId,
      },
    }).catch((err) => logger.warn('Failed to enqueue manager decision push to colleague', { error: err.message }));

    res.status(200).json(result);
  }
);
