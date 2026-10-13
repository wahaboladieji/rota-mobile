# AGENTS.md

## 1. What is this project?

Build **Rota**, an Android-first shift scheduling app for small restaurant, clinic, and retail teams. Owners manage teams and subscriptions, Managers manage shifts and approvals, and Staff view schedules and request swaps. The current target is the assessment build described in **Rota Product Requirements Document v2** (`docs/Rota_PRD_v2.md` in the recommended layout below), not an app store release.

Use the PRD as the source of truth for **what** to build, product decisions, prices, acceptance criteria, and phase scope. Use this file for **how** to work. Read both before changing code. If the PRD is missing from the repository, obtain it before feature work. Preserve the PRD's distinction between `REQUIRED`, `CONFIRMED`, `ASSUMPTION ADDED`, and `OPEN QUESTION`. A later explicit user decision takes precedence; record it in the PRD before implementing the affected behavior. Never treat an assumption or an open question as approval.

Work in the PRD's phase order. Independent foundation work may proceed while product questions remain open. Do not claim the full product is complete while D1–D6 or the Flutterwave USD spike E1 remain unresolved.

## 2. What is locked?

Do not substitute a different stack to make a feature easier. Use:

- **Mobile:** React Native with Expo, built in Antigravity. Produce an Android EAS development build for remote push testing. Do not use Expo Go as evidence that remote push works. Do not add a web frontend in place of the mobile app.
- **API:** A backend we control, written in Node.js with Express. Put authentication, authorization, business rules, payments, and notification decisions on this server.
- **Database:** PostgreSQL. Use the PRD v2 Prisma schema as the starting model and apply PostgreSQL SQL migrations for invariants Prisma cannot express. Use pooled connections. Configure separate primary and streaming-replica connections; demonstrate lag and read-your-own-writes locally. Never replace PostgreSQL with SQLite.
- **State and lists:** TanStack Query for all server data; Zustand for shared client-only UI state; FlashList for the infinite activity feed. Use the TanStack Query persister with AsyncStorage only for the permitted offline shift snapshot. Store tokens only in `expo-secure-store`.
- **Infrastructure:** Redis for cache-aside data, distributed rate limits, locks, and a Redis-backed background job queue. BullMQ is the PRD's named queue option; use it unless a recorded decision selects an equivalent. Run slow or unreliable work in jobs.
- **Validation and verification:** Zod for every server request body; Sentry on app and server; k6 for load tests; `EXPLAIN ANALYZE` for the PostgreSQL cursor query before and after its index.
- **Payment:** Start with Flutterwave checkout in **test mode** behind a provider adapter. Run and record the one-day USD test-account spike (E1) before integrating checkout. Change to Paystack test mode or Stripe only if the spike fails, the alternative is available, and the decision is recorded. Keep the ledger and proration provider-independent. Never use a live payment key or claim that the provider fallback is already approved.

Keep prices, roles, membership rules, subscription states, UTC-day proration, settings, retention periods, and the PRD's required SQL constraints aligned with the PRD. Do not redesign the data model or replace a chosen service silently. Check the current compatibility of Node.js LTS, Expo, Prisma, and dependencies before pinning versions; commit the chosen versions and lockfile.

## 3. What must never happen?

**Breaking any rule in this section means the task failed, even if the app runs and the screen looks correct.** The references point to PRD v2 requirements and sections.

### Access, identity, and team data

