import { Router, Response } from 'express';
import {
  AvailabilityWindowSchema,
  UserSettingsSchema,
  UserSettingsPatchSchema,
  Role,
} from '@rota/shared';
import { prismaPrimary } from '../data/db';
import { defaultUserSettings } from '../config';
import { authenticate, requireTeamMembership, AuthenticatedRequest } from '../auth/guards';
import { logger } from '../observability/logger';
import { getOrSetCache, invalidateCache, CACHE_TTL } from '../services/cache.service';

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

    const items = await getOrSetCache(
      `cache:prefs:${teamId}:${userId}`,
      CACHE_TTL.USER_PREFERENCES,
      async () => {
        const prefs = await prismaPrimary.shiftPreference.findMany({
          where: { teamId, userId },
          orderBy: { weekday: 'asc' },
        });

        return prefs.map((p) => ({
          id: p.id,
          weekday: p.weekday,
          dayName: DAY_NAMES[p.weekday] || 'Unknown',
          startTime: p.startTime,
          endTime: p.endTime,
        }));
      }
    );

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

    await invalidateCache(`cache:prefs:${teamId}:${userId}`);

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

    await invalidateCache(`cache:prefs:${teamId}:${userId}`);

    logger.info('Availability window deleted', { preferenceId, userId });
    res.status(200).json({ message: 'Window deleted successfully' });
  }
);

/**
 * GET /api/settings - Retrieve authenticated user settings
 */
preferencesRouter.get('/settings', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  const settings = await getOrSetCache(
    `cache:settings:${userId}`,
    CACHE_TTL.USER_SETTINGS,
    async () => {
      let current = await prismaPrimary.userSetting.findUnique({
        where: { userId },
      });

      if (!current) {
        const nowIso = new Date().toISOString();
        current = await prismaPrimary.userSetting.create({
          data: {
            userId,
            timeZone: defaultUserSettings.timeZone,
            quietStart: defaultUserSettings.quietStart,
            quietEnd: defaultUserSettings.quietEnd,
            shiftPush: true,
            swapPush: true,
            billingPush: true,
            language: defaultUserSettings.language,
            theme: defaultUserSettings.theme,
            fieldUpdatedAt: {
              quietHours: nowIso,
              quietStart: nowIso,
              quietEnd: nowIso,
              timeZone: nowIso,
              shiftPush: nowIso,
              swapPush: nowIso,
              billingPush: nowIso,
              language: nowIso,
              theme: nowIso,
            },
          },
        });
      }
      return current;
    }
  );

  res.status(200).json(settings);
});

/**
 * Handle partial or full settings updates with per-field server timestamps
 */
async function handleUpdateSettings(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.userId;

  const parseResult = UserSettingsPatchSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    return;
  }

  const patch = parseResult.data;
  const nowIso = new Date().toISOString();

  // 1. Fetch existing settings (or initialize with defaults)
  let existing = await prismaPrimary.userSetting.findUnique({
    where: { userId },
  });

  const existingFieldUpdatedAt: Record<string, string> =
    existing && typeof existing.fieldUpdatedAt === 'object' && existing.fieldUpdatedAt !== null
      ? (existing.fieldUpdatedAt as Record<string, string>)
      : {};

  const updatedFieldUpdatedAt = { ...existingFieldUpdatedAt };

  // 2. Build updated fields and per-field timestamps
  const dataToUpdate: Record<string, any> = {};

  if (patch.quietStart !== undefined) {
    dataToUpdate.quietStart = patch.quietStart;
    updatedFieldUpdatedAt.quietStart = nowIso;
    updatedFieldUpdatedAt.quietHours = nowIso;
  }
  if (patch.quietEnd !== undefined) {
    dataToUpdate.quietEnd = patch.quietEnd;
    updatedFieldUpdatedAt.quietEnd = nowIso;
    updatedFieldUpdatedAt.quietHours = nowIso;
  }
  if (patch.timeZone !== undefined) {
    dataToUpdate.timeZone = patch.timeZone;
    updatedFieldUpdatedAt.timeZone = nowIso;
  }
  if (patch.shiftPush !== undefined) {
    dataToUpdate.shiftPush = patch.shiftPush;
    updatedFieldUpdatedAt.shiftPush = nowIso;
  }
  if (patch.swapPush !== undefined) {
    dataToUpdate.swapPush = patch.swapPush;
    updatedFieldUpdatedAt.swapPush = nowIso;
  }
  if (patch.billingPush !== undefined) {
    dataToUpdate.billingPush = patch.billingPush;
    updatedFieldUpdatedAt.billingPush = nowIso;
  }
  if (patch.theme !== undefined) {
    dataToUpdate.theme = patch.theme;
    updatedFieldUpdatedAt.theme = nowIso;
  }
  if (patch.language !== undefined) {
    dataToUpdate.language = patch.language;
    updatedFieldUpdatedAt.language = nowIso;
  }

  dataToUpdate.fieldUpdatedAt = updatedFieldUpdatedAt;

  const updated = await prismaPrimary.userSetting.upsert({
    where: { userId },
    create: {
      userId,
      timeZone: patch.timeZone || defaultUserSettings.timeZone,
      quietStart: patch.quietStart ?? defaultUserSettings.quietStart,
      quietEnd: patch.quietEnd ?? defaultUserSettings.quietEnd,
      shiftPush: patch.shiftPush ?? true,
      swapPush: patch.swapPush ?? true,
      billingPush: patch.billingPush ?? true,
      theme: patch.theme || defaultUserSettings.theme,
      language: patch.language || defaultUserSettings.language,
      fieldUpdatedAt: updatedFieldUpdatedAt,
      ...dataToUpdate,
    },
    update: dataToUpdate,
  });

  await invalidateCache(`cache:settings:${userId}`);

  logger.info('User settings updated with per-field timestamps', {
    userId,
    updatedFields: Object.keys(dataToUpdate).filter((k) => k !== 'fieldUpdatedAt'),
  });
  res.status(200).json(updated);
}

/**
 * PUT /api/settings - Update authenticated user settings
 */
preferencesRouter.put('/settings', authenticate, handleUpdateSettings);

/**
 * PATCH /api/settings - Partially update authenticated user settings
 */
preferencesRouter.patch('/settings', authenticate, handleUpdateSettings);

