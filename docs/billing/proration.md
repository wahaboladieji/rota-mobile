# Rota Billing & Proration Specification

This document defines the server-side billing, proration arithmetic, and subscription lifecycle rules for Rota, conforming to **PRD v2 Section 8, Section 10, F6.1–F6.6**, and confirmed decisions **D1** and **D5**.

---

## 1. Locked Plan Pricing & Seat Invariants

All monetary amounts are strictly managed and stored as integer cents (USD) to avoid floating-point rounding errors.

| Plan | Base Price (Cents) | Base Price (USD) | Included Seats | Extra Seat Price (Cents) | Extra Seat Price (USD) | Maximum Allowed Seats |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Starter** | 2,000 ¢ | $20.00 / mo | 5 seats | None ($0) | N/A | Exactly 5 seats (strict cap) |
| **Team** | 5,000 ¢ | $50.00 / mo | 15 seats | 300 ¢ | $3.00 / seat / mo | Unlimited |
| **Business** | 12,000 ¢ | $120.00 / mo | 40 seats | 200 ¢ | $2.00 / seat / mo | Unlimited |

### Invariants:
1. **D5 Decision Enforcement**:
   - The **Starter** plan has a strict cap of 5 seats. No additional seats may be purchased. Invitations beyond 5 are rejected with `409 Conflict`.
   - The **Team** and **Business** plans allow purchasing extra seat capacity at their respective rates.
   - Extra seat entitlement must be purchased prior to sending invitations exceeding included seats.
2. **Included Seat Protection**: Extra-seat rates apply strictly to active or reserved seats *above* the plan's included seat threshold.
3. **Integer Arithmetic**: Floating-point money arithmetic is strictly forbidden. Calculations utilize BigInt integer math.

---

## 2. UTC Calendar Date & Billing Period Calculations

Proration calculations are strictly evaluated against UTC midnight boundaries:

```typescript
const MS_PER_DAY = 86_400_000; // 24 * 60 * 60 * 1000

// Period length in full UTC days
const periodDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / MS_PER_DAY);

// Remaining days from effective date to period end
const remainingDays = Math.round((periodEnd.getTime() - effectiveDate.getTime()) / MS_PER_DAY);
```

- If `effectiveDate < periodStart` or `effectiveDate > periodEnd`, calculation is rejected.
- When `remainingDays === 0`, `dueNowCents = 0`.
- The billing period anchor (`[periodStart, periodEnd]`) is never reset during mid-period upgrades or seat changes.

---

## 3. Mandatory Separate Floor Rounding Formula

To prevent fractional-cent accumulation and maintain ledger parity, unused credit from the current plan and remaining cost of the new plan must be **floored separately to whole cents** before calculating the net amount due:

$$\text{unusedCreditCents} = \left\lfloor \frac{\text{oldMonthlyCents} \times \text{remainingDays}}{\text{periodDays}} \right\rfloor$$

$$\text{remainingCostCents} = \left\lfloor \frac{\text{newMonthlyCents} \times \text{remainingDays}}{\text{periodDays}} \right\rfloor$$

$$\text{dueNowCents} = \max(0, \text{remainingCostCents} - \text{unusedCreditCents})$$

### Why Separate Floor Rounding?
Calculating a combined net daily rate or calculating the difference before flooring introduces fractional discrepancies that diverge from provider settlement records and cause audit failures. Separate integer division floors guarantee that both credit and cost remain exact whole cents.

---

## 4. Plan Upgrades & Downgrades

### Upgrades (Mid-Period)
- When changing to a higher-priced plan or adding extra seats:
  - Prorated `dueNowCents` is calculated and charged immediately via the payment gateway.
  - The subscription's `paidSeatEntitlement` and `planCode` are updated immediately upon payment settlement.
  - The billing period anchor `periodEnd` is **preserved**.

### Downgrades & Reductions
- Per PRD Section 8 and AGENTS.md rule 9:
  - Downgrades and seat reductions **never** generate an immediate cash refund or mid-period credit.
  - Instead, the change is scheduled to take effect at the end of the current billing cycle (`periodEnd`).
  - The subscription record stores `pendingPlanCode`. When the renewal worker runs at `periodEnd`, the subscription transitions to the lower tier.

---

## 5. Seat Adjustments & Member Removal

### Member Removal (PRD F6.5 / Section 8)
- When a member is removed from a team:
  - Their membership status is set to `REMOVED`.
  - Their sessions on the server are revoked immediately.
  - Their push device tokens are invalidated and cleared immediately.
  - **No mid-period refund or credit is issued**.
  - Prepaid seat capacity (`paidSeatEntitlement`) is preserved for the remainder of the billing period.

### Refilling a Seat
- Refilling an already-paid vacant place within the same billing period costs **$0.00 (0 ¢)**.

### Purchasing Additional Seats
- Extra seat capacity charges a prorated fee for the remaining days of the current period only if `targetSeats > paidSeatEntitlement`.

---

## 6. Worked Benchmark Test Cases

| Case | Scenario | Cycle (Days) | Remaining | Old Plan (¢) | New Plan (¢) | Unused Credit (¢) | Remaining Cost (¢) | Due Now (¢) | Action / Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Case 1** | Starter $\to$ Team | 30 | 20 | 2,000 | 5,000 | $\lfloor 2000 \times 20 / 30 \rfloor = 1,333$ | $\lfloor 5000 \times 20 / 30 \rfloor = 3,333$ | 2,000 ($20.00) | Immediate upgrade charge |
| **Case 2** | Team $\to$ Business | 30 | 15 | 5,000 | 12,000 | $\lfloor 5000 \times 15 / 30 \rfloor = 2,500$ | $\lfloor 12000 \times 15 / 30 \rfloor = 6,000$ | 3,500 ($35.00) | Immediate upgrade charge |
| **Case 3** | Business $\to$ Team | 30 | 25 | 12,000 | 5,000 | N/A | N/A | 0 ($0.00) | Downgrade scheduled at period end |
| **Case 4** | Team: 15 $\to$ 18 seats | 30 | 10 | 5,000 | 5,900 | $\lfloor 5000 \times 10 / 30 \rfloor = 1,666$ | $\lfloor 5900 \times 10 / 30 \rfloor = 1,966$ | 300 ($3.00) | 3 extra seats prorated for 10 days |
| **Case 5** | Team: Member Removed | 30 | 15 | 5,000 | 5,000 | 0 | 0 | 0 ($0.00) | Capacity preserved; refund = 0 |
| **Case 6** | Team: Refill Seat | 30 | 12 | 5,000 | 5,000 | 0 | 0 | 0 ($0.00) | Free refill of prepaid place |
| **Case 7** | Starter $\to$ Team (Leap Feb) | 29 | 19 | 2,000 | 5,000 | $\lfloor 2000 \times 19 / 29 \rfloor = 1,310$ | $\lfloor 5000 \times 19 / 29 \rfloor = 3,275$ | 1,965 ($19.65) | 29-day leap year cycle |
| **Case 8** | Starter $\to$ Team (Non-Leap Feb) | 28 | 14 | 2,000 | 5,000 | $\lfloor 2000 \times 14 / 28 \rfloor = 1,000$ | $\lfloor 5000 \times 14 / 28 \rfloor = 2,500$ | 1,500 ($15.00) | 28-day standard Feb cycle |