1. Enforce roles and team membership on every server operation. Never authorize from a client-supplied role, selected-team state, hidden button, or guessed resource ID. Scope every team-owned query to the authenticated membership. Reject Staff attempts to mutate shifts and cross-team reads or writes. Test both direct API attacks. [F1.3–F1.4]
2. Store the role on `(user, team)` membership, not on `User`. Preserve separate roles across teams. Count every active member as one seat regardless of role. [Sections 1, 4; F1, F6]
3. Do not allow initial paid access based on a checkout redirect or a client callback. Keep `pending_initial_payment` separate from `active`, `grace`, and `restricted`. Do not choose the prepayment invite/publish policy while D1 is open. [Section 1; F6; D1]
4. Make invitation tokens, magic links, and password reset tokens single-use and expiring. Keep their purposes distinct. Consume them on the server. Recheck invitation capacity atomically; when two requests race for the last place, exactly one may succeed. Release a reservation when its invitation expires or is revoked. [F1.1–F1.2, F6.1]
5. Keep access tokens short-lived; rotate refresh tokens on use and reject reuse. Invalidate sessions for all-device logout. Put mobile tokens in `expo-secure-store`, never AsyncStorage or logs. Never put secrets in `EXPO_PUBLIC_` variables or the app bundle. [F1.5; Section 7]
6. On member removal, revoke that user's sessions and push tokens immediately. Preserve their other team memberships; require reauthentication and device re-registration for those teams. [F6.5]

### Money, seats, and payment truth

7. Store every amount as whole cents. Never use floating-point money. Seed the exact plan prices: Starter 2,000 cents with 5 included and no extra seat; Team 5,000 with 15 included and 300 per extra seat; Business 12,000 with 40 included and 200 per extra seat. Charge an extra-seat price only above the included count. [Section 8]
8. Enforce seat limits and paid entitlement on the server inside concurrency-safe transactions. Count active members plus unexpired pending invitations for capacity; bill only active members. Reject the sixth Starter invitation when five places are active or reserved. Do not invent D5's above-included-seat invitation/payment order. [F1.2, F6.1; D5]
9. Calculate proration on the server by UTC calendar dates for the recorded billing period. Floor the old-plan credit and new-plan cost **separately** to cents before subtracting. Preserve the required 30-day example's 1,333-cent credit, 3,333-cent cost, and 2,000-cent charge. Do not let a provider calculate proration. Do not apply a downgrade or cost reduction before the next period. [F6.5; Section 8]
10. Revoke a removed member's access immediately, but do not issue a mid-period refund or credit for that removal. Preserve already-paid capacity for a same-period replacement; charge only when active members exceed paid seats. Keep active count, reserved places, and paid entitlement distinct. [F6.5; Section 8]
11. Use an idempotency key for every payment attempt. Return the stored outcome for a repeat key. Never accept a checkout return, app callback, or unverified webhook as proof of payment. Verify webhook signature, then durably commit a unique receipt before acknowledging success; recover it after queue failure. Have a worker verify provider status, amount, currency, and reference before atomically changing ledger and subscription state. Ignore duplicate event IDs and do not regress a final state on out-of-order delivery. [F6.2–F6.4; Section 7]
12. Never update or delete ledger rows. Record corrections as new rows and preserve charge, credit, refund, and state-change history needed to rebuild the subscription. Do not cache active subscription, payment status, credit balances, or webhook idempotency records in Redis. Test ledger replay and restoration. [F6.4; Sections 7, 10]
13. Enforce the seven-day renewal grace period and Owner alerts on failure, day 3, and day 6. After the period ends, allow shift reading and Owner billing access but block shift mutations, invitations, and swaps. Test the UTC boundary. [F6.6; Section 8]

### Shifts, state, and notifications

