import { Router, Response } from 'express';
import { z } from 'zod';
import { prismaPrimary } from '../data/db';
import { authenticate, AuthenticatedRequest } from '../auth/guards';
import { logger } from '../observability/logger';

export const devicesRouter = Router();

const RegisterPushTokenSchema = z.object({
  pushToken: z.string().min(1, 'Push token cannot be empty'),
  oldPushToken: z.string().optional(),
});

const DeletePushTokenSchema = z.object({
  pushToken: z.string().min(1, 'Push token cannot be empty'),
});

const TestPushSchema = z.object({
  pushToken: z.string().optional(),
});

/**
 * POST /devices/push-token
 * Registers or updates a device push token for the authenticated user.
 * Supports token rotation: if oldPushToken is provided, it is invalidated.
 */
devicesRouter.post(
  '/devices/push-token',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    const parseResult = RegisterPushTokenSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid push token', details: parseResult.error.format() });
      return;
    }

    const { pushToken, oldPushToken } = parseResult.data;
    const userId = req.user!.userId;

    try {
      // 1. If rotating from an older token on this device, invalidate the old registration
      if (oldPushToken && oldPushToken !== pushToken) {
        await prismaPrimary.device.updateMany({
          where: { pushToken: oldPushToken, userId },
          data: { invalidatedAt: new Date() },
        });
        logger.info('Rotated push token: invalidated old token', { userId, oldPushToken });
      }

      // 2. Register or update the new token
      const device = await prismaPrimary.device.upsert({
        where: { pushToken },
        update: {
          userId,
          lastSeenAt: new Date(),
          invalidatedAt: null,
        },
        create: {
          userId,
          pushToken,
          lastSeenAt: new Date(),
        },
      });

      logger.info('Device push token registered', { userId, deviceId: device.id });
      res.status(200).json({ success: true, deviceId: device.id });
    } catch (err: unknown) {
      logger.error('Failed to register device push token', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Failed to register push token' });
    }
  }
);

/**
 * DELETE /devices/push-token
 * Invalidates a device push token (e.g. upon user logout or permission revocation).
 */
devicesRouter.delete(
  '/devices/push-token',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    const parseResult = DeletePushTokenSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid push token', details: parseResult.error.format() });
      return;
    }

    const { pushToken } = parseResult.data;
    const userId = req.user!.userId;

    try {
      await prismaPrimary.device.updateMany({
        where: { pushToken, userId },
        data: { invalidatedAt: new Date() },
      });

      logger.info('Device push token invalidated on request', { userId });
      res.status(200).json({ success: true, message: 'Push token invalidated' });
    } catch (err: unknown) {
      logger.error('Failed to invalidate device push token', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Failed to invalidate push token' });
    }
  }
);

/**
 * POST /notifications/test
 * Sends a test push notification via Expo Push Notification API.
 */
devicesRouter.post(
  '/notifications/test',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    const parseResult = TestPushSchema.safeParse(req.body);
    const customToken = parseResult.success ? parseResult.data.pushToken : undefined;
    const userId = req.user!.userId;

    let targetToken = customToken;

    if (!targetToken) {
      const device = await prismaPrimary.device.findFirst({
        where: {
          userId,
          pushToken: { not: null },
          invalidatedAt: null,
        },
        orderBy: { lastSeenAt: 'desc' },
      });

      if (!device?.pushToken) {
        res.status(404).json({
          error: 'No registered push token found for this user. Please register a device first.',
        });
        return;
      }

      targetToken = device.pushToken;
    }

    // Verify it looks like an Expo push token
    if (!targetToken.startsWith('ExponentPushToken[') && !targetToken.startsWith('ExpoPushToken[')) {
      res.status(400).json({
        error: `Invalid Expo Push Token format: "${targetToken}". Expected format: ExponentPushToken[...]`,
      });
      return;
    }

    try {
      const message = {
        to: targetToken,
        sound: 'default',
        title: 'Rota Test Notification 🔔',
        body: 'Push notifications are connected and working on your device!',
        data: { type: 'TEST', timestamp: new Date().toISOString() },
        priority: 'high',
        channelId: 'default',
      };

      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const expoData = await expoRes.json();
      logger.info('Sent test push notification', { userId, targetToken, expoData });

      res.status(200).json({
        success: true,
        message: 'Test notification dispatched to Expo Push Service',
        targetToken,
        expoResponse: expoData,
      });
    } catch (err: unknown) {
      logger.error('Failed to send test push notification', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Failed to send test push notification' });
    }
  }
);
