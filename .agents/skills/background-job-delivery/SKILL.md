---
name: background-job-delivery
description: Add or change Rota background jobs for email, push, webhook dispatch, or slow external work. Load before defining producer and worker; sequence durable scheduling, retries, duplicate safety, failure recovery, and send-time preference checks.
---

# Background job delivery

1. Read the affected PRD requirement, section 7, `AGENTS.md`, and `security.md`. Define event producer, payload identity, recipient/team authorization, delivery deadline, external dependency, and whether the action must be durable before the triggering HTTP request succeeds.
2. Create a minimal, non-secret job payload or durable outbox reference. Commit a durable receipt/outbox record with the business change when losing the job would break correctness. Enqueue through Redis-backed workers; make recovery dispatch pending records after an enqueue outage. Keep push and email off the request path.
3. Define an idempotency identity and worker state transition so retries cannot duplicate business effects. Configure measured attempt count and exponential backoff; put exhausted jobs on a visible failed-job list. Log every attempt with request/job correlation and redacted content.
4. For push, resolve the current user-device tokens, team access, notification group, time zone, quiet hours, and time-to-shift at send time. Never send a disabled group. Only PRD F7's change, cancellation, or swap decision for a shift starting within 12 hours may bypass quiet hours; delay other eligible messages. Remove tokens rejected as invalid. Make deep links target exact resources and reauthorize on open.
5. Test successful delivery handoff, duplicate enqueue, worker retry, Redis outage and recovery, invalid token, disabled group, midnight-spanning quiet hours, time-zone transition, urgent/non-urgent boundary, and a user removed before send. Preserve actual handoff timing evidence.

For payment webhooks, use `payment-and-webhook-integration` for signature, provider verification, and ledger effects. Do not treat queue success as device delivery.
