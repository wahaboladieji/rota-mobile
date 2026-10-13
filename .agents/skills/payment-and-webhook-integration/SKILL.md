---
name: payment-and-webhook-integration
description: Change Rota checkout, payment attempts, the provider adapter, webhook receipt, verification worker, or payment recovery. Load before touching provider or webhook code; perform idempotent initiation, signature verification, durable receipt, provider recheck, atomic ledger effect, and outage tests.
---

# Payment and webhook integration

1. Read PRD F6.2–F6.4, section 7, `AGENTS.md`, `money-and-billing.md`, and `security.md`. Check E1's recorded USD test result and actual selected test provider. Use Flutterwave test mode first; change provider only after the permitted fallback is recorded. Consult the chosen provider's current official webhook/checkout documentation before implementing version-specific fields or signatures.
2. Have the server calculate expected amount/currency and create a persistent payment attempt with an idempotency key and internal reference. Return the stored outcome for repeated keys. Send provider-specific operations through the adapter. Show pending in the app; never grant access from redirect or client callback.
3. On callback, verify the signature against the raw request as the chosen provider specifies. Before successful HTTP acknowledgment, commit a unique webhook event receipt; reject invalid signatures and make duplicate event IDs harmless. Keep a recovery path for receipts left unqueued when Redis or the worker is unavailable.
4. In a worker, verify the provider transaction's status, amount, currency, and internal reference against the expected attempt. Lock and check attempt/subscription state; in one transaction append the correct ledger effect and update the subscription projection. Do not regress a final state on late events. Queue retryable failures with backoff and retain terminal failures for inspection.
5. Test repeated initiation keys, forged and duplicate webhooks, out-of-order events, mismatched status/amount/currency/reference, failure before receipt, outage after receipt, worker retry, and ledger transaction failure. Trace request/reference/event/ledger IDs in redacted logs and verify ledger replay.

Use the seat/subscription skill for amount and entitlement rules. Keep live keys and provider secrets out of the app and source.