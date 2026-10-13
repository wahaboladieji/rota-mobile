---
trigger: glob
---

# Money and Billing Rules

These are server-side invariants from PRD v2 F6 and section 8. A working checkout screen does not excuse a wrong amount, seat count, entitlement, or ledger. Do not implement D1, D5, or a provider fallback by guessing.

## Prices and seats

- Store and calculate all money as integer cents. Never use floating-point currency. Seed exactly: Starter 2,000 cents/month with 5 included seats and no extra seat; Team 5,000 with 15 included and 300 cents per additional seat; Business 12,000 with 40 included and 200 cents per additional seat. The base covers its included seats; a Team with nine active members pays 5,000 cents. [PRD Section 8]
- Count every active membership, including Owner and Manager, as one billable seat. Count active members plus unexpired pending invitations when checking capacity, but do not bill an invitation before acceptance. Release capacity on expiry or revocation. Enforce Starter's fifth-seat boundary on the server with a team-scoped transaction or lock; exactly one concurrent request may reserve the last place. [F1.2, F6.1]
- Keep `activeMemberCount`, pending reservations, and `paidSeatEntitlement` distinct. A removed member loses access immediately; do not issue a mid-period credit or refund for removal. Reuse already-paid capacity in the same period without charging again. Apply cost reductions and downgrades at the next period. Do not choose when Team/Business extra-seat invitations reserve or charge while D5 is open. [F6.5; D5]

## Proration and renewal

- Compute proration on the server using whole UTC calendar dates and the recorded period length of 28–31 days. Treat the first period date as zero elapsed and the last as `periodDays - 1` elapsed. Floor the old-plan credit and new-plan cost separately to cents, then subtract. Preserve the required 30-day, 20-days-left example: 1,333-cent Starter credit, 3,333-cent Team cost, 2,000-cent charge. Never ask the payment provider to calculate proration. [PRD Section 8]
- Test at least eight distinct cases: upgrade, downgrade, extra seats, removal and same-period refill, first date, last date, and two changes in one period. Also test the included-seat boundary, February, UTC midnight, and a non-midnight provider callback. Do not mark billing complete without these results. [PRD Section 8]
- On failed renewal, alert the Owner at failure, day 3, and day 6. After seven days of grace, keep shift viewing and Owner billing available while blocking shift changes, invitations, and swaps. Use the server's verified subscription state, not a mobile timer, to enforce restriction. [F6.6]

## Provider, webhook, and ledger

- Start with Flutterwave **test mode** behind an adapter and record the USD checkout spike E1. Use Paystack test mode or Stripe only after the permitted fallback is available and recorded. Keep prices, proration, and ledger independent of the provider. Never use a live key in the assessment build. [F6.2; E1]
- Generate and persist an idempotency key for each payment attempt. A repeated key returns the original result. Do not mark payment successful from a redirect or client callback. Verify signature, durably save a unique webhook receipt before acknowledging it, then verify provider status, amount, currency, and reference in a worker. Atomically write the ledger and subscription transition; ignore duplicate and out-of-order events. Recover after queue failure. [F6.2–F6.4]
- Keep ledger rows append-only. Record every charge, credit, refund, correction, and zero-amount state change needed for deterministic subscription replay. Prevent application-role update/delete at the database level. Never cache active subscription, payment status, credit balances, or webhook idempotency records in Redis. [F6.4; PRD Sections 7, 10]
- Rebuild a subscription from ledger entries in a test and compare it with the materialized projection, including after an isolated PostgreSQL restore. Preserve webhook IDs and ledger rows permanently; clear raw webhook payloads after the configured 90 days. [PRD Sections 9–10]

## Open gates

- Do not decide D1's initial unpaid invitation/publishing access or D5's extra-seat invitation payment order in UI code, seed data, or a database default. Implement only the independent work until the Product Lead records those choices. Do not describe either path as complete while blocked.