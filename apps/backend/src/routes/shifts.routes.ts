import { Router, Response } from 'express';
import {
  Role,
  CreateShiftInputSchema,
  ShiftItem,
} from '@rota/shared';
import { prismaPrimary } from '../data/db';
import { authenticate, requireTeamMembership, AuthenticatedRequest } from '../auth/guards';
import { logger } from '../observability/logger';
import { enqueuePushJob, enqueueEmailJob } from '../jobs/queue';
import { schedulingConfig } from '../config';

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

    // PRD D1: Initial teams stay in PENDING_INITIAL_PAYMENT until subscribed; publishing shifts is blocked
    const subscription = await prismaPrimary.subscription.findUnique({
      where: { teamId },
    });
    if (subscription?.status === 'PENDING_INITIAL_PAYMENT') {
      res.status(403).json({
        error: 'Subscription required: Complete initial payment before publishing shifts',
      });
      return;
    }

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

    // Configurable horizon constraint (default 8-week horizon per PRD Section 10)
    const now = new Date();
    const maxHorizonMs = schedulingConfig.maxHorizonWeeks * 7 * 24 * 60 * 60 * 1000;
    const maxHorizon = new Date(now.getTime() + maxHorizonMs);
    if (startDate > maxHorizon) {
      res.status(400).json({ error: `Shifts cannot be scheduled beyond the ${schedulingConfig.maxHorizonWeeks}-week horizon` });
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
      include: {
        user: true,
        team: true,
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

    const assigneeName = assigneeMembership.user.email.split('@')[0];
    const teamName = assigneeMembership.team.name;
    const actorName = req.user!.email ? req.user!.email.split('@')[0] : 'Owner';

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
            assigneeName,
            assigneeEmail: assigneeMembership.user.email,
            actorName,
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

    // Check user notification settings and notify staff via email (async, non-blocking)
    try {
      const userSetting = await prismaPrimary.userSetting.findUnique({
        where: { userId: assigneeId },
      });

      if (!userSetting || userSetting.shiftPush !== false) {
        const dateFormatted = startDate.toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        const timeFormatted = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')} – ${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

        enqueueEmailJob(
          {
            type: 'SHIFT_NOTIFICATION',
            recipientEmail: assigneeMembership.user.email,
            subject: `New shift scheduled on Rota (${teamName})`,
            html: `
<p>Hello ${assigneeName},</p>
<p>A new shift has been published for you on <strong>${teamName}</strong>:</p>
<p><strong>Date:</strong> ${dateFormatted}<br/>
<strong>Time:</strong> ${timeFormatted}</p>
<p>Open the Rota mobile app to view your schedule and details.</p>
            `.trim(),
            text: `Hello ${assigneeName},\nA new shift has been published for you on ${teamName}:\nDate: ${dateFormatted}\nTime: ${timeFormatted}\n\nOpen Rota to view your schedule.`,
          },
          req.headers['x-request-id'] as string
        ).catch((err) => {
          logger.warn('Failed to enqueue shift notification email job', { error: err.message });
        });

        // Enqueue background push notification job (non-blocking, handled by worker)
        enqueuePushJob({
          userId: assigneeId,
          teamId,
          group: 'SHIFT',
          eventType: 'NEW_SHIFT',
          isUrgent: false, // New shifts are never urgent and wait until quiet hours end (PRD F7.5)
          shiftStartAt: shift.startAt.toISOString(),
          title: `New Shift Scheduled 📅`,
          body: `You have a shift on ${dateFormatted} (${timeFormatted}) in ${teamName}`,
          data: {
            screen: 'SHIFTS',
            shiftId: shift.id,
            teamId,
          },
        }).catch((err) => {
          logger.warn('Failed to enqueue shift push notification job', { error: err.message });
        });
      }
    } catch (err: any) {
      logger.warn('Error checking notification preferences for shift', { error: err.message });
    }

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
 * PUT /api/teams/:teamId/shifts/:shiftId - Edit and update an existing shift
 * Restricted to OWNER and MANAGER. STAFF rejected with 403.
 */
shiftsRouter.put(
  '/teams/:teamId/shifts/:shiftId',
  authenticate,
  requireTeamMembership([Role.OWNER, Role.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { teamId, shiftId } = req.params;

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

    // Verify shift exists and belongs to this team
    const existing = await prismaPrimary.shift.findFirst({
      where: { id: shiftId, teamId, status: 'PUBLISHED' },
      include: {
        assignee: true,
        team: true,
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Shift not found or already cancelled' });
      return;
    }

    if (existing.endAt <= new Date()) {
      res.status(400).json({ error: 'Completed shifts cannot be edited' });
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
      include: {
        user: true,
        team: true,
      },
    });

    if (!assigneeMembership || assigneeMembership.status !== 'ACTIVE') {
      res.status(400).json({ error: 'Assignee is not an active member of this team' });
      return;
    }

    // Check for overlapping shifts for the target assignee, excluding this shift itself
    const overlapping = await prismaPrimary.shift.findFirst({
      where: {
        assigneeId,
        status: 'PUBLISHED',
        id: { not: shiftId },
        startAt: { lt: endDate },
        endAt: { gt: startDate },
      },
    });

    if (overlapping) {
      res.status(409).json({ error: 'This member has another shift that overlaps with this time window' });
      return;
    }

    const assigneeName = assigneeMembership.user.email.split('@')[0];
    const teamName = assigneeMembership.team.name;
    const actorName = req.user!.email ? req.user!.email.split('@')[0] : 'Owner';

    const updated = await prismaPrimary.$transaction(async (tx) => {
      // If times changed or assignee changed, cancel any open swap requests involving this shift (AGENTS.md rule 15)
      const timesChanged =
        existing.startAt.getTime() !== startDate.getTime() ||
        existing.endAt.getTime() !== endDate.getTime();
      const assigneeChanged = existing.assigneeId !== assigneeId;

      if (timesChanged || assigneeChanged) {
        await tx.swapRequest.updateMany({
          where: {
            teamId,
            OR: [
              { requesterShiftId: shiftId },
              { colleagueShiftId: shiftId },
            ],
            status: { in: ['PENDING_COLLEAGUE', 'PENDING_MANAGER'] },
          },
          data: {
            status: 'CANCELLED',
          },
        });
      }

      const shift = await tx.shift.update({
        where: { id: shiftId },
        data: {
          assigneeId,
          startAt: startDate,
          endAt: endDate,
          version: { increment: 1 },
        },
      });

      await tx.activityEvent.create({
        data: {
          teamId,
          actorId: req.user!.userId,
          type: 'SHIFT_PUBLISHED',
          targetId: shift.id,
          payload: {
            shiftId: shift.id,
            assigneeId,
            assigneeName,
            assigneeEmail: assigneeMembership.user.email,
            actorName,
            startAt: shift.startAt.toISOString(),
            endAt: shift.endAt.toISOString(),
            isUpdate: true,
          },
        },
      });

      return shift;
    });

    logger.info('Shift updated successfully', {
      shiftId: updated.id,
      teamId,
      assigneeId,
      actorId: req.user!.userId,
    });

    // Notify assignee about shift update via email
    try {
      const dateFormatted = startDate.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const timeFormatted = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')} – ${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

      enqueueEmailJob(
        {
          type: 'SHIFT_NOTIFICATION',
          recipientEmail: assigneeMembership.user.email,
          subject: `Shift updated on Rota (${teamName})`,
          html: `<p>Your shift on <strong>${teamName}</strong> has been updated:</p><p><strong>Date:</strong> ${dateFormatted}<br/><strong>Time:</strong> ${timeFormatted}</p>`,
          text: `Your shift on ${teamName} has been updated:\nDate: ${dateFormatted}\nTime: ${timeFormatted}`,
        },
        req.headers['x-request-id'] as string
      ).catch((err) => logger.warn('Failed to enqueue shift update email job', { error: err.message }));

      const shiftStart = updated.startAt.getTime();
      const timeToShift = shiftStart - Date.now();
      const urgentMs = schedulingConfig.urgentShiftThresholdHours * 60 * 60 * 1000;
      const isUrgent = timeToShift > 0 && timeToShift <= urgentMs;

      enqueuePushJob({
        userId: assigneeId,
        teamId,
        group: 'SHIFT',
        eventType: 'SHIFT_CHANGE',
        isUrgent,
        shiftStartAt: updated.startAt.toISOString(),
        title: `Shift Updated 🕒`,
        body: `Your shift on ${dateFormatted} has been updated (${timeFormatted})`,
        data: {
          screen: 'SHIFTS',
          shiftId: updated.id,
          teamId,
        },
      }).catch((err) => logger.warn('Failed to enqueue shift update push job', { error: err.message }));
    } catch (err: any) {
      logger.warn('Error checking notification preferences for shift update', { error: err.message });
    }

    res.status(200).json({
      id: updated.id,
      teamId: updated.teamId,
      assigneeId: updated.assigneeId,
      startAt: updated.startAt.toISOString(),
      endAt: updated.endAt.toISOString(),
      status: updated.status,
      version: updated.version,
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
      include: {
        assignee: true,
        team: true,
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Shift not found' });
      return;
    }

    if (existing.endAt <= new Date()) {
      res.status(400).json({ error: 'Completed shifts cannot be cancelled' });
      return;
    }

    const actor = await prismaPrimary.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true },
    });
    const actorName = actor?.email ? actor.email.split('@')[0] : 'Owner';

    await prismaPrimary.$transaction(async (tx) => {
      // Cancel any open swap requests involving this shift (AGENTS.md rule 15)
      await tx.swapRequest.updateMany({
        where: {
          teamId,
          OR: [
            { requesterShiftId: shiftId },
            { colleagueShiftId: shiftId },
          ],
          status: { in: ['PENDING_COLLEAGUE', 'PENDING_MANAGER'] },
        },
        data: {
          status: 'CANCELLED',
        },
      });

      // Update shift status to CANCELLED (frees exclusion constraint & avoids FK violation)
      await tx.shift.update({
        where: { id: shiftId },
        data: { status: 'CANCELLED' },
      });

      await tx.activityEvent.create({
        data: {
          teamId,
          actorId: req.user!.userId,
          type: 'SHIFT_CANCELLED',
          targetId: shiftId,
          payload: {
            shiftId,
            assigneeId: existing.assigneeId,
            assigneeName: existing.assignee?.email ? existing.assignee.email.split('@')[0] : 'Staff',
            assigneeEmail: existing.assignee?.email,
            actorName,
            startAt: existing.startAt.toISOString(),
            endAt: existing.endAt.toISOString(),
          },
        },
      });
    });

    logger.info('Shift cancelled successfully', { shiftId, teamId, actorId: req.user!.userId });

    // Send async cancellation email to staff assignee
    try {
      if (existing.assignee?.email) {
        const startDate = existing.startAt;
        const dateFormatted = startDate.toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        const teamName = existing.team?.name || 'Your Team';

        enqueueEmailJob(
          {
            type: 'SHIFT_NOTIFICATION',
            recipientEmail: existing.assignee.email,
            subject: `Shift cancelled on Rota (${teamName})`,
            html: `<p>Your shift scheduled for <strong>${dateFormatted}</strong> on <strong>${teamName}</strong> has been cancelled by ${actorName}.</p>`,
            text: `Your shift scheduled for ${dateFormatted} on ${teamName} has been cancelled by ${actorName}.`,
          },
          req.headers['x-request-id'] as string
        ).catch((err) => logger.warn('Failed to enqueue shift cancellation email job', { error: err.message }));

        // Cancelled shifts are urgent only if starting within configured hours (PRD F7.5 / AGENTS.md rule 18)
        const shiftStart = existing.startAt.getTime();
        const timeToShift = shiftStart - Date.now();
        const urgentMs = schedulingConfig.urgentShiftThresholdHours * 60 * 60 * 1000;
        const isUrgent = timeToShift > 0 && timeToShift <= urgentMs;

        enqueuePushJob({
          userId: existing.assigneeId,
          teamId,
          group: 'SHIFT',
          eventType: 'SHIFT_CANCEL',
          isUrgent,
          shiftStartAt: existing.startAt.toISOString(),
          title: `Shift Cancelled ⚠️`,
          body: `Your shift on ${dateFormatted} (${teamName}) was cancelled`,
          data: {
            screen: 'SHIFTS',
            shiftId,
            teamId,
          },
        }).catch((err) => logger.warn('Failed to enqueue shift cancellation push job', { error: err.message }));
      }
    } catch (err: any) {
      logger.warn('Error in shift cancellation email check', { error: err.message });
    }

    res.status(200).json({ message: 'Shift deleted successfully' });
  }
);
