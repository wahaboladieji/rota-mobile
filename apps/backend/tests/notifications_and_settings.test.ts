import request from 'supertest';
import { app } from '../src/app';
import { prismaPrimary } from '../src/data/db';
import { Role } from '@rota/shared';
import { closeQueue, enqueuePushJob, pushQueue, PushJobData } from '../src/jobs/queue';
import { processPushJob, createPushWorker } from '../src/jobs/worker';

describe('Requirement 6 & 7: Push Notifications & Settings Coordination (PRD F7.1–F7.5, Section 7)', () => {
  let userTokenA: string;
  let userIdA: string;
  let userTokenB: string;
  let userIdB: string;
  let teamId: string;
  let foreignTeamId: string;
  let foreignUserToken: string;
  let foreignUserId: string;

  beforeAll(async () => {
    // 1. Create User A
    const resA = await request(app)
      .post('/api/auth/signup')
      .send({ email: `push-user-a-${Date.now()}@example.com`, password: 'UserPassword123!' });
    userTokenA = resA.body.accessToken;
    userIdA = resA.body.user.id;

    // 2. Create User B
    const resB = await request(app)
      .post('/api/auth/signup')
      .send({ email: `push-user-b-${Date.now()}@example.com`, password: 'UserPassword123!' });
    userTokenB = resB.body.accessToken;
    userIdB = resB.body.user.id;

    // 3. Create Team as User A
    const teamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${userTokenA}`)
      .send({ name: 'Push Test Team' });
    teamId = teamRes.body.team.id;

    // 4. Add User B to Team as STAFF
    await prismaPrimary.membership.create({
      data: {
        teamId,
        userId: userIdB,
        role: Role.STAFF,
        status: 'ACTIVE',
      },
    });

    // 5. Create Foreign Team & User for Isolation Tests
    const foreignRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: `foreign-push-user-${Date.now()}@example.com`, password: 'ForeignPassword123!' });
    foreignUserToken = foreignRes.body.accessToken;
    foreignUserId = foreignRes.body.user.id;

    const foreignTeamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${foreignUserToken}`)
      .send({ name: 'Isolated Foreign Team' });
    foreignTeamId = foreignTeamRes.body.team.id;
  });

  afterAll(async () => {
    // Clean up created resources
    const userIds = [userIdA, userIdB, foreignUserId].filter(Boolean);
    const teamIds = [teamId, foreignTeamId].filter(Boolean);

    await prismaPrimary.device.deleteMany({ where: { userId: { in: userIds } } });
    await prismaPrimary.userSetting.deleteMany({ where: { userId: { in: userIds } } });
    await prismaPrimary.shiftPreference.deleteMany({ where: { userId: { in: userIds } } });
    await prismaPrimary.membership.deleteMany({ where: { teamId: { in: teamIds } } });
    await prismaPrimary.shift.deleteMany({ where: { teamId: { in: teamIds } } });
    await prismaPrimary.subscription.deleteMany({ where: { teamId: { in: teamIds } } });
    await prismaPrimary.team.deleteMany({ where: { id: { in: teamIds } } });
    await prismaPrimary.refreshToken.deleteMany({
      where: { session: { userId: { in: userIds } } },
    });
    await prismaPrimary.session.deleteMany({ where: { userId: { in: userIds } } });
    await prismaPrimary.user.deleteMany({ where: { id: { in: userIds } } });

    await closeQueue();
  });

  // =========================================================================
  // GROUP 1: Device Registration, Idempotency, and Rotation (Cases 1-3)
  // =========================================================================
  describe('Group 1: Device Token Management & Lifecycle', () => {
    const tokenAlpha = 'ExponentPushToken[device-alpha-token-1]';
    const tokenBeta = 'ExponentPushToken[device-beta-token-2]';
    const tokenAlphaNew = 'ExponentPushToken[device-alpha-token-1-new]';

    it('Case 1: registers and retains multiple devices for one user without collision', async () => {
      // Register Device 1
      const res1 = await request(app)
        .post('/api/devices/push-token')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ pushToken: tokenAlpha });
      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);

      // Register Device 2
      const res2 = await request(app)
        .post('/api/devices/push-token')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ pushToken: tokenBeta });
      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);

      // Verify both devices are retained in DB and active
      const devices = await prismaPrimary.device.findMany({
        where: { userId: userIdA, invalidatedAt: null },
      });
      expect(devices.length).toBe(2);
      const pushTokens = devices.map((d) => d.pushToken);
      expect(pushTokens).toContain(tokenAlpha);
      expect(pushTokens).toContain(tokenBeta);
    });

    it('Case 2: handles repeated registration idempotently and updates lastSeenAt', async () => {
      const beforeDevice = await prismaPrimary.device.findUnique({
        where: { pushToken: tokenAlpha },
      });
      expect(beforeDevice).not.toBeNull();

      // Small delay to ensure timestamp progression
      await new Promise((r) => setTimeout(r, 20));

      const res = await request(app)
        .post('/api/devices/push-token')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ pushToken: tokenAlpha });
      expect(res.status).toBe(200);

      // Verify total device count has not increased
      const allDevices = await prismaPrimary.device.findMany({
        where: { userId: userIdA, invalidatedAt: null },
      });
      expect(allDevices.length).toBe(2);

      const afterDevice = await prismaPrimary.device.findUnique({
        where: { pushToken: tokenAlpha },
      });
      expect(new Date(afterDevice!.lastSeenAt).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeDevice!.lastSeenAt).getTime()
      );
    });

    it('Case 3: rotates push token by invalidating old token while keeping other devices intact', async () => {
      const res = await request(app)
        .post('/api/devices/push-token')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ pushToken: tokenAlphaNew, oldPushToken: tokenAlpha });
      expect(res.status).toBe(200);

      // Verify old token is invalidated
      const oldDev = await prismaPrimary.device.findUnique({
        where: { pushToken: tokenAlpha },
      });
      expect(oldDev).not.toBeNull();
      expect(oldDev!.invalidatedAt).not.toBeNull();

      // Verify new token is active
      const newDev = await prismaPrimary.device.findUnique({
        where: { pushToken: tokenAlphaNew },
      });
      expect(newDev).not.toBeNull();
      expect(newDev!.invalidatedAt).toBeNull();

      // Verify second device (tokenBeta) was untouched
      const betaDev = await prismaPrimary.device.findUnique({
        where: { pushToken: tokenBeta },
      });
      expect(betaDev).not.toBeNull();
      expect(betaDev!.invalidatedAt).toBeNull();
    });
  });

  // =========================================================================
  // GROUP 2: Push Token Invalidation & Worker Resilience (Cases 4-6)
  // =========================================================================
  describe('Group 2: Worker Token Handling & Background Execution', () => {
    const staleToken = 'ExponentPushToken[stale-token-xyz]';
    const retryToken = 'ExponentPushToken[valid-token-retry]';

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('Case 4: invalidates token when Expo returns DeviceNotRegistered error ticket', async () => {
      // Register stale token for User B
      await prismaPrimary.device.upsert({
        where: { pushToken: staleToken },
        create: { userId: userIdB, pushToken: staleToken, lastSeenAt: new Date() },
        update: { userId: userIdB, invalidatedAt: null },
      });

      // Mock Expo Push Service returning DeviceNotRegistered error ticket
      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                status: 'error',
                message: '"ExponentPushToken[stale-token-xyz]" is not a registered push notification recipient',
                details: { error: 'DeviceNotRegistered' },
              },
            ],
          }),
        } as unknown as Response;
      });

      const result = await processPushJob({
        userId: userIdB,
        group: 'SHIFT',
        title: 'Shift Reminder',
        body: 'Upcoming shift reminder',
      });

      expect(result.status).toBe('DELIVERED');

      // Verify stale token is now marked as invalidated
      const dev = await prismaPrimary.device.findUnique({
        where: { pushToken: staleToken },
      });
      expect(dev!.invalidatedAt).not.toBeNull();
    });

    it('Case 5: retries on transient gateway 500 error without deleting or invalidating valid tokens', async () => {
      // Register valid token for User B
      await prismaPrimary.device.upsert({
        where: { pushToken: retryToken },
        create: { userId: userIdB, pushToken: retryToken, lastSeenAt: new Date() },
        update: { userId: userIdB, invalidatedAt: null },
      });

      // Mock Expo Gateway 500 transient failure
      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: 'Gateway timeout' }),
        } as unknown as Response;
      });

      // Worker should throw to trigger BullMQ exponential retry
      await expect(
        processPushJob({
          userId: userIdB,
          group: 'SHIFT',
          title: 'Shift Change',
          body: 'Check schedule',
        })
      ).rejects.toThrow('Expo push gateway returned HTTP 500');

      // Verify token was NOT invalidated
      const dev = await prismaPrimary.device.findUnique({
        where: { pushToken: retryToken },
      });
      expect(dev!.invalidatedAt).toBeNull();
    });

    it('Case 6: enqueues push job asynchronously and processes in background', async () => {
      // Register active token for User A
      const bgToken = 'ExponentPushToken[bg-execution-token]';
      await prismaPrimary.device.upsert({
        where: { pushToken: bgToken },
        create: { userId: userIdA, pushToken: bgToken, lastSeenAt: new Date() },
        update: { userId: userIdA, invalidatedAt: null },
      });

      // Mock fetch returning success
      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ status: 'ok', id: 'ticket-123' }],
          }),
        } as unknown as Response;
      });

      const jobId = await enqueuePushJob(
        {
          userId: userIdA,
          group: 'BILLING',
          title: 'Invoice Ready',
          body: 'Your receipt is ready',
        },
        'req-bg-test-1'
      );

      expect(typeof jobId).toBe('string');
      expect(jobId).not.toBe('');

      // Directly process the job data as the worker would
      const processResult = await processPushJob({
        userId: userIdA,
        group: 'BILLING',
        title: 'Invoice Ready',
        body: 'Your receipt is ready',
      });

      expect(processResult.status).toBe('DELIVERED');
      expect(processResult.deviceCount).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // GROUP 3: Quiet Hours, Boundaries, and Urgency Invariants (Cases 7-11)
  // =========================================================================
  describe('Group 3: Quiet Hours and Urgency Scheduling Rules', () => {
    const quietToken = 'ExponentPushToken[quiet-user-token]';

    beforeAll(async () => {
      // Ensure User B has device token
      await prismaPrimary.device.upsert({
        where: { pushToken: quietToken },
        create: { userId: userIdB, pushToken: quietToken, lastSeenAt: new Date() },
        update: { userId: userIdB, invalidatedAt: null },
      });

      // Set quiet hours: 22:00 to 06:00 in UTC
      await prismaPrimary.userSetting.upsert({
        where: { userId: userIdB },
        create: {
          userId: userIdB,
          timeZone: 'UTC',
          quietStart: '22:00',
          quietEnd: '06:00',
          shiftPush: true,
          swapPush: true,
          billingPush: true,
          fieldUpdatedAt: {},
        },
        update: {
          timeZone: 'UTC',
          quietStart: '22:00',
          quietEnd: '06:00',
          shiftPush: true,
          swapPush: true,
          billingPush: true,
        },
      });
    });

    beforeEach(async () => {
      // Re-activate quietToken for User B before each test
      await prismaPrimary.device.upsert({
        where: { pushToken: quietToken },
        create: { userId: userIdB, pushToken: quietToken, lastSeenAt: new Date() },
        update: { userId: userIdB, invalidatedAt: null },
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('Case 7: defers non-urgent notifications during quiet hours spanning midnight (22:00-06:00)', async () => {
      // Mock current time at 23:30 UTC (inside quiet hours)
      const mockNow = new Date('2026-10-18T23:30:00Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ status: 'ok' }] }),
        } as unknown as Response;
      });

      const result = await processPushJob({
        userId: userIdB,
        group: 'SHIFT',
        eventType: 'NEW_SHIFT',
        title: 'New Shift Scheduled',
        body: 'A new shift has been published for next week',
        shiftStartAt: new Date('2026-10-25T09:00:00Z').toISOString(),
      });

      expect(result.status).toBe('DEFERRED_FOR_QUIET_HOURS');
      expect(result.delayMs).toBeDefined();
      expect(result.delayMs!).toBeGreaterThan(0);
      // No immediate HTTP call dispatched to Expo
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('Case 8: strictly enforces start-inclusive and end-exclusive quiet-hours boundaries', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ status: 'ok' }] }),
        } as unknown as Response;
      });

      // At 22:00:00 UTC (start boundary) -> inside quiet hours, deferred
      const mockStart = new Date('2026-10-18T22:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(mockStart);

      const startResult = await processPushJob({
        userId: userIdB,
        group: 'BILLING',
        eventType: 'BILLING',
        title: 'Payment Reminder',
        body: 'Renewal upcoming',
      });
      expect(startResult.status).toBe('DEFERRED_FOR_QUIET_HOURS');
      expect(fetchSpy).not.toHaveBeenCalled();

      // At 06:00:00 UTC (end boundary) -> outside quiet hours, delivered immediately
      const mockEnd = new Date('2026-10-19T06:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(mockEnd);

      const endResult = await processPushJob({
        userId: userIdB,
        group: 'BILLING',
        eventType: 'BILLING',
        title: 'Payment Reminder',
        body: 'Renewal upcoming',
      });
      expect(endResult.status).toBe('DELIVERED');
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('Case 9: suppresses notification when group is disabled, even for urgent events (AGENTS.md Rule 18)', async () => {
      // Disable shift notifications
      await prismaPrimary.userSetting.update({
        where: { userId: userIdB },
        data: { shiftPush: false },
      });

      const mockNow = new Date('2026-10-18T14:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const fetchSpy = jest.spyOn(global, 'fetch');

      // Urgent event: shift change starting in 2 hours
      const urgentShiftStart = new Date(mockNow + 2 * 3600 * 1000).toISOString();
      const result = await processPushJob({
        userId: userIdB,
        group: 'SHIFT',
        eventType: 'SHIFT_CHANGE',
        title: 'Urgent Shift Change',
        body: 'Your shift today changed',
        shiftStartAt: urgentShiftStart,
      });

      expect(result.status).toBe('SKIPPED');
      expect(result.reason).toBe('GROUP_DISABLED');
      expect(fetchSpy).not.toHaveBeenCalled();

      // Restore shiftPush for subsequent tests
      await prismaPrimary.userSetting.update({
        where: { userId: userIdB },
        data: { shiftPush: true },
      });
    });

    it('Case 10: allows urgent event (<12h future shift) to bypass quiet hours immediately', async () => {
      // Mock time at 23:00 UTC (inside quiet hours 22:00-06:00)
      const mockNow = new Date('2026-10-18T23:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ status: 'ok' }] }),
        } as unknown as Response;
      });

      // Shift starts at 02:00 UTC (3 hours in future, <= 12 hours)
      const shiftStartAt = new Date(mockNow + 3 * 3600 * 1000).toISOString();

      const result = await processPushJob({
        userId: userIdB,
        group: 'SHIFT',
        eventType: 'SHIFT_CHANGE',
        title: 'Urgent: Shift Modified',
        body: 'Your shift starting at 2am has been updated',
        shiftStartAt,
      });

      expect(result.status).toBe('DELIVERED');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('Case 11: treats non-urgent event types as non-urgent even if starting within 12h', async () => {
      // Mock time at 23:00 UTC (inside quiet hours)
      const mockNow = new Date('2026-10-18T23:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ status: 'ok' }] }),
        } as unknown as Response;
      });

      // NEW_SHIFT starting in 2 hours is NOT an urgent type (PRD F7.5 & AGENTS.md Rule 18)
      const shiftStartAt = new Date(mockNow + 2 * 3600 * 1000).toISOString();

      const result = await processPushJob({
        userId: userIdB,
        group: 'SHIFT',
        eventType: 'NEW_SHIFT',
        title: 'New Shift Added',
        body: 'A new shift has been assigned',
        shiftStartAt,
      });

      expect(result.status).toBe('DEFERRED_FOR_QUIET_HOURS');
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // GROUP 4: Queued-State Dynamics & Pre-Send Verification (Cases 12-14)
  // =========================================================================
  describe('Group 4: Queued-State Dynamics & Send-Time Verification', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('Case 12: respects notification preference changes made while job was delayed/queued', async () => {
      // User initially had swapPush: true. Simulate user turning it off while job is queued
      await prismaPrimary.userSetting.update({
        where: { userId: userIdB },
        data: { swapPush: false },
      });

      const fetchSpy = jest.spyOn(global, 'fetch');

      // Delayed job executes now
      const result = await processPushJob({
        userId: userIdB,
        group: 'SWAP',
        eventType: 'SWAP_REQUEST',
        title: 'Swap Requested',
        body: 'A colleague requested a swap',
      });

      expect(result.status).toBe('SKIPPED');
      expect(result.reason).toBe('GROUP_DISABLED');
      expect(fetchSpy).not.toHaveBeenCalled();

      // Restore
      await prismaPrimary.userSetting.update({
        where: { userId: userIdB },
        data: { swapPush: true },
      });
    });

    it('Case 13: recalculates quiet hours using updated time zone after user changes location', async () => {
      // Change User B time zone to Asia/Tokyo (UTC+9)
      // If UTC is 14:00, Tokyo time is 23:00 (inside quiet hours 22:00-06:00)
      await prismaPrimary.userSetting.update({
        where: { userId: userIdB },
        data: {
          timeZone: 'Asia/Tokyo',
          quietStart: '22:00',
          quietEnd: '06:00',
        },
      });

      const mockNow = new Date('2026-10-18T14:30:00Z').getTime(); // 23:30 in Tokyo
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const fetchSpy = jest.spyOn(global, 'fetch');

      const result = await processPushJob({
        userId: userIdB,
        group: 'BILLING',
        eventType: 'BILLING',
        title: 'Invoice Available',
        body: 'Your receipt is ready',
      });

      expect(result.status).toBe('DEFERRED_FOR_QUIET_HOURS');
      expect(fetchSpy).not.toHaveBeenCalled();

      // Reset to UTC
      await prismaPrimary.userSetting.update({
        where: { userId: userIdB },
        data: { timeZone: 'UTC' },
      });
    });

    it('Case 14: suppresses push delivery when team membership is revoked while queued', async () => {
      // Create temporary team member
      const tempUserRes = await request(app)
        .post('/api/auth/signup')
        .send({ email: `temp-member-${Date.now()}@example.com`, password: 'TempPassword123!' });
      const tempUserId = tempUserRes.body.user.id;
      const tempToken = `ExponentPushToken[temp-member-${Date.now()}]`;

      await prismaPrimary.device.upsert({
        where: { pushToken: tempToken },
        create: { userId: tempUserId, pushToken: tempToken, lastSeenAt: new Date() },
        update: { userId: tempUserId, invalidatedAt: null },
      });

      // Add to team
      const membership = await prismaPrimary.membership.create({
        data: {
          teamId,
          userId: tempUserId,
          role: Role.STAFF,
          status: 'ACTIVE',
        },
      });

      // Simulate revocation before job runs
      await prismaPrimary.membership.update({
        where: { id: membership.id },
        data: { status: 'REMOVED' },
      });

      const fetchSpy = jest.spyOn(global, 'fetch');

      const result = await processPushJob({
        userId: tempUserId,
        teamId,
        group: 'SHIFT',
        eventType: 'SHIFT_CHANGE',
        title: 'Team Schedule Changed',
        body: 'Confidential shift change',
      });

      expect(result.status).toBe('SKIPPED');
      expect(result.reason).toBe('ACCESS_REVOKED');
      expect(fetchSpy).not.toHaveBeenCalled();

      // Clean up temp
      await prismaPrimary.refreshToken.deleteMany({
        where: { session: { userId: tempUserId } },
      });
      await prismaPrimary.session.deleteMany({ where: { userId: tempUserId } });
      await prismaPrimary.device.deleteMany({ where: { userId: tempUserId } });
      await prismaPrimary.membership.deleteMany({ where: { userId: tempUserId } });
      await prismaPrimary.user.deleteMany({ where: { id: tempUserId } });
    });
  });

  // =========================================================================
  // GROUP 5: Settings Coordination & State Invariants (Cases 15-19)
  // =========================================================================
  describe('Group 5: Cross-Device Settings Coordination & State Invariants', () => {
    it('Case 15: coordinates settings across devices (PUT/PATCH on A, GET on B)', async () => {
      const patchRes = await request(app)
        .patch('/api/settings')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ theme: 'dark', language: 'en' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.theme).toBe('dark');
      expect(patchRes.body.language).toBe('en');

      // GET on device B (or subsequent fetch)
      const getRes = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${userTokenA}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.theme).toBe('dark');
      expect(getRes.body.language).toBe('en');
      expect(getRes.body.fieldUpdatedAt).toBeDefined();
      expect(getRes.body.fieldUpdatedAt.theme).toBeDefined();
    });

    it('Case 16: updates independent fields independently without clobbering other fields', async () => {
      // Step 1: Device A updates quiet hours
      const resA = await request(app)
        .patch('/api/settings')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ quietStart: '23:00', quietEnd: '08:00' });
      expect(resA.status).toBe(200);

      // Step 2: Device B updates theme
      const resB = await request(app)
        .patch('/api/settings')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ theme: 'light' });
      expect(resB.status).toBe(200);

      // Verify both quiet hours and theme survive
      const finalRes = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${userTokenA}`);
      expect(finalRes.status).toBe(200);
      expect(finalRes.body.quietStart).toBe('23:00');
      expect(finalRes.body.quietEnd).toBe('08:00');
      expect(finalRes.body.theme).toBe('light');

      // Verify independent timestamps exist in fieldUpdatedAt
      expect(finalRes.body.fieldUpdatedAt.quietStart).toBeDefined();
      expect(finalRes.body.fieldUpdatedAt.theme).toBeDefined();
    });

    it('Case 17: resolves same-field concurrent conflicts with latest server-accepted write winning', async () => {
      // Write 1: Europe/London
      await request(app)
        .patch('/api/settings')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ timeZone: 'Europe/London' });

      await new Promise((r) => setTimeout(r, 20));

      // Write 2: America/New_York (later accepted write)
      const write2Res = await request(app)
        .patch('/api/settings')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ timeZone: 'America/New_York' });
      expect(write2Res.status).toBe(200);

      const getRes = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${userTokenA}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.timeZone).toBe('America/New_York');
    });

    it('Case 18: rolls back on optimistic failure leaving server state intact when validation fails', async () => {
      // Initial quietStart is 23:00
      const initialRes = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${userTokenA}`);
      const initialQuietStart = initialRes.body.quietStart;

      // Send invalid payload (invalid time format)
      const invalidRes = await request(app)
        .patch('/api/settings')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ quietStart: 'not-a-valid-time' });
      expect(invalidRes.status).toBe(400);

      // Verify server state was NOT corrupted or changed
      const afterRes = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${userTokenA}`);
      expect(afterRes.status).toBe(200);
      expect(afterRes.body.quietStart).toBe(initialQuietStart);
    });

    it('Case 19: preserves valid state safely when concurrent invalid requests occur', async () => {
      // Send valid update and invalid update concurrently
      const [validRes, invalidRes] = await Promise.all([
        request(app)
          .patch('/api/settings')
          .set('Authorization', `Bearer ${userTokenA}`)
          .send({ language: 'en' }),
        request(app)
          .patch('/api/settings')
          .set('Authorization', `Bearer ${userTokenA}`)
          .send({ quietEnd: '99:99' }),
      ]);

      expect(validRes.status).toBe(200);
      expect(invalidRes.status).toBe(400);

      const checkRes = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${userTokenA}`);
      expect(checkRes.status).toBe(200);
      expect(checkRes.body.language).toBe('en');
    });
  });

  // =========================================================================
  // GROUP 6: Deep Link & Authentication Isolation (Cases 20-22)
  // =========================================================================
  describe('Group 6: Deep Link Data Integrity & Isolation Guards', () => {
    it('Case 20: includes complete deep-link payload routing structure in push notifications', async () => {
      const jobData: PushJobData = {
        userId: userIdA,
        teamId,
        group: 'SHIFT',
        eventType: 'SHIFT_CHANGE',
        title: 'Shift Change',
        body: 'Details updated',
        data: {
          shiftId: 'shift-12345',
          teamId,
          type: 'SHIFT_DETAILS',
        },
      };

      let sentBody: any;
      jest.spyOn(global, 'fetch').mockImplementationOnce(async (_url, options) => {
        sentBody = JSON.parse(options?.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ status: 'ok' }] }),
        } as unknown as Response;
      });

      await processPushJob(jobData);

      expect(sentBody).toBeDefined();
      expect(Array.isArray(sentBody)).toBe(true);
      expect(sentBody[0].data).toBeDefined();
      expect(sentBody[0].data.shiftId).toBe('shift-12345');
      expect(sentBody[0].data.teamId).toBe(teamId);
      expect(sentBody[0].data.group).toBe('SHIFT');
    });

    it('Case 21: rejects unauthenticated deep-link target access and requires valid credentials', async () => {
      const res = await request(app).get(`/api/teams/${teamId}/shifts`);
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('Case 22: prevents cross-team data leaks on direct API or deep link target navigation', async () => {
      // User B attempts to access foreign team shifts directly
      const res = await request(app)
        .get(`/api/teams/${foreignTeamId}/shifts`)
        .set('Authorization', `Bearer ${userTokenB}`);

      // Must be forbidden (403) or not-found (404) for isolation, no data leaked
      expect([403, 404]).toContain(res.status);
      expect(res.body.shifts).toBeUndefined();
    });
  });
});
