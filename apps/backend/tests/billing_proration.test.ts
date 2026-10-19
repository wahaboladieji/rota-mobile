import assert from 'node:assert/strict';
import {
  quotePlanChange,
  quoteSeatChange,
} from './billing-proration.adapter';

const period = {
  periodStart: '2026-04-01T00:00:00.000Z',
  periodEnd: '2026-05-01T00:00:00.000Z',
};

const onDay = (day: number) =>
  `2026-04-${String(day).padStart(2, '0')}T12:00:00.000Z`;

function expectFields(actual: Record<string, unknown>, expected: Record<string, unknown>) {
  for (const [field, value] of Object.entries(expected)) {
    assert.deepEqual(actual[field], value, `Field ${field} mismatch`);
  }
}

function planInput(fromPlan: string, toPlan: string, day: number, overrides = {}) {
  return {
    ...period,
    fromPlan,
    toPlan,
    changedAt: onDay(day),
    activeSeats: 5,
    reservedInvitations: 0,
    paidSeats: fromPlan === 'Starter' ? 5 : 15,
    ...overrides,
  };
}

describe('PRD v2 Section 8 / Requirement 5: Eight Required Proration Unit Tests', () => {
  test('1. Starter to Team preserves the supplied example', async () => {
    const quote = await quotePlanChange(planInput('Starter', 'Team', 11));

    expectFields(quote as unknown as Record<string, unknown>, {
      periodDays: 30,
      remainingDays: 20,
      unusedCreditCents: 1333,
      remainingCostCents: 3333,
      dueNowCents: 2000,
      refundCents: 0,
      nextRenewalCents: 5000,
    });
  });

  test('2. Team to Business floors credit and cost separately', async () => {
    const quote = await quotePlanChange(
      planInput('Team', 'Business', 11, { activeSeats: 9 })
    );

    expectFields(quote as unknown as Record<string, unknown>, {
      remainingDays: 20,
      unusedCreditCents: 3333,
      remainingCostCents: 8000,
      dueNowCents: 4667,
      refundCents: 0,
      nextRenewalCents: 12000,
    });
  });

  test('3. Downgrade is scheduled without an immediate refund', async () => {
    const quote = await quotePlanChange(planInput('Team', 'Starter', 11));

    expectFields(quote as unknown as Record<string, unknown>, {
      dueNowCents: 0,
      unusedCreditCents: 0,
      refundCents: 0,
      currentPlan: 'Team',
      scheduledPlan: 'Starter',
      effectiveAt: period.periodEnd,
      nextRenewalCents: 2000,
    });
  });

  test('4. One additional Team seat costs 150 cents for half a period', async () => {
    const quote = await quoteSeatChange({
      ...period,
      changedAt: onDay(16),
      plan: 'Team',
      activeBefore: 15,
      activeAfter: 16,
      paidSeats: 15,
    });

    expectFields(quote as unknown as Record<string, unknown>, {
      remainingDays: 15,
      unusedCreditCents: 2500,
      remainingCostCents: 2650,
      dueNowCents: 150,
      refundCents: 0,
      nextRenewalCents: 5300,
    });
  });

  test('5. Removal gives no credit; a prepaid replacement costs nothing', async () => {
    const removal = await quoteSeatChange({
      ...period,
      changedAt: onDay(11),
      plan: 'Team',
      activeBefore: 16,
      activeAfter: 15,
      paidSeats: 16,
    });

    expectFields(removal as unknown as Record<string, unknown>, {
      dueNowCents: 0,
      unusedCreditCents: 0,
      refundCents: 0,
      currentPeriodPaidSeats: 16,
      nextRenewalCents: 5000,
    });

    const replacement = await quoteSeatChange({
      ...period,
      changedAt: onDay(12),
      plan: 'Team',
      activeBefore: 15,
      activeAfter: 16,
      paidSeats: 16,
    });

    expectFields(replacement as unknown as Record<string, unknown>, {
      dueNowCents: 0,
      unusedCreditCents: 0,
      refundCents: 0,
      currentPeriodPaidSeats: 16,
      nextRenewalCents: 5300,
    });
  });

  test('6. A first-date upgrade uses the entire period', async () => {
    const quote = await quotePlanChange(planInput('Starter', 'Team', 1));

    expectFields(quote as unknown as Record<string, unknown>, {
      remainingDays: 30,
      unusedCreditCents: 2000,
      remainingCostCents: 5000,
      dueNowCents: 3000,
      nextRenewalCents: 5000,
    });
  });

  test('7. A last-date upgrade uses one remaining day', async () => {
    const quote = await quotePlanChange(planInput('Starter', 'Team', 30));

    expectFields(quote as unknown as Record<string, unknown>, {
      remainingDays: 1,
      unusedCreditCents: 66,
      remainingCostCents: 166,
      dueNowCents: 100,
      nextRenewalCents: 5000,
    });
  });

  test('8. Two verified upgrades use the latest plan and original period', async () => {
    const first = await quotePlanChange(planInput('Starter', 'Team', 11));

    // Fixture: the first payment has been independently verified.
    // The server's current subscription is now Team.
    const second = await quotePlanChange(
      planInput('Team', 'Business', 21, { activeSeats: 9 })
    );

    expectFields(first as unknown as Record<string, unknown>, {
      unusedCreditCents: 1333,
      remainingCostCents: 3333,
      dueNowCents: 2000,
    });

    expectFields(second as unknown as Record<string, unknown>, {
      periodDays: 30,
      remainingDays: 10,
      unusedCreditCents: 1666,
      remainingCostCents: 4000,
      dueNowCents: 2334,
      nextRenewalCents: 12000,
    });

    assert.equal(first.dueNowCents + second.dueNowCents, 4334);
  });
});

