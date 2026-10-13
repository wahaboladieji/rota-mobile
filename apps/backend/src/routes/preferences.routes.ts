import { Router, Response } from 'express';
import {
  AvailabilityWindowSchema,
  UserSettingsSchema,
  Role,
} from '@rota/shared';
import { prismaPrimary } from '../data/db';
import { authenticate, requireTeamMembership, AuthenticatedRequest } from '../auth/guards';
import { logger } from '../observability/logger';

export const preferencesRouter = Router();

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * GET /api/teams/:teamId/preferences - List user's availability windows for the team
 */
preferencesRouter.get(
  '/teams/:teamId/preferences',
  authenticate,
  requireTeamMembership([Role.OWNER, Role.MANAGER, Role.STAFF]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { teamId } = req.params;
    const userId = req.user!.userId;

    const prefs = await prismaPrimary.shiftPreference.findMany({
      where: { teamId, userId },
      orderBy: { weekday: 'asc' },
    });

    const items = prefs.map((p) => ({
      id: p.id,
      weekday: p.weekday,
      dayName: DAY_NAMES[p.weekday] || 'Unknown',
      startTime: p.startTime,
      endTime: p.endTime,
    }));

    res.status(200).json(items);
  }
);

/**
 * POST /api/teams/:teamId/preferences - Add or update an availability window
 */
preferencesRouter.post(
  '/teams/:teamId/preferences',
  authenticate,
  requireTeamMembership([Role.OWNER, Role.MANAGER, Role.STAFF]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { teamId } = req.params;
    const userId = req.user!.userId;

    const parseResult = AvailabilityWindowSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { weekday, startTime, endTime } = parseResult.data;

    const existing = await prismaPrimary.shiftPreference.findFirst({
      where: { teamId, userId, weekday },
    });

    let pref;
    if (existing) {
      pref = await prismaPrimary.shiftPreference.update({
        where: { id: existing.id },
        data: { startTime, endTime },
      });
    } else {
      pref = await prismaPrimary.shiftPreference.create({
        data: { teamId, userId, weekday, startTime, endTime },
      });
    }

    logger.info('Availability window saved', { userId, teamId, weekday, startTime, endTime });
    res.status(200).json({
      id: pref.id,
      weekday: pref.weekday,
      dayName: DAY_NAMES[pref.weekday],
      startTime: pref.startTime,
      endTime: pref.endTime,
    });
  }
);

/**
 * DELETE /api/teams/:teamId/preferences/:preferenceId - Delete an availability window
 */
preferencesRouter.delete(
  '/teams/:teamId/preferences/:preferenceId',
  authenticate,
  requireTeamMembership([Role.OWNER, Role.MANAGER, Role.STAFF]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { teamId, preferenceId } = req.params;
    const userId = req.user!.userId;

    const existing = await prismaPrimary.shiftPreference.findFirst({
      where: { id: preferenceId, teamId, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Availability window not found' });
      return;
    }

    await prismaPrimary.shiftPreference.delete({
      where: { id: preferenceId },
    });

    logger.info('Availability window deleted', { preferenceId, userId });
    res.status(200).json({ message: 'Window deleted successfully' });
  }
);

/**
 * GET /api/settings - Retrieve authenticated user settings
 */
preferencesRouter.get('/settings', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  let settings = await prismaPrimary.userSetting.findUnique({
    where: { userId },
  });

  if (!settings) {
    settings = await prismaPrimary.userSetting.create({
      data: {
        userId,
        timeZone: 'Africa/Lagos',
        quietStart: '22:00',
        quietEnd: '07:00',
        shiftPush: true,
        swapPush: true,
        billingPush: true,
        language: 'en',
        theme: 'system',
        fieldUpdatedAt: {},
      },
    });
  }

  res.status(200).json(settings);
});

/**
 * PUT /api/settings - Update authenticated user settings
 */
preferencesRouter.put('/settings', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  const parseResult = UserSettingsSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    return;
  }

  const { quietStart, quietEnd, timeZone, shiftPush, swapPush, billingPush, theme, language } = parseResult.data;

  const updated = await prismaPrimary.userSetting.upsert({
    where: { userId },
    create: {
      userId,
      quietStart: quietStart ?? null,
      quietEnd: quietEnd ?? null,
      timeZone,
      shiftPush,
      swapPush,
      billingPush,
      theme,
      language,
      fieldUpdatedAt: { updatedAt: new Date().toISOString() },
    },
    update: {
      quietStart: quietStart ?? null,
      quietEnd: quietEnd ?? null,
      timeZone,
      shiftPush,
      swapPush,
      billingPush,
      theme,
      language,
      fieldUpdatedAt: { updatedAt: new Date().toISOString() },
    },
  });

  logger.info('User settings updated', { userId });
  res.status(200).json(updated);
});
