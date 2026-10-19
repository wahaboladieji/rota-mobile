# Rota Billing Proration Unit Tests

This document catalogs the unit test implementation and execution results for Rota's proration arithmetic engine according to **PRD v2 Section 8**, **PRD v2 F6.5**, and the 8 mandated test benchmarks.

---

## 1. Test Suite Architecture

- **Domain Engine**: `apps/backend/src/domain/proration.service.ts`
- **Adapter**: `apps/backend/tests/billing-proration.adapter.ts`
- **Test Suite**: `apps/backend/tests/billing_proration.test.ts`
- **Test Runner**: Jest (`ts-jest`) with Node.js LTS
- **Execution Command**:
  ```bash
  npm test -- tests/billing_proration.test.ts
  ```

---

## 2. Benchmark Test Cases (Cases 1–8)

All 8 prompt test cases were executed and validated to the exact integer cent.

### Case 1: Upgrade from Starter to Team (30-day period, 10 days used)
- **Input**:
  - `periodStart`: `2026-06-01T00:00:00Z`
  - `periodEnd`: `2026-07-01T00:00:00Z` (30 days)
  - `changedAt`: `2026-06-11T00:00:00Z` (20 days remaining)
  - `fromPlan`: `'STARTER'` ($20.00 / 2,000 ¢)
  - `toPlan`: `'TEAM'` ($50.00 / 5,000 ¢)
- **Calculation**:
  - `unusedCreditCents`: $\lfloor 2000 \times 20 / 30 \rfloor = 1,333$
  - `remainingCostCents`: $\lfloor 5000 \times 20 / 30 \rfloor = 3,333$
  - `dueNowCents`: $3,333 - 1,333 = 2,000$ ($20.00)
- **Result**: `PASSED` (credit: 1333, cost: 3333, dueNow: 2000)

### Case 2: Upgrade from Team to Business (30-day period, 15 days used)
- **Input**:
  - `periodStart`: `2026-06-01T00:00:00Z`, `periodEnd`: `2026-07-01T00:00:00Z` (30 days)
  - `changedAt`: `2026-06-16T00:00:00Z` (15 days remaining)
  - `fromPlan`: `'TEAM'` (5,000 ¢), `toPlan`: `'BUSINESS'` (12,000 ¢)
- **Calculation**:
  - `unusedCreditCents`: $\lfloor 5000 \times 15 / 30 \rfloor = 2,500$
  - `remainingCostCents`: $\lfloor 12000 \times 15 / 30 \rfloor = 6,000$
  - `dueNowCents`: $6,000 - 2,500 = 3,500$ ($35.00)
- **Result**: `PASSED` (credit: 2500, cost: 6000, dueNow: 3500)

### Case 3: Downgrade from Business to Team (30-day period, 5 days used)
- **Input**:
  - `periodStart`: `2026-06-01T00:00:00Z`, `periodEnd`: `2026-07-01T00:00:00Z` (30 days)
  - `changedAt`: `2026-06-06T00:00:00Z` (25 days remaining)
  - `fromPlan`: `'BUSINESS'`, `toPlan`: `'TEAM'`
- **Rule**: Per PRD Section 8, downgrades take effect at period end with no immediate refund or mid-period credit.
- **Result**: `PASSED` (`dueNowCents: 0`, `isDowngrade: true`, `refundCents: 0`)

### Case 4: Adding 3 Extra Seats to Team Plan Mid-Period (10 of 30 days remaining)
- **Input**:
  - `periodStart`: `2026-06-01T00:00:00Z`, `periodEnd`: `2026-07-01T00:00:00Z` (30 days)
  - `changedAt`: `2026-06-21T00:00:00Z` (10 days remaining)
  - `plan`: `'TEAM'`, `activeBefore`: 15, `activeAfter`: 18, `paidSeats`: 15
- **Calculation**:
  - Old monthly (15 seats): 5,000 ¢
  - New monthly (18 seats = 15 included + 3 @ 300 ¢): 5,900 ¢
  - `unusedCreditCents`: $\lfloor 5000 \times 10 / 30 \rfloor = 1,666$
  - `remainingCostCents`: $\lfloor 5900 \times 10 / 30 \rfloor = 1,966$
  - `dueNowCents`: $1,966 - 1,666 = 300$ ($3.00)
- **Result**: `PASSED` (dueNow: 300, currentPeriodPaidSeats: 18)

