---
name: seat-and-subscription-change
description: Implement or change Rota plans, invitations and seat entitlement, UTC proration, renewal, grace, or access state. Load before billing domain logic; follow capacity, paid entitlement, period, calculation, ledger, enforcement, and boundary-test steps.
---

# Seat and subscription change

1. Read PRD F6 and section 8, `AGENTS.md`, `money-and-billing.md`, and D1/D5 decision records. Identify actor, current plan and subscription state, active members, pending reservations, paid seat entitlement, and requested change. Stop the dependent branch while D1 or D5 remains open.
2. Lock the relevant team/subscription row and recheck membership, Owner authority, capacity, entitlement, and idempotency on primary. Count active plus unexpired pending invites for plan capacity and only active members for billable seats. Preserve already-paid capacity after removal.
3. Calculate money as integer cents on the server using recorded UTC calendar dates and the actual period length. Floor old credit and new cost separately before subtraction. Charge extra-seat rates only above the included count; defer downgrades and cost reductions to next period. Never delegate proration to the provider.
4. Decide the correct event path: immediate verified charge, scheduled next-period transition, member removal with immediate session/push revocation and no midperiod refund, renewal failure/grace, or restriction. Keep checkout pending until payment skill's verified effect arrives. Record each charge, credit, refund, correction, or state transition as an append-only ledger entry and update the projection atomically.
5. Rebuild the projection from ledger entries and compare. Test the prescribed 30-day example, at least eight distinct proration cases, included-seat boundaries, last-seat concurrency, removal/refill, February, UTC midnight, repeat key, and seven-day grace alerts and restrictions. Record actual outcomes.

Use `payment-and-webhook-integration` for provider effects and `postgresql-schema-change` for constraints. Do not guess provider spike E1.