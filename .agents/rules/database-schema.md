---
trigger: glob
---

# Database Schema Rules

Use `docs/Rota_PRD_v2.md` section 10 as the model specification and `AGENTS.md` as the build contract. Do not maintain a second copied Prisma schema in this rules file. Confirm proposed design A5 before the first migration; leave D3-dependent swap columns and constraints conditional until D3 is decided.

## PostgreSQL and migrations

- Use PostgreSQL with Prisma and reviewed SQL migrations for database rules Prisma cannot express. Never replace PostgreSQL with SQLite. Commit every migration with the code that depends on it; test applying migrations to a clean PostgreSQL database and to an existing test database. Do not edit an applied migration in place.
- Enforce `endAt > startAt`, nonnegative plan prices and seat counts, and valid request/payment values at the database boundary. Enforce unique normalized email, `(teamId, userId)` membership, token hashes, payment idempotency keys, provider event IDs, and each open-swap shift reservation. [PRD Section 10]
- Use `btree_gist` and a PostgreSQL exclusion constraint to reject overlapping published shifts for the same assignee. Exclude cancelled shifts. Test concurrent inserts and adjacent `[start, end)` boundaries. Do not rely on a preceding application read to prevent overlap. [PRD F2, Section 10]
- Prevent application-role `UPDATE` and `DELETE` on ledger rows with privileges and a protective trigger. Add corrections as new rows. Keep all plan, seat-entitlement, status, and period transitions needed for deterministic ledger replay. Test direct SQL attempts and replay after restore. [PRD F6.4, Section 10]

## Tenant and transaction invariants

- Scope every team-owned query by an authenticated active membership and team ID on the server. Check that shift assignees and swap participants belong to the same team. Never rely on the selected team in Zustand for authorization. [PRD F1.3–F1.4]
- Lock the relevant team or subscription row and recheck capacity when reserving or accepting an invitation. Count active members plus unexpired pending invitations for capacity; count active members for billing. Exactly one of two simultaneous attempts for the last seat may succeed. Do not resolve D1 or D5 in a migration or seed script. [PRD F1.2, F6.1]
- Make token redemption single-use in a transaction. Make swap state transitions, shift reassignment, and open-swap reservation cleanup atomic. Lock and recheck every involved shift and its version at approval. Do not finalize transfer/exchange persistence until D3 is recorded. [PRD F1, F3]
- Commit a unique, signature-verified webhook receipt before acknowledging success. Keep provider event IDs permanently and clear raw payloads after the configured 90 days. Atomically write each verified ledger effect and subscription projection. Recover receipts left pending by a queue outage. [PRD F6.3, Section 10]

## Read paths and evidence

- Pool PostgreSQL connections and account for all API instances and workers. Send writes, authorization, financial truth, and transaction-bound reads to primary. Send eligible feed/calendar reads to the replica only when the user's post-write marker and replay position permit it; otherwise use primary. Demonstrate lag and read-your-own-writes using the local streaming replica. [PRD Section 7]
- Use a `(teamId, createdAt DESC, id DESC)` index for the cursor activity feed. Capture the same PostgreSQL `EXPLAIN ANALYZE` query before and after adding the index against at least 10,000 records. Do not replace the timestamp-plus-ID cursor with offset pagination or fabricate a speedup. [PRD F4]
- Keep active subscription, payment status, credit balances, and webhook idempotency records out of Redis caches. Cache only approved nonfinancial reads with TTL and explicit invalidation. [PRD Section 7]
- Configure retention: activity 12 months; request/job logs and failed jobs 30 days; raw webhook payloads 90 days; ledger and webhook IDs permanently. Test a PostgreSQL restore in an isolated environment, compare ledger replay to the subscription projection, and verify webhook uniqueness survives. [PRD Sections 9–10]