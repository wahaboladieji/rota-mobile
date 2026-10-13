---
name: postgresql-schema-change
description: Change Rota Prisma models, PostgreSQL constraints, indexes, migrations, or primary/replica read paths. Load before writing a migration; plan invariants, apply on clean and existing databases, exercise direct SQL and concurrent writes, and retain schema evidence.
---

# PostgreSQL schema change

1. Read PRD section 10 and the affected F requirement, `AGENTS.md`, and `database-schema.md`. Confirm proposed Prisma design A5 before the first migration. Identify D1, D3, or D5 decisions affecting the schema; do not bake an unanswered choice into a default or seed.
2. List the invariant, existing rows, new index or constraint, necessary backfill, and dependent code. Use Prisma migrations where expressive enough and reviewed SQL for PostgreSQL-only checks, exclusion constraints, triggers, and privileges.
3. Write an additive migration if a prior one was applied. Plan existing-data and concurrent-write behavior. Keep ledger rows append-only, team relations consistent, and unique idempotency identities durable.
4. Apply on fresh PostgreSQL and an existing test database. Exercise constraints with direct SQL using the application role and API/service tests. For overlaps test simultaneous writes and adjacent half-open intervals; for seats, tokens, swaps, and payment events test competing attempts.
5. When reads change, verify team scoping and primary/replica routing. Demonstrate read-your-own-writes under lag for affected routes. For feed index work, seed at least 10,000 events and preserve the same representative `EXPLAIN ANALYZE` query before and after.
6. Record migration order and actual tests, plans, or restore evidence as applicable. Commit code and tests depending on the schema together. Never claim a restore, replay, or lag test passed unless run.

Use seat/subscription or payment skill when financial writes change. A schema constraint does not replace server authorization.