14. Reject overlapping published shifts for one person and shifts beyond the eight-week horizon on the server. Apply the PostgreSQL exclusion constraint and test simultaneous writes and adjacent boundaries. Do not decide whether availability is advisory or blocking while D4 is open. [F2; Section 10; D4]
15. Do not implement a final swap assignment until D3 selects transfer or exchange. Require colleague acceptance before Manager approval. Prevent duplicate open requests, cancel a pending request when an involved shift changes or is deleted, and recheck versions and assignments in one transaction at approval. Do not silently permit self-approval or invent D2's small-team fallback. [F3; D2–D3]
16. Use timestamp **and** ID in the server activity-feed cursor, with team scope and the matching index. Never switch to offset pagination. Prevent duplicate page requests and duplicate rendered items. Keep loading, empty, end, error, refresh, and rapid-scroll behavior testable with at least 10,000 seeded events. [F4]
17. Keep server data in TanStack Query and UI-only state in Zustand. Implement optimistic swap and settings changes with rollback and duplicate-submit protection. Persist only the next 14 days of upcoming shifts for offline reading, keyed by account and team, with a visible last-updated time. Never store tokens in that snapshot or pretend offline mutations succeeded. Clear snapshots on logout or departure and when revoked access is learned. [F5]
18. Store quiet hours, time zone, notification groups, language, and theme on the server. Set each setting's `updatedAt` on the server and apply the documented latest-accepted-change rule. Refetch on launch/foreground. Have notification jobs check the current group preference, quiet hours, and user's time zone before sending. A disabled group always wins, even for a shift starting within 12 hours. Changes, cancellations, and swap decisions for a shift starting within 12 hours may bypass quiet hours; delay new shifts, swap requests, billing alerts, and other non-urgent messages until quiet hours end. Remove invalid device tokens; authorize the target again when a push deep link opens. [F7]

### Evidence and privacy

19. Validate every server request body with Zod. Apply Redis-based per-user and per-IP limits, with strict limits for login, password reset, invitations, payment initiation, and expensive routes. Log requests and jobs with correlation IDs, but redact tokens, secrets, and sensitive payment details. [F1; Section 7]
20. Keep every `EXPO_PUBLIC_` value safe to disclose and explain it in the README. Write `SECURITY.md` with eight app-specific threats and mitigations, and `STATE.md` with data ownership and cache decisions. Configure retention for activity events at 12 months, request/job logs and failed jobs at 30 days, raw webhook payloads at 90 days, and webhook IDs and ledger rows permanently. Overwrite offline shift snapshots on refresh and clear them on logout or team departure. Never hard-code retention as an unchangeable constant. [Sections 7, 10]
21. Never report a target, migration, replica test, push test, backup restore, or load test as passed without its evidence. Report `passed`, `missed`, `untested`, or `blocked` honestly. A cached-feed target is untested if no correct cache strategy exists. [Sections 7, 11, 13]

## 4. How is the work arranged?

Use this repository layout. Keep each module responsible for one boundary; do not place payment rules in screens or SQL in UI components.

```text
/
  AGENTS.md
  docs/
    Rota_PRD_v2.md
    STATE.md
    SECURITY.md
    decisions/              # dated decisions for D1–D6, E1, and changed assumptions
  apps/
    mobile/
      src/
        app/                 # navigation and deep-link entry points
        features/            # auth, teams, shifts, swaps, feed, billing, settings
        state/               # Zustand UI state and TanStack Query setup
        offline/             # account/team-scoped shift persistence
        components/          # shared presentation only
    api/
      src/
        routes/              # Express HTTP adapters and Zod parsing
        auth/                # sessions, tokens, membership guards
        domain/              # scheduling, swaps, seats, billing, notifications
        data/                # Prisma, primary/replica routing, transactions
        payments/            # provider adapter and verification
        jobs/                # outbox dispatcher, workers, retries
        observability/       # logging, request IDs, Sentry
      prisma/
        schema.prisma
        migrations/          # Prisma and reviewed SQL migrations
      tests/                 # unit, API, concurrency, and integration tests
  packages/
    shared/                  # shared types/contracts, not server secrets
  infra/
    postgres/                # local primary and delayed streaming replica
    redis/
  load-tests/               # k6 scripts and measured report
```

Implement in PRD phase order. Phase 0 records decisions and the Flutterwave USD spike, but it does not block unrelated Phase 1 work. Confirm the PRD's proposed Prisma design (A5) before the first migration. Finish a phase's specified tests and evidence before calling that phase done. Build foundation and auth first; then scheduling, feed, state, and offline behavior; then billing and notifications; then integrated verification. Keep D1–D6-dependent paths blocked until their decisions are recorded. Add tests alongside each boundary, not only at final handoff.