### Case 5: Member Removal Mid-Period (Capacity Preserved, Zero Refund)
- **Input**:
  - `periodStart`: `2026-06-01T00:00:00Z`, `periodEnd`: `2026-07-01T00:00:00Z`
  - `changedAt`: `2026-06-16T00:00:00Z`
  - `plan`: `'TEAM'`, `activeBefore`: 15, `activeAfter`: 14, `paidSeats`: 15
- **Rule**: Capacity preserved for replacement; no mid-period refund.
- **Result**: `PASSED` (`dueNowCents: 0`, `refundCents: 0`, `unusedCreditCents: 0`, `currentPeriodPaidSeats: 15`)

### Case 6: Refilling a Prepaid Seat Within Same Period
- **Input**:
  - `periodStart`: `2026-06-01T00:00:00Z`, `periodEnd`: `2026-07-01T00:00:00Z`
  - `changedAt`: `2026-06-19T00:00:00Z`
  - `plan`: `'TEAM'`, `activeBefore`: 14, `activeAfter`: 15, `paidSeats`: 15
- **Rule**: Filling vacant paid entitlement costs 0.
- **Result**: `PASSED` (`dueNowCents: 0`, `refundCents: 0`)

### Case 7: Leap Year February Cycle (29 Days, 10 Days Used, 19 Remaining)
- **Input**:
  - `periodStart`: `2028-02-01T00:00:00Z`, `periodEnd`: `2028-03-01T00:00:00Z` (29 days)
  - `changedAt`: `2028-02-11T00:00:00Z` (19 days remaining)
  - `fromPlan`: `'STARTER'` (2,000 ¢), `toPlan`: `'TEAM'` (5,000 ¢)
- **Calculation**:
  - `unusedCreditCents`: $\lfloor 2000 \times 19 / 29 \rfloor = 1,310$
  - `remainingCostCents`: $\lfloor 5000 \times 19 / 29 \rfloor = 3,275$
  - `dueNowCents`: $3,275 - 1,310 = 1,965$ ($19.65)
- **Result**: `PASSED` (credit: 1310, cost: 3275, dueNow: 1965)

### Case 8: Non-Leap Year February Cycle (28 Days, 14 Days Used, 14 Remaining)
- **Input**:
  - `periodStart`: `2027-02-01T00:00:00Z`, `periodEnd`: `2027-03-01T00:00:00Z` (28 days)
  - `changedAt`: `2027-02-15T00:00:00Z` (14 days remaining)
  - `fromPlan`: `'STARTER'` (2,000 ¢), `toPlan`: `'TEAM'` (5,000 ¢)
- **Calculation**:
  - `unusedCreditCents`: $\lfloor 2000 \times 14 / 28 \rfloor = 1,000$
  - `remainingCostCents`: $\lfloor 5000 \times 14 / 28 \rfloor = 2,500$
  - `dueNowCents`: $2,500 - 1,000 = 1,500$ ($15.00)
- **Result**: `PASSED` (credit: 1000, cost: 2500, dueNow: 1500)

---

## 3. Additional Edge-Case Invariant Tests

In addition to the 8 primary benchmark cases, 7 boundary tests verify edge cases:
1. **31-Day May Cycle**: Starter $\to$ Business mid-cycle with 11 days remaining:
   - credit: $\lfloor 2000 \times 11 / 31 \rfloor = 709$
   - cost: $\lfloor 12000 \times 11 / 31 \rfloor = 4258$
   - dueNow: $3,549$ ¢ (`PASSED`)
2. **UTC Midnight Boundary**: Exact millisecond alignment across UTC boundaries (`PASSED`).
3. **Effective Date Before Period Start**: Properly rejected (`PASSED`).
4. **Effective Date After Period End**: Properly rejected (`PASSED`).
5. **D5 Decision: Starter Extra Seat Restriction**: Attempting to add seats beyond 5 on Starter plan is strictly rejected (`PASSED`).
6. **Due Now Zero at Period Expiration**: Last day change produces 0 charge (`PASSED`).
7. **Next Renewal Amount Calculation**: Renewal projection correctly accounts for base price plus extra seats (`PASSED`).

---

## 4. Test Verification Summary

- **Total Unit Tests Executed**: 15
- **Passed**: 15
- **Failed**: 0
- **Duration**: ~1.3 seconds
- **Status**: **100% GREEN**
