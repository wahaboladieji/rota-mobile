---
trigger: always_on
---

# Git Conventions

These rules protect reviewability and recovery. A branch-name pattern or commit-message prefix is a preference, not a product invariant.

## Before changing files

- Inspect the working tree and relevant history. Preserve changes you did not make. Do not discard, overwrite, or reformat unrelated work to make a task look clean.
- Keep each change focused on one PRD requirement or a tightly related set. Make migrations, the code that uses them, and their tests reviewable together. Separate unrelated cleanup from payment, security, and schema work.
- Record a Product Lead decision for D1–D6, a provider-spike result for E1, or an approved assumption change before committing dependent behavior. Do not use a commit message as a substitute for the decision record. [PRD Section 14]

## Commits and protected content

- Commit the lockfile when dependencies change. Commit reviewed Prisma and SQL migrations in order. Never rewrite or remove a migration already applied to a shared environment; make a new corrective migration.
- Never commit `.env` values, credentials, access or refresh tokens, Flutterwave secrets, webhook secrets, database URLs, signed URLs, raw sensitive webhook payloads, or unredacted logs. Review staged files for secrets before committing. Use safe example configuration with placeholders.
- Do not force-push, rewrite shared history, delete branches containing unmerged work, or use destructive reset/clean commands without explicit authorization. Resolve conflicts while preserving both sides' intended work.

## Handoff

- In a commit or pull-request description, name the PRD requirement IDs, decision records, migration impact, tests actually run, and any blocked or untested work. Do not claim a green build or passed test from an earlier version of the tree.
- Keep generated build artifacts, local database data, and test secrets out of source control unless the PRD explicitly requires an evidence file. Retain required `STATE.md`, `SECURITY.md`, README, query-plan, and `load-tests/` evidence in their documented paths.