---
trigger: always_on
---

# Coding Standards

Applies to the Rota repository. Read `AGENTS.md` and `docs/Rota_PRD_v2.md` first. The PRD defines product behavior; this file governs implementation. A rule here does not resolve an open product decision.

## Language and toolchain

- Write the React Native app, Express API, and shared contracts in TypeScript with strict type checking. Use a compatible active Node.js LTS release. Pin tool and dependency versions and commit the lockfile. Do not substitute a web app for React Native or switch the locked stack.
- Run formatting, linting, type checking, and the affected package builds before calling a change done. Fix errors; do not suppress checks merely to obtain a green run.
- Do not use `any` to bypass a boundary, cast untrusted input to a trusted domain type, or hide an error with an empty `catch`. Narrow unknown values explicitly.

## Boundaries

- Keep Express routes limited to authentication, Zod parsing, domain-service calls, and HTTP responses. Put authorization, shift, swap, seat, proration, subscription, and notification rules in API domain services. Keep Prisma and SQL in data modules. Keep provider-specific requests behind the payment adapter.
- Treat the server as authority for roles, team scope, payments, subscriptions, and settings. Do not copy a pricing formula or permission decision into the mobile app as the source of truth. The app may display server-calculated values.
- Keep TanStack Query responsible for server data and Zustand responsible for shared UI-only state. Keep tokens in `expo-secure-store`; persist only the approved offline shift snapshot through the TanStack Query persister and AsyncStorage. [PRD F5]
- Put email, push, webhook processing, and slow third-party work in recoverable background jobs. Never make an HTTP response depend on a push or email send completing. [PRD Section 7]

## Correctness and tests

- Use a pure, deterministic server function for each money or UTC-calendar calculation. Inject a clock into code that depends on period boundaries, token expiry, grace periods, or quiet hours. Test the PRD's exact examples and boundary dates. [PRD F6, F7, Section 8]
- Validate every server request body with Zod before it reaches a domain service. Return explicit, safe errors; never expose secrets or another team's resource details in an error. [PRD Section 7]
- Add tests in the same change as a new invariant or changed behavior. Include direct API and concurrency tests for role bypass, team isolation, last-seat reservations, overlapping shifts, duplicate swaps, and payment idempotency when those paths change.
- Do not claim a test, load target, Android remote-push flow, migration, or replica behavior passed without running it and keeping the evidence. Report `missed`, `untested`, or `blocked` when appropriate. [PRD Sections 7, 11]

## Scope discipline

- Follow the PRD's phase order. Continue independent foundation work while D1–D6 or E1 are open, but do not implement the dependent behavior by guessing. Record an approved decision before changing the affected code. [PRD Sections 13–14]
- Do not add AI, time-off, payroll, timesheets, store publishing, or sector-specific workflows. Do not refactor unrelated areas or add a dependency as a side effect of a small task.
- Keep modules focused and names descriptive. Use the repository formatter for style. Do not impose arbitrary file-length, naming-prefix, or abstraction quotas as failure rules; correctness and clear ownership are the gates.