describe('PRD Section 7 / Section 8 Edge Cases & Boundary Verification', () => {
  test('Team members within included 15 seats incur no extra-seat charge', async () => {
    // 9 active members on Team plan
    const quote = await quotePlanChange(
      planInput('Team', 'Business', 11, { activeSeats: 9, paidSeats: 15 })
    );
    // Team base is 5000, Business base is 12000 (9 <= 40 included)
    assert.equal(quote.unusedCreditCents, 3333);
    assert.equal(quote.remainingCostCents, 8000);
    assert.equal(quote.dueNowCents, 4667);
  });

  test('February standard period (28 days) calculation', async () => {
    const febQuote = await quotePlanChange({
      periodStart: '2026-02-01T00:00:00.000Z',
      periodEnd: '2026-03-01T00:00:00.000Z',
      changedAt: '2026-02-15T12:00:00.000Z', // 14 days elapsed, 14 remaining
      fromPlan: 'Starter',
      toPlan: 'Team',
      activeSeats: 5,
    });
    assert.equal(febQuote.periodDays, 28);
    assert.equal(febQuote.remainingDays, 14);
    assert.equal(febQuote.unusedCreditCents, 1000); // 2000 * 14 / 28
    assert.equal(febQuote.remainingCostCents, 2500); // 5000 * 14 / 28
    assert.equal(febQuote.dueNowCents, 1500);
  });

  test('February leap-year period (29 days) calculation', async () => {
    const leapQuote = await quotePlanChange({
      periodStart: '2028-02-01T00:00:00.000Z',
      periodEnd: '2028-03-01T00:00:00.000Z',
      changedAt: '2028-02-15T00:00:00.000Z', // 14 days elapsed, 15 remaining
      fromPlan: 'Starter',
      toPlan: 'Team',
      activeSeats: 5,
    });
    assert.equal(leapQuote.periodDays, 29);
    assert.equal(leapQuote.remainingDays, 15);
    // 2000 * 15 / 29 = 1034.48 -> 1034
    assert.equal(leapQuote.unusedCreditCents, 1034);
    // 5000 * 15 / 29 = 2586.20 -> 2586
    assert.equal(leapQuote.remainingCostCents, 2586);
    assert.equal(leapQuote.dueNowCents, 1552);
  });

  test('31-day period calculation (May 1 to June 1)', async () => {
    const mayQuote = await quotePlanChange({
      periodStart: '2026-05-01T00:00:00.000Z',
      periodEnd: '2026-06-01T00:00:00.000Z',
      changedAt: '2026-05-16T14:30:00.000Z', // 15 days elapsed, 16 remaining
      fromPlan: 'Starter',
      toPlan: 'Team',
      activeSeats: 5,
    });
    assert.equal(mayQuote.periodDays, 31);
    assert.equal(mayQuote.remainingDays, 16);
    // 2000 * 16 / 31 = 1032
    assert.equal(mayQuote.unusedCreditCents, 1032);
    // 5000 * 16 / 31 = 2580
    assert.equal(mayQuote.remainingCostCents, 2580);
    assert.equal(mayQuote.dueNowCents, 1548);
  });

  test('UTC midnight boundary is recognized accurately', async () => {
    const midnightQuote = await quotePlanChange({
      periodStart: '2026-04-01T00:00:00.000Z',
      periodEnd: '2026-05-01T00:00:00.000Z',
      changedAt: '2026-04-11T00:00:00.000Z', // exact midnight of Day 11
      fromPlan: 'Starter',
      toPlan: 'Team',
      activeSeats: 5,
    });
    assert.equal(midnightQuote.remainingDays, 20);
    assert.equal(midnightQuote.dueNowCents, 2000);
  });

  test('Rejects change date outside the recorded billing period', async () => {
    await assert.rejects(
      async () => {
        await quotePlanChange({
          periodStart: '2026-04-01T00:00:00.000Z',
          periodEnd: '2026-05-01T00:00:00.000Z',
          changedAt: '2026-05-01T00:00:00.000Z', // outside (periodEnd is exclusive)
          fromPlan: 'Starter',
          toPlan: 'Team',
          activeSeats: 5,
        });
      },
      /outside the recorded billing period/
    );
  });

  test('Rejects downgrade if active members exceed Starter capacity (5)', async () => {
    await assert.rejects(
      async () => {
        await quotePlanChange(
          planInput('Team', 'Starter', 11, { activeSeats: 6 })
        );
      },
      /Starter capacity cannot exceed 5 seats/
    );
  });
});
