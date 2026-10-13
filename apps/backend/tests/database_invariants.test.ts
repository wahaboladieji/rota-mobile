import { prismaPrimary } from '../src/data/db';
import { v4 as uuidv4 } from 'uuid';
import { closeQueue } from '../src/jobs/queue';

describe('PostgreSQL Database Invariants & Constraints (PRD Section 10)', () => {
  let userId: string;
  let teamId: string;
  let subscriptionId: string;

  beforeAll(async () => {
    // Create base user and team directly for invariant testing
    userId = uuidv4();
    teamId = uuidv4();
    subscriptionId = uuidv4();

    await prismaPrimary.user.create({
      data: {
        id: userId,
        email: `db-invariant-${Date.now()}@example.com`,
      },
    });

    await prismaPrimary.team.create({
      data: {
        id: teamId,
        name: 'Invariant Test Team',
        ownerId: userId,
      },
    });

    await prismaPrimary.subscription.create({
      data: {
        id: subscriptionId,
        teamId,
        planCode: 'STARTER',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86400000),
        paidSeatEntitlement: 5,
        activeMemberCount: 1,
      },
    });
  });

  afterAll(async () => {
    await prismaPrimary.shift.deleteMany({ where: { teamId } });
    await prismaPrimary.$executeRawUnsafe(`ALTER TABLE "LedgerEntry" DISABLE TRIGGER "ledger_entry_no_delete";`);
    await prismaPrimary.ledgerEntry.deleteMany({ where: { teamId } });
    await prismaPrimary.$executeRawUnsafe(`ALTER TABLE "LedgerEntry" ENABLE TRIGGER "ledger_entry_no_delete";`);
    await prismaPrimary.subscription.deleteMany({ where: { teamId } });
    await prismaPrimary.team.deleteMany({ where: { id: teamId } });
    await prismaPrimary.user.deleteMany({ where: { id: userId } });
    await closeQueue();
    await prismaPrimary.$disconnect();
  });

  describe('PostgreSQL Exclusion Constraint: no_overlapping_published_shifts (PRD F2, Section 10)', () => {
    it('allows adjacent shifts sharing boundary [09:00, 17:00) and [17:00, 21:00)', async () => {
      const start1 = new Date('2026-11-01T09:00:00Z');
      const end1 = new Date('2026-11-01T17:00:00Z');
      const start2 = new Date('2026-11-01T17:00:00Z');
      const end2 = new Date('2026-11-01T21:00:00Z');

      const shift1 = await prismaPrimary.shift.create({
        data: {
          teamId,
          assigneeId: userId,
          startAt: start1,
          endAt: end1,
          status: 'PUBLISHED',
        },
      });

      const shift2 = await prismaPrimary.shift.create({
        data: {
          teamId,
          assigneeId: userId,
          startAt: start2,
          endAt: end2,
          status: 'PUBLISHED',
        },
      });

      expect(shift1.id).toBeDefined();
      expect(shift2.id).toBeDefined();
    });

    it('rejects overlapping published shifts for the same assignee at database boundary', async () => {
      const start = new Date('2026-11-02T10:00:00Z');
      const end = new Date('2026-11-02T18:00:00Z');

      // First published shift
      await prismaPrimary.shift.create({
        data: {
          teamId,
          assigneeId: userId,
          startAt: start,
          endAt: end,
          status: 'PUBLISHED',
        },
      });

      // Second overlapping shift for the same assignee (12:00 to 16:00)
      const overlappingStart = new Date('2026-11-02T12:00:00Z');
      const overlappingEnd = new Date('2026-11-02T16:00:00Z');

      await expect(
        prismaPrimary.shift.create({
          data: {
            teamId,
            assigneeId: userId,
            startAt: overlappingStart,
            endAt: overlappingEnd,
            status: 'PUBLISHED',
          },
        })
      ).rejects.toThrow();
    });

    it('allows overlapping shifts if one of them is CANCELLED', async () => {
      const start = new Date('2026-11-03T10:00:00Z');
      const end = new Date('2026-11-03T18:00:00Z');

      await prismaPrimary.shift.create({
        data: {
          teamId,
          assigneeId: userId,
          startAt: start,
          endAt: end,
          status: 'CANCELLED',
        },
      });

      // A published shift during the same time window must succeed because the first is cancelled
      const publishedShift = await prismaPrimary.shift.create({
        data: {
          teamId,
          assigneeId: userId,
          startAt: start,
          endAt: end,
          status: 'PUBLISHED',
        },
      });

      expect(publishedShift.id).toBeDefined();
    });
  });

  describe('Shift Interval Check Constraint: endAt > startAt', () => {
    it('rejects shifts where endAt <= startAt', async () => {
      const start = new Date('2026-11-04T12:00:00Z');
      const invalidEnd = new Date('2026-11-04T10:00:00Z'); // before start

      await expect(
        prismaPrimary.shift.create({
          data: {
            teamId,
            assigneeId: userId,
            startAt: start,
            endAt: invalidEnd,
            status: 'PUBLISHED',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Nonnegative Constraint Checks', () => {
    it('rejects negative paidSeatEntitlement on Subscription', async () => {
      await expect(
        prismaPrimary.$executeRawUnsafe(
          `INSERT INTO "Subscription" ("id", "teamId", "planCode", "periodStart", "periodEnd", "paidSeatEntitlement", "activeMemberCount")
           VALUES ('${uuidv4()}', '${teamId}', 'STARTER', NOW(), NOW() + INTERVAL '30 days', -5, 1);`
        )
      ).rejects.toThrow();
    });
  });

  describe('LedgerEntry Immutability Protection (PRD F6.4, Section 10)', () => {
    let ledgerId: string;

    beforeAll(async () => {
      ledgerId = uuidv4();
      await prismaPrimary.ledgerEntry.create({
        data: {
          id: ledgerId,
          teamId,
          subscriptionId,
          kind: 'CHARGE',
          eventType: 'INITIAL_PAYMENT',
          amountCents: 2000,
          currency: 'USD',
          effectiveAt: new Date(),
        },
      });
    });

    it('rejects direct SQL UPDATE on LedgerEntry via protective trigger', async () => {
      await expect(
        prismaPrimary.$executeRawUnsafe(
          `UPDATE "LedgerEntry" SET "amountCents" = 3000 WHERE "id" = '${ledgerId}';`
        )
      ).rejects.toThrow(/LedgerEntry rows are immutable/i);
    });

    it('rejects direct SQL DELETE on LedgerEntry via protective trigger', async () => {
      await expect(
        prismaPrimary.$executeRawUnsafe(
          `DELETE FROM "LedgerEntry" WHERE "id" = '${ledgerId}';`
        )
      ).rejects.toThrow(/LedgerEntry rows are immutable/i);
    });
  });
});
