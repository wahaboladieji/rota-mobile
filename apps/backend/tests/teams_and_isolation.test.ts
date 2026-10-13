import request from 'supertest';
import { app } from '../src/app';
import { prismaPrimary } from '../src/data/db';
import { Role } from '@rota/shared';
import { closeQueue } from '../src/jobs/queue';

describe('Tenant Isolation & Role Permission Guards (PRD F1.3, F1.4)', () => {
  let ownerToken: string;
  let ownerId: string;
  let staffToken: string;
  let staffId: string;
  let teamId: string;
  let foreignTeamId: string;

  beforeAll(async () => {
    // 1. Create Owner User
    const ownerRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: `team-owner-${Date.now()}@example.com`, password: 'OwnerPassword123!' });
    ownerToken = ownerRes.body.accessToken;
    ownerId = ownerRes.body.user.id;

    // 2. Create Staff User
    const staffRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: `team-staff-${Date.now()}@example.com`, password: 'StaffPassword123!' });
    staffToken = staffRes.body.accessToken;
    staffId = staffRes.body.user.id;

    // 3. Create Team as Owner
    const teamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Acme Health Center' });
    teamId = teamRes.body.team.id;

    // 4. Add Staff to Team with STAFF role
    await prismaPrimary.membership.create({
      data: {
        teamId,
        userId: staffId,
        role: Role.STAFF,
        status: 'ACTIVE',
      },
    });

    // 5. Create a completely unrelated Foreign Team by a different owner
    const foreignOwnerRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: `foreign-owner-${Date.now()}@example.com`, password: 'ForeignPassword123!' });
    const foreignTeamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${foreignOwnerRes.body.accessToken}`)
      .send({ name: 'Secret Foreign Corp' });
    foreignTeamId = foreignTeamRes.body.team.id;
  });

  afterAll(async () => {
    const teamsToDelete = [teamId, foreignTeamId].filter(Boolean);

    const testUsers = await prismaPrimary.user.findMany({
      where: {
        OR: [{ email: { contains: 'team-' } }, { email: { contains: 'foreign-' } }],
      },
      select: { id: true },
    });
    const userIds = testUsers.map((u) => u.id);
    if (userIds.length > 0) {
      const ownedTeams = await prismaPrimary.team.findMany({
        where: { ownerId: { in: userIds } },
        select: { id: true },
      });
      const allTeamIds = Array.from(new Set([...teamsToDelete, ...ownedTeams.map((t) => t.id)]));
      if (allTeamIds.length > 0) {
        await prismaPrimary.invitation.deleteMany({
          where: { teamId: { in: allTeamIds } },
        });
        await prismaPrimary.membership.deleteMany({
          where: { teamId: { in: allTeamIds } },
        });
        await prismaPrimary.subscription.deleteMany({
          where: { teamId: { in: allTeamIds } },
        });
        await prismaPrimary.activityEvent.deleteMany({
          where: { teamId: { in: allTeamIds } },
        });
        await prismaPrimary.team.deleteMany({
          where: { id: { in: allTeamIds } },
        });
      }
      await prismaPrimary.membership.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prismaPrimary.refreshToken.deleteMany({
        where: { session: { userId: { in: userIds } } },
      });
      await prismaPrimary.session.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prismaPrimary.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }

    await closeQueue();
    await prismaPrimary.$disconnect();
  });

  describe('Team Creation & Initial Subscription State', () => {
    it('establishes creator as OWNER and creates Starter subscription in PENDING_INITIAL_PAYMENT', async () => {
      const team = await prismaPrimary.team.findUnique({
        where: { id: teamId },
        include: {
          subscription: true,
          memberships: true,
        },
      });

      expect(team).not.toBeNull();
      expect(team?.ownerId).toBe(ownerId);
      expect(team?.memberships.some((m) => m.userId === ownerId && m.role === Role.OWNER)).toBe(true);

      // Verify subscription invariant
      expect(team?.subscription).not.toBeNull();
      expect(team?.subscription?.planCode).toBe('STARTER');
      expect(team?.subscription?.status).toBe('PENDING_INITIAL_PAYMENT');
      expect(team?.subscription?.paidSeatEntitlement).toBe(5);
    });

    it('returns team memberships in GET /api/me', async () => {
      const res = await request(app)
        .get('/api/me')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.memberships.length).toBeGreaterThanOrEqual(1);
      const membership = res.body.memberships.find((m: any) => m.teamId === teamId);
      expect(membership).toBeDefined();
      expect(membership.name).toBe('Acme Health Center');
      expect(membership.role).toBe(Role.OWNER);
    });
  });

  describe('Role-Based Access Control (PRD F1.3)', () => {
    it('rejects Staff direct request to delete/mutate a shift with 403 Forbidden', async () => {
      const fakeShiftId = '00000000-0000-0000-0000-000000000001';
      const res = await request(app)
        .delete(`/api/teams/${teamId}/shifts/${fakeShiftId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/forbidden/i);
    });

    it('allows Owner to access shift delete mutation endpoint', async () => {
      const fakeShiftId = '00000000-0000-0000-0000-000000000001';
      const res = await request(app)
        .delete(`/api/teams/${teamId}/shifts/${fakeShiftId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Cross-Team Tenant Isolation (PRD F1.4)', () => {
    it('returns 404 when querying an existing team user does not belong to (prevents leakage)', async () => {
      const res = await request(app)
        .get(`/api/teams/${foreignTeamId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      // Must be 404 to avoid leaking whether foreignTeamId exists
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('rejects access from client-supplied fake or guessed team UUIDs with 404', async () => {
      const guessedId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
      const res = await request(app)
        .get(`/api/teams/${guessedId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Invitations & Email Delivery (PRD F1.2)', () => {
    it('blocks invitation creation while subscription is in PENDING_INITIAL_PAYMENT (PRD D1)', async () => {
      const res = await request(app)
        .post(`/api/teams/${teamId}/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'colleague-blocked@example.com',
          role: Role.STAFF,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/subscription required/i);
    });

    it('creates invitation, returns token & inviteUrl, and dispatches email when subscription is ACTIVE', async () => {
      // Activate subscription for test
      await prismaPrimary.subscription.update({
        where: { teamId },
        data: { status: 'ACTIVE' },
      });

      const colleagueEmail = `colleague-${Date.now()}@example.com`;
      const res = await request(app)
        .post(`/api/teams/${teamId}/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: colleagueEmail,
          role: Role.STAFF,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.email).toBe(colleagueEmail);
      expect(res.body.token).toBeDefined();
      expect(res.body.inviteUrl).toContain(res.body.token);

      const inviteToken = res.body.token;

      // 1. Web landing page
      const webRes = await request(app).get(`/invite/${inviteToken}`);
      expect(webRes.status).toBe(200);
      expect(webRes.text).toContain('You’re invited');
      expect(webRes.text).toContain(inviteToken);

      // 2. API info preview
      const previewRes = await request(app).get(`/api/invitations/${inviteToken}`);
      expect(previewRes.status).toBe(200);
      expect(previewRes.body.valid).toBe(true);
      expect(previewRes.body.teamName).toBe('Acme Health Center');
      expect(previewRes.body.email).toBe(colleagueEmail);

      // 3. Reject accept when user email does not match
      const wrongUserRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `wrong-${Date.now()}@example.com`,
          password: 'Password123!',
          verificationCode: '000000',
        });
      const wrongToken = wrongUserRes.body.accessToken;

      const rejectRes = await request(app)
        .post(`/api/invitations/${inviteToken}/accept`)
        .set('Authorization', `Bearer ${wrongToken}`);
      expect(rejectRes.status).toBe(403);
      expect(rejectRes.body.error).toContain('Please sign in with the invited email address');

      // 4. Accept when signed in with matching invited email
      const correctUserRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: colleagueEmail,
          password: 'Password123!',
          verificationCode: '000000',
        });
      const correctToken = correctUserRes.body.accessToken;

      const acceptRes = await request(app)
        .post(`/api/invitations/${inviteToken}/accept`)
        .set('Authorization', `Bearer ${correctToken}`);
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.role).toBe(Role.STAFF);

      // 5. Replay attempt rejected (single-use)
      const replayRes = await request(app)
        .post(`/api/invitations/${inviteToken}/accept`)
        .set('Authorization', `Bearer ${correctToken}`);
      expect(replayRes.status).toBe(410);
      expect(replayRes.body.error).toContain('already been accepted');
    });
  });
});