Keep provider-specific code behind the payment adapter. Keep Prisma and raw SQL migrations under the API. Put all authorization, proration, seat changes, webhook processing, and notification timing in server domain services. Use jobs for email, push, webhook processing, and slow external calls. Route financial, authorization, transaction-bound, and immediate post-write reads to primary; route eligible feed/calendar reads to replica only after the user's write has replayed. Cache only suitable nonfinancial reads with explicit TTL and invalidation.

## 5. How should the code look?

- Use TypeScript with strict type checking in mobile, API, and shared packages. Use an active Node.js LTS version compatible with the pinned Expo and Prisma releases. Pin tool versions and commit the lockfile; do not upgrade the stack as an unrelated cleanup.
- Write small, named modules with clear inputs and outputs. Keep routes thin, business rules in domain services, persistence in data modules, and display logic in components. Avoid `any`, hidden global state, duplicated pricing formulas, and catch blocks that swallow errors.
- Use descriptive names and straightforward control flow. Prefer pure functions for money and date calculations. Centralize plan prices and business invariants; do not copy them into the mobile app as authority.
- Validate at boundaries, use explicit error types, and return safe user-facing errors. Keep secrets out of source, logs, test snapshots, and mobile configuration.
- Make database changes through reviewed migrations. Test constraints with real PostgreSQL, including concurrent attempts. Keep test fixtures deterministic and clocks injectable for UTC proration, grace, quiet hours, and token expiry.
- Format and lint consistently with repository configuration. Add only dependencies needed by an approved requirement. Do not add AI features, time-off, payroll, timesheets, app-store publishing, or sector-specific workflows on your own.

## 6. What counts as done?

Do not mark a task complete because the UI appears to work. Build and type-check the affected packages with **zero errors**, run lint and relevant tests, and verify migrations on PostgreSQL. For a completed phase, produce the PRD's named evidence. An Android EAS development build must exercise remote push; Expo Go is insufficient. Keep measured k6 results and before/after `EXPLAIN ANALYZE` output rather than invented numbers.

End **every** work report with a checklist containing:

```text
- [ ] Every PRD requirement ID met in this task or phase, with file paths and behavior
- [ ] Business and security rules checked, including direct API and concurrency cases
- [ ] Build, type-check, lint, migration, and relevant test results (commands and outcomes)
- [ ] Required evidence updated: STATE.md, SECURITY.md, README, query plans, load-tests, build as applicable
- [ ] Assumptions made or changed, with their PRD label and decision record
- [ ] D1–D6 and E1 status; affected work marked blocked when unresolved
- [ ] Remaining risks and next phase
```

Mark each item `done`, `not applicable`, `missed`, `untested`, or `blocked`, with evidence. Do not use a checked box for work that did not run. Full product sign-off requires the PRD's acceptance tests, build, documentation, recovery exercise, and recorded outcomes for D1–D6 and E1. Phase completion requires only that phase's unblocked scope and evidence.

## 7. What do you do when unsure?

Read the relevant PRD section and decision record first. If the answer is still missing, state the exact question, the affected requirement ID, and the smallest decision needed. Stop only the dependent implementation and continue independent approved work. In particular, do not choose D1 prepayment access, D2 small-team swap approval, D3 transfer versus exchange, D4 availability enforcement, D5 extra-seat invite timing, D6 second language, or E1 payment fallback for the Product Lead.

Never add a feature, change the locked stack, weaken a business invariant, or invent scope to fill a gap. Never hide uncertainty in a large conditional, duplicated workaround, placeholder success path, or spaghetti code. Make a small reversible change only when it preserves the PRD's rules; label any new assumption **ASSUMPTION ADDED**, record it, and seek the decision before dependent behavior is treated as complete. If the PRD and this file conflict, keep the PRD's product rule and report the conflict before editing the affected code.
