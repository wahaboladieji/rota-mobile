---
name: requirement-verification-and-evidence
description: Verify a completed Rota feature or phase, or report a success target. Load before acceptance checks and handoff; map PRD IDs to current-tree tests, retain required artifacts, and report passed, missed, untested, or blocked without invented evidence.
---

# Requirement verification and evidence

1. Read the affected PRD requirements, section 11 targets, phase exit criteria, `AGENTS.md` section 6, and the relevant rule files. List each requirement ID, accepted decision, assumption, open blocker, and required proof. Do not claim full completion with D1–D6 or E1 unresolved.
2. Inspect the actual implementation and choose the smallest meaningful verification set for changed boundaries: build/type-check/lint, PostgreSQL migrations and direct SQL, direct API isolation, device flows, queue/payment failures, cursor query plans, k6, or restore. Use real PostgreSQL for its invariants and an Android EAS development build for remote push, not Expo Go.
3. Run checks against the current tree. Retain the command, environment, date, input/seed, and actual output. For performance compare controlled workloads and keep before/after `EXPLAIN ANALYZE` and measured k6 results; never fabricate a gain or treat an untested cached target as passed.
4. Update only applicable evidence: `STATE.md`, `SECURITY.md`, README, query plans, `load-tests/` report, Android build proof, and restore/ledger replay records. Redact secrets, tokens, and sensitive payloads. Do not rerun unrelated broad suites without a concrete risk.
5. For each requirement and target report `passed`, `missed`, `untested`, or `blocked` with a path/output and explanation. List open decisions and the next independent work. End with the AGENTS.md checklist, marking every item accurately; no checked box without evidence.

A test name is not evidence it ran. A proposed assumption is not a confirmed decision.