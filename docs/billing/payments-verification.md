# Rota Payments & Settlement Verification

This document provides architectural documentation and verification evidence for Rota's payment integration, settlement engine, immutable ledger, and grace-period management per **PRD v2 Section 7, Section 8, Section 10, F6.1–F6.6**, and confirmed decisions **D1** and **D5**.

---

## 1. Gateway Architecture & Provider Adapter

- **Provider**: Flutterwave hosted checkout in **Test Mode** (Spike E1 approved for USD checkout).
- **Adapter Location**: `apps/backend/src/payments/flutterwave.ts`
- **Key Methods**:
  - `FlutterwaveAdapter.initializePayment()`: Creates a hosted payment link with server-generated transaction reference (`txRef`), exact expected amount in integer cents, and provider metadata.
  - `FlutterwaveAdapter.verifyTransaction(transactionId)`: Direct provider verification by transaction ID.
  - `FlutterwaveAdapter.verifyByTxRef(txRef)`: Fallback provider verification by transaction reference.
- **Provider Decoupling**: All payment handling occurs behind `FlutterwaveAdapter`. Domain logic and ledger persistence remain provider-independent.

---

## 2. Webhook & Callback Security

- **Webhook Endpoint**: `POST /api/webhooks/flutterwave`
- **Signature Verification**:
  - Flutterwave passes the secret hash in the `verif-hash` HTTP header.
  - The server verifies `req.headers['verif-hash'] === process.env.FLUTTERWAVE_SECRET_HASH`.
  - Unsigned or mismatched requests are immediately rejected with `401 Unauthorized`.
- **Durable Event Receipt**:
  - The webhook payload is recorded in `PaymentEventReceipt` with a unique constraint on `(provider, eventId)`.
  - Duplicate event deliveries are detected and safely acknowledged with `200 OK` without re-processing.
- **Background Queue & Outage Recovery**:
  - Verified webhook events are enqueued to Redis/BullMQ (`payment-webhook` queue) for asynchronous settlement.
  - If Redis is unavailable, the receipt remains marked `PENDING` and a database poll recovery worker processes unhandled receipts upon restoration.

---

## 3. Four-Stage Payment Lifecycle Audit Logging

To guarantee auditable state transitions, every payment records entries in the `PaymentLog` table:

1. **`USER_INITIATED`**: Recorded at the moment the Owner initiates a checkout. Includes requested plan code, target seats, amount in cents, idempotency key, and checkout URL.
2. **`PROVIDER_COLLECTED`**: Recorded when Flutterwave successfully collects the funds from the customer.
3. **`WEBHOOK_RECEIVED` / `CALLBACK_RECEIVED`**: Recorded when the verified webhook event or callback arrives and matches the pending attempt.
4. **`USER_PAID`**: Recorded in the same atomic database transaction that updates the `Subscription` and appends to the `LedgerEntry`.

---

## 4. Immutable Ledger & State Reconstruction

- **Model**: `LedgerEntry` in PostgreSQL.
- **Immutability Guarantee**:
  - Managed by a PostgreSQL trigger (`prevent_ledger_mutation`) that raises an exception on any `UPDATE` or `DELETE` attempt.
  - Ledger entries are strictly append-only.
- **Fields Recorded**:
  - `kind`: `CHARGE`, `CREDIT`, or `REFUND`.
  - `eventType`: `INITIAL_PAYMENT`, `PLAN_UPGRADE`, `PLAN_CHANGE`, or `SEAT_PURCHASE`.
  - `amountCents`, `currency`: Exact integer money.
  - `planCodeAfter`, `paidSeatsAfter`, `statusAfter`.
  - `periodStartAfter`, `periodEndAfter`, `effectiveAt`.
- **Audit Verification**:
  - Any subscription state can be reconstructed by replaying the append-only ledger entries in chronological order.

---

## 5. Idempotency & Concurrency Safety

- **Idempotency Keys**:
  - Every initiation request requires a client-generated UUID in `idempotencyKey`.
  - Repeated calls with the same key return the stored `PaymentAttempt` and `checkoutUrl` without generating duplicate provider charges or database records.
- **Atomic Settlement**:
  - `verifyAndSettlePaymentAttempt` wraps attempt status updates, payment logs, ledger entries, and subscription updates inside a single database transaction (`prismaPrimary.$transaction`).
  - Concurrent verification attempts (e.g. webhook racing with client callback or sync) are serialized; the second attempt detects `ALREADY_VERIFIED` and returns immediately.

---

## 6. Renewal, Grace Period, and Restricted State Enforcement

- **Grace Period (PRD F6.6 / AGENTS.md rule 13)**:
  - When renewal payment fails on `periodEnd`:
    - Subscription status transitions to `PAST_DUE`.
    - `graceEndAt` is set to `periodEnd + 7 days`.
    - Owner alert #1 dispatched immediately via background email job.
  - At Day 3: Alert #2 dispatched.
  - At Day 6: Alert #3 dispatched.
- **RESTRICTED Enforcement**:
  - After 7 days (`now > graceEndAt`), status transitions to `RESTRICTED`.
  - **Read Access Permitted**: Authenticated team members can still view shifts, view team info, and view members (`GET` requests allowed).
  - **Owner Billing Permitted**: Owners can access `/billing` and `/payment/initiate` to settle overdue invoices.
  - **Mutations Blocked**: All non-GET, non-billing endpoints (`POST`, `PUT`, `PATCH`, `DELETE` for shifts, swaps, and invitations) are rejected with `403 Forbidden` by `requireTeamMembership` middleware.

---

## 7. Member Removal & Push Token Cleanup

- **Endpoint**: `DELETE /api/teams/:teamId/members/:memberId`
- **Actions executed atomically**:
  1. `Membership.status` updated to `REMOVED`.
  2. All active user sessions revoked in `Session` table (`revokedAt = now()`).
  3. All device push tokens invalidated and deleted in `Device` table (`invalidatedAt = now()`, `pushToken = null`).
  4. Prepaid seat entitlement is preserved (no mid-period refund).
