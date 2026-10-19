import request from 'supertest';
import { app } from '../src/app';
import { prismaPrimary } from '../src/data/db';
import { Role } from '@rota/shared';
import { closeQueue } from '../src/jobs/queue';
import { encodeCursor, decodeCursor } from '../src/routes/activity.routes';

describe('Activity Feed Cursor Pagination & Team Isolation (PRD F4.1-F4.4)', () => {
  let ownerToken: string;
  let ownerId: string;
  let teamId: string;

  let otherOwnerToken: string;
  let otherTeamId: string;

  beforeAll(async () => {
    // 1. Create primary team & owner
    const ownerEmail = `activity-owner-${Date.now()}@example.com`;
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: ownerEmail, password: 'Password123!' });
    ownerToken = signupRes.body.accessToken;
    ownerId = signupRes.body.user.id;

    const teamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Activity Test Clinic' });
    teamId = teamRes.body.team.id;

    // 2. Create secondary team & owner for isolation tests
    const otherEmail = `other-owner-${Date.now()}@example.com`;
    const otherSignupRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: otherEmail, password: 'Password123!' });
    otherOwnerToken = otherSignupRes.body.accessToken;

    const otherTeamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${otherOwnerToken}`)
      .send({ name: 'Other Isolation Clinic' });
    otherTeamId = otherTeamRes.body.team.id;
  });

  afterAll(async () => {
    const teams = [teamId, otherTeamId].filter(Boolean);
    if (teams.length > 0) {
      await prismaPrimary.activityEvent.deleteMany({ where: { teamId: { in: teams } } });
      await prismaPrimary.membership.deleteMany({ where: { teamId: { in: teams } } });
      await prismaPrimary.subscription.deleteMany({ where: { teamId: { in: teams } } });
      await prismaPrimary.team.deleteMany({ where: { id: { in: teams } } });
    }

    const testUsers = await prismaPrimary.user.findMany({
      where: {
        email: { in: [`activity-owner-${Date.now()}@example.com`, `other-owner-${Date.now()}@example.com`] },
      },
      select: { id: true },
    });
    const userIds = testUsers.map((u) => u.id);
    if (userIds.length > 0) {
      await prismaPrimary.refreshToken.deleteMany({ where: { session: { userId: { in: userIds } } } });
      await prismaPrimary.session.deleteMany({ where: { userId: { in: userIds } } });
      await prismaPrimary.user.deleteMany({ where: { id: { in: userIds } } });
    }

    await closeQueue();
    await prismaPrimary.$disconnect();
  });

  beforeEach(async () => {
    // Clear activity events for our test teams before each test
    await prismaPrimary.activityEvent.deleteMany({
      where: { teamId: { in: [teamId, otherTeamId] } },
    });
  });

  describe('Cursor Encoder & Decoder unit tests', () => {
    it('encodes and decodes valid timestamps and UUIDs properly', () => {
      const date = new Date('2026-10-16T18:00:00.000Z');
      const id = '12345678-1234-1234-1234-123456789abc';
      const encoded = encodeCursor(date, id);

      expect(typeof encoded).toBe('string');
      const decoded = decodeCursor(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded?.createdAt.toISOString()).toBe(date.toISOString());
      expect(decoded?.id).toBe(id);
    });

    it('decodes plaintext legacy format ${iso}_${uuid} gracefully', () => {
      const dateStr = '2026-10-16T18:00:00.000Z';
      const id = '12345678-1234-1234-1234-123456789abc';
      const decoded = decodeCursor(`${dateStr}_${id}`);
      expect(decoded).not.toBeNull();
      expect(decoded?.createdAt.toISOString()).toBe(dateStr);
      expect(decoded?.id).toBe(id);
    });

    it('returns null for malformed or invalid cursors', () => {
      expect(decodeCursor('')).toBeNull();
      expect(decodeCursor('random-string-without-underscore')).toBeNull();
      expect(decodeCursor('not-a-date_12345678-1234-1234-1234-123456789abc')).toBeNull();
      expect(decodeCursor('2026-10-16T18:00:00.000Z_not-a-uuid')).toBeNull();
    });
  });

  describe('Basic Pagination & Determinism', () => {
    it('returns empty feed when no events exist', async () => {
      const res = await request(app)
        .get(`/api/teams/${teamId}/activity`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.hasMore).toBe(false);
      expect(res.body.nextCursor).toBeNull();
    });

    it('paginates deterministically across multiple pages in descending order', async () => {
      // Create 5 events with staggered timestamps
      const baseTime = Date.now() - 10000;
      for (let i = 0; i < 5; i++) {
        await prismaPrimary.activityEvent.create({
          data: {
            teamId,
            actorId: ownerId,
            type: `EVENT_${i}`,
            payload: { index: i },
            createdAt: new Date(baseTime + i * 1000),
          },
        });
      }

      // Fetch page 1 (limit 2)
      const page1 = await request(app)
        .get(`/api/teams/${teamId}/activity?limit=2`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(page1.status).toBe(200);
      expect(page1.body.items.length).toBe(2);
      expect(page1.body.items[0].type).toBe('EVENT_4'); // newest first
      expect(page1.body.items[1].type).toBe('EVENT_3');
      expect(page1.body.hasMore).toBe(true);
      expect(page1.body.nextCursor).not.toBeNull();

      // Fetch page 2 (limit 2)
      const page2 = await request(app)
        .get(`/api/teams/${teamId}/activity?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(page2.status).toBe(200);
      expect(page2.body.items.length).toBe(2);
      expect(page2.body.items[0].type).toBe('EVENT_2');
      expect(page2.body.items[1].type).toBe('EVENT_1');
      expect(page2.body.hasMore).toBe(true);
      expect(page2.body.nextCursor).not.toBeNull();

      // Fetch page 3 (limit 2) -> only 1 left
      const page3 = await request(app)
        .get(`/api/teams/${teamId}/activity?limit=2&cursor=${encodeURIComponent(page2.body.nextCursor)}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(page3.status).toBe(200);
      expect(page3.body.items.length).toBe(1);
      expect(page3.body.items[0].type).toBe('EVENT_0');
      expect(page3.body.hasMore).toBe(false);
      expect(page3.body.nextCursor).toBeNull();
    });
  });

  describe('Identical Timestamps Handling (F4.1)', () => {
    it('handles identical timestamps across page boundaries without skipping or duplicating', async () => {
      const fixedTimestamp = new Date('2026-10-16T12:00:00.000Z');

      // Create 6 events with the EXACT same createdAt timestamp
      const createdIds: string[] = [];
      for (let i = 0; i < 6; i++) {
        const event = await prismaPrimary.activityEvent.create({
          data: {
            teamId,
            actorId: ownerId,
            type: `TIED_EVENT_${i}`,
            payload: { idx: i },
            createdAt: fixedTimestamp,
          },
        });
        createdIds.push(event.id);
      }

      // Collect all items across pages of limit 2
      const collectedIds: string[] = [];
      let cursor: string | null = null;
      let hasMore = true;
      let pageCount = 0;

      while (hasMore && pageCount < 5) {
        pageCount++;
        const url: string = cursor
          ? `/api/teams/${teamId}/activity?limit=2&cursor=${encodeURIComponent(cursor)}`
          : `/api/teams/${teamId}/activity?limit=2`;

        const res = await request(app)
          .get(url)
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(res.status).toBe(200);
        for (const item of res.body.items) {
          collectedIds.push(item.id);
        }
        hasMore = res.body.hasMore;
        cursor = res.body.nextCursor;
      }

      // Must have collected all 6 items
      expect(collectedIds.length).toBe(6);
      // No duplicates!
      const uniqueIds = new Set(collectedIds);
      expect(uniqueIds.size).toBe(6);
      // All created IDs are present
      for (const id of createdIds) {
        expect(uniqueIds.has(id)).toBe(true);
      }
    });
  });

  describe('Concurrent Insertions Between Pages (F4.4)', () => {
    it('new events inserted between page 1 and page 2 do not shift or skip older items during pagination', async () => {
      const baseTime = Date.now() - 50000;

      // 4 older events
      for (let i = 0; i < 4; i++) {
        await prismaPrimary.activityEvent.create({
          data: {
            teamId,
            actorId: ownerId,
            type: `OLD_EVENT_${i}`,
            payload: { i },
            createdAt: new Date(baseTime + i * 1000),
          },
        });
      }

      // Fetch page 1 (limit 2)
      const page1 = await request(app)
        .get(`/api/teams/${teamId}/activity?limit=2`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(page1.body.items.length).toBe(2);
      expect(page1.body.items[0].type).toBe('OLD_EVENT_3');
      expect(page1.body.items[1].type).toBe('OLD_EVENT_2');

      const page1Cursor = page1.body.nextCursor;

      // Now insert a NEW event with recent timestamp (after user read page 1)
      await prismaPrimary.activityEvent.create({
        data: {
          teamId,
          actorId: ownerId,
          type: 'BRAND_NEW_EVENT',
          payload: {},
          createdAt: new Date(),
        },
      });

      // Fetch page 2 using page 1's cursor
      const page2 = await request(app)
        .get(`/api/teams/${teamId}/activity?limit=2&cursor=${encodeURIComponent(page1Cursor)}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(page2.body.items.length).toBe(2);
      // Older items MUST NOT be skipped or duplicated!
      expect(page2.body.items[0].type).toBe('OLD_EVENT_1');
      expect(page2.body.items[1].type).toBe('OLD_EVENT_0');
      expect(page2.body.hasMore).toBe(false);
    });
  });

  describe('Security & Team Isolation (PRD F1.3, F1.4)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get(`/api/teams/${teamId}/activity`);
      expect(res.status).toBe(401);
    });

    it('rejects access from a user who is not a member of the team with 404 (prevents leaking existence)', async () => {
      // otherOwner tries to access teamId
      const res = await request(app)
        .get(`/api/teams/${teamId}/activity`)
        .set('Authorization', `Bearer ${otherOwnerToken}`);
      expect(res.status).toBe(404);
    });

    it('never leaks events across teams', async () => {
      // Create event in other team
      await prismaPrimary.activityEvent.create({
        data: {
          teamId: otherTeamId,
          type: 'OTHER_SECRET_EVENT',
          payload: { secret: true },
          createdAt: new Date(),
        },
      });

      // Query primary team
      const res = await request(app)
        .get(`/api/teams/${teamId}/activity`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(0);
      expect(res.body.items.some((i: any) => i.type === 'OTHER_SECRET_EVENT')).toBe(false);
    });
  });

  describe('Validation & Error Handling', () => {
    it('returns 400 Bad Request for malformed cursor', async () => {
      const res = await request(app)
        .get(`/api/teams/${teamId}/activity?cursor=invalid-garbage-cursor`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid cursor parameter');
    });

    it('returns 400 Bad Request for invalid limit parameter', async () => {
      const res = await request(app)
        .get(`/api/teams/${teamId}/activity?limit=not-a-number`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid query parameters');
    });

    it('returns 400 Bad Request for limit out of bounds (e.g. 0 or > 50)', async () => {
      const resZero = await request(app)
        .get(`/api/teams/${teamId}/activity?limit=0`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(resZero.status).toBe(400);

      const resTooBig = await request(app)
        .get(`/api/teams/${teamId}/activity?limit=999`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(resTooBig.status).toBe(400);
    });

    it('returns 404 for malformed team ID (prevents probing)', async () => {
      const res = await request(app)
        .get('/api/teams/not-a-uuid/activity')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
    });
  });
});
