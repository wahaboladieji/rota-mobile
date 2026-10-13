# Rota Product Requirements Document v2

Status: Ready for foundation work; feature decisions pending  
Date: 7 October 2026  
Source: *Mobile Task A: Rota*, *Technical Requirements*, subsequent user decisions, and the section-by-section PRD review. This is a new version; the prior PRD is preserved.

**Reading rule:** A **REQUIRED** item comes from the supplied documents. A **CONFIRMED** item comes from the user's later selection. **ASSUMPTION ADDED** identifies a proposal needed to make a testable design. **OPEN QUESTION** identifies a decision the documents and user have not resolved. **CONFIRMED:** The user's latest decision is PostgreSQL for the product backend, restoring the database specified by the technical requirements and superseding the earlier SQLite direction.

## 1. Product summary

Rota is a React Native mobile app for shift scheduling in small restaurant, clinic, and retail teams. An Owner creates a team, invites members, publishes shifts, and pays a monthly seat-based subscription. A Manager creates and changes shifts and approves swaps. Staff view shifts, request swaps, set preferences, and receive notifications. Upcoming shifts remain readable offline.

The assessment deliverable is an Android Expo development build and a controlled Node.js/Express backend with PostgreSQL, Redis, jobs, and Flutterwave test-mode checkout, subject to a one-day USD checkout spike. It must demonstrate the prescribed pagination, state, authentication, security, payments, push, settings, and backend system design requirements. It is not an app store release. **ASSUMPTION ADDED:** A single general workflow serves all three named sectors for this assessment; no sector-specific rules are added.

An Owner may create a team and prepare checkout before the first payment. The backend represents `pending_initial_payment`, `active`, `grace`, and `restricted` separately. **OPEN QUESTION (D1, blocking onboarding entitlement):** May the Owner invite members or publish shifts before the first verified payment? The server never activates paid access from a checkout return URL; it waits for a verified provider event. The unanswered access rule is a blocker for those two prepayment actions, not for foundation work.

| Actor | Required capability | Server boundary |
| --- | --- | --- |
| Owner | Create team; invite staff; full shift and team control; manage plan and billing | Membership, team scope, seats, and payments checked on every action |
| Manager | Create and edit shifts; approve swaps | May act only within the authorized team; billing is Owner-only |
| Staff | View shifts; request swaps; set personal preferences | Cannot mutate shifts directly or approve swaps |

**CONFIRMED:** Role belongs to a membership, not a user. One user may join several teams with different roles; show the team switcher only for users with more than one team. Every active member counts as one billable seat regardless of role. A pending invitation reserves capacity without being billed.

## 2. Problem statement

Small teams need a reliable way to publish work schedules and handle changes. A staff member needs an up-to-date view of upcoming shifts, including when offline. A manager needs a controlled swap approval process. An owner needs accurate seat limits, fair mid-period charges, and dependable renewal handling. Feed movement, stale settings across devices, delayed payment events, and direct API calls can otherwise produce missed updates, unwanted notifications, incorrect access, or incorrect billing.

The standard paid journey is: Owner creates team and starts checkout → server verifies payment → Owner invites people → Manager publishes shifts → Staff sees shifts and feed → Staff requests a swap with a colleague → colleague accepts or rejects → only an accepted request goes to Manager approval or rejection → both affected people see the final assignment and permitted notifications. D1 decides whether invitation or publishing can also happen before payment. A colleague rejection ends the request without Manager review. Billing, authorization, and notification preferences are decided by the server, not by the phone.

## 3. Goals and non-goals

### Goals

1. Let an Owner create a team, invite members, manage billing, and enforce seats on the server.
2. Let Managers publish and edit shifts and approve swap requests; let Staff view shifts, request swaps, and manage preferences.
3. Provide an activity feed that remains correct as new records arrive and is demonstrably usable with at least 10,000 seeded records.
4. Keep upcoming shifts available offline with a visible last-updated time; synchronize server-owned data and settings across devices.
5. Demonstrate secure sessions, team isolation, verified and idempotent payments, reliable background work, and observable failures.
6. Produce the required evidence: tests, before-and-after query plans, `STATE.md`, `SECURITY.md`, README billing discussion, `load-tests/` scripts and report, and an Android development build.
7. In the pilot, teams use Rota to publish schedules and complete shift changes without relying on an outside approval channel. Section 11 defines proposed measures; it does not claim pilot results.

### Non-goals

- Publishing to Apple App Store or Google Play for this assessment. Production policy still needs a documented review.
- Implementing sharding now. The requirement is to understand and document a shard key, hot-shard risk, and trade-offs.
- An AI feature or AI pipeline. Neither source requires one.
- **CONFIRMED:** Time off is out of scope; weekly availability windows cover shift preferences. **ASSUMPTION ADDED:** Payroll, timesheets, and sector-specific labor rules are outside the first release because no workflow was supplied.

## 4. User personas

These are role-based working personas, not claims from user research.

| Persona | Main job | Critical need | Failure to avoid |
| --- | --- | --- | --- |
| Owner of a small team | Set up staffing and pay for access | Invite within the plan, see billing truth, handle renewals | A sixth Starter seat or unpaid access slipping through |
| Manager | Publish coverage and settle swap requests | Clear current schedule and pending approvals | Approving a stale or unauthorized request |
| Staff member | Know when to work and request a change | Fast shift view, offline access, clear swap status | Missing a shift or submitting the same swap twice |

**CONFIRMED:** Owners and Managers can be assigned shifts. Their role is scoped to membership in each team. The same shift-owner swap flow applies to a member who works a shift, while a Manager still approves; the authorization tests must cover approval of one's own request. **ASSUMPTION ADDED:** Self-approval is prohibited to preserve two independent decisions.

**OPEN QUESTION (D2, blocking Owner/Manager swap completion):** Who approves an Owner's or Manager's swap when the team has no other authorized Manager? Until decided, the app must not promise that every working Owner or Manager can complete a swap. Test a team with one Owner and no separate Manager. Do not silently allow self-approval.

## 5. Functional requirements

Each requirement below is mandatory unless marked **ASSUMPTION ADDED**. IDs provide a stable link to acceptance checks.

### F1. Accounts, invitations, and teams

- F1.1 Support email/password sign-up, login, and logout, plus **CONFIRMED: magic-link sign-in**. Send a single-use, expiring email link from a background job; consume it on the server and open the app by deep link. Keep password reset and invite tokens distinct so one type cannot be redeemed as another. **ASSUMPTION ADDED:** Set token lifetimes in configuration; their exact durations remain an implementation decision.
- F1.2 An Owner can create a team and invite by email or shareable link once D1 permits it. The invitation opens the installed app by deep link, or leads to installation/sign-up and then lands the accepted member in the intended team. Invitations are single-use and expiring. Pending invites reserve a plan seat for limit checks but are not billable until accepted. Expired or revoked invites release the reservation. Create/reserve and acceptance each use a team-scoped transaction or lock and recheck current capacity.
- F1.3 The server authenticates each request and checks team membership and role against the target resource. Owner has full control; Manager creates/edits shifts and approves swaps; Staff reads permitted shifts, requests swaps, and manages own preferences. Billing remains Owner-only. A Staff request to delete a shift endpoint is rejected in an automated test.
- F1.4 Every team-owned PostgreSQL query filters by authorized team ID on the server. An automated cross-team test proves that guessed IDs cannot reveal or change another team's data. The selected team in Zustand is a UI hint, never an authorization grant.
- F1.5 Password reset tokens expire and are consumed once. Access tokens are short-lived. Refresh tokens rotate on use; reuse of an old refresh token is rejected as a compromise signal. “Log out of all devices” invalidates all sessions. Tokens on device use `expo-secure-store`, never AsyncStorage.

**Acceptance:** An invite accepted after sign-up opens the correct team; users with several memberships can switch teams without changing their role in another; unauthorized roles get a forbidden response; cross-team reads and writes fail; old refresh, magic-link, and reset tokens cannot be replayed. The sixth Starter invitation is rejected when five active or reserved seats already exist. When two requests concurrently try to reserve the last place, exactly one succeeds. Repeated acceptance cannot create two memberships or billable seats.

### F2. Calendar, shifts, and preferences

- F2.1 A Manager can create, edit, and publish a shift for the team. Staff can view their assigned upcoming shifts in a calendar. Changes produce an activity event and queued notifications for affected users.
- F2.2 Shift preferences are weekly availability windows. The server rejects overlapping shifts assigned to one person. Creating a shift publishes it immediately when D1 permits publishing; edits notify affected people. A shift may start no more than eight weeks ahead. Time-off requests and draft shifts are out of scope. **OPEN QUESTION (D4):** Is availability advisory or a hard scheduling block? Show it to Managers, but do not claim automatic enforcement until decided.
- F2.3 Every write checks team scope and role on the server. The app shows server-confirmed state after mutation or rolls back an optimistic view on failure.

**Acceptance:** Creating a shift publishes it; overlap and beyond-eight-week attempts fail on the server; edits appear in the feed and notify affected people; a Staff direct API write to a shift fails. Whether weekly availability blocks assignment remains open.

### F3. Swap requests

- **OPEN QUESTION (D3, blocking final swap schema and UX):** Is this a one-way transfer of the requester's shift to the colleague, or an exchange in which the colleague selects one of their own shifts? Both require colleague acceptance, then Manager approval; neither is chosen by this PRD. The schema's second shift reference remains optional until D3 is answered.
- F3.1 The requester selects one of their own shifts and a colleague. The colleague accepts or rejects first; an accepted request moves from `pending_colleague` to `pending_manager`. An authorized Manager then approves or rejects it. Terminal states are `approved`, `rejected`, and `cancelled`. **ASSUMPTION ADDED:** A colleague rejection uses `rejected`, with a rejection actor/reason recorded. For a transfer, validate the colleague's availability and overlap; for an exchange, validate both shifts, assignments, and overlap. Apply only the selected branch after D3.
- F3.2 On request submission, show “Swap requested” immediately, disable repeat submission, and roll back with an error if the server fails. TanStack Query invalidates or reconciles the affected shifts, feed, and requests.
- F3.3 A requester can cancel until Manager approval. Editing or deleting the requester's shift, or the colleague's shift in an exchange, while a swap is pending automatically cancels it and queues notice to both people. Approval runs in one PostgreSQL transaction that locks and rechecks every involved shift's version, assignment, team, and request state before changing assignments. A database uniqueness rule permits one open swap per involved shift; the server also disables a repeated tap. **ASSUMPTION ADDED:** Use an open-swap shift reservation table with unique `shiftId` entries, since one index over two shift columns cannot enforce uniqueness across both roles. Reserve the colleague shift only if D3 selects an exchange.

**Acceptance:** One tap results in at most one open request for the shift; a failed mutation restores the button; colleague acceptance precedes Manager approval; cancelled or edited shifts cannot be approved; both people receive cancellation notices; only an authorized Manager can approve, and the requester's own approval is rejected under the stated assumption.

### F4. Activity feed and pagination

- F4.1 The server returns feed items in descending `(createdAt, id)` order, with an opaque cursor containing both values. The next page selects records older than that pair, ensuring equal timestamps do not skip items. Team scope is enforced before pagination.
- F4.2 Add a PostgreSQL index supporting team-filtered ordering and the cursor predicate, `(teamId, createdAt DESC, id DESC)`. Seed at least 10,000 activity records. Capture `EXPLAIN ANALYZE` for the same representative cursor query before and after the index, including plan, actual rows, and timing. Do not fabricate a performance gain.
- F4.3 The mobile feed uses **CONFIRMED: FlashList** infinite scroll and pull to refresh. Prevent duplicate in-flight page requests; merge pages by item ID; refresh starts from the newest page.
- F4.4 Show distinct loading, empty, end-of-list, and retryable error states. A newly inserted event while page 1 is visible does not duplicate or skip older items during pagination.

**Acceptance:** Test equal timestamps, new items arriving between pages, rapid scroll, refresh, empty feed, and page failure. Seed and query-plan evidence are retained with the assessment.

### F5. State and offline access

- F5.1 TanStack Query owns all server data: shifts, membership, feed, swaps, settings, and billing read models. **CONFIRMED starting stale times:** calendar 60 seconds, roster 5 minutes, feed 30 seconds; settings and subscription status refetch on access, app foreground, and after relevant mutations rather than relying on a freshness window. Document garbage-collection times and tune measured values in `STATE.md`. Never cache active subscription or payment truth in Redis.
- F5.2 **CONFIRMED: Zustand** owns shared client UI state such as selected team, active tab, filters, and in-progress swap draft. Server data remains in TanStack Query and tokens remain in `expo-secure-store`; explain this split in `STATE.md`.
- F5.3 Persist the next 14 days of the user's upcoming shifts using the TanStack Query persister with AsyncStorage, including a visible last-successful-sync timestamp. AsyncStorage holds this non-secret shift snapshot only, never tokens. The offline view is read-only and partitioned by signed-in account and team. Overwrite on refresh and clear on logout or when leaving a team; when access is revoked remotely, purge on the next server contact. **ASSUMPTION ADDED:** Device-held data may remain visible while completely offline until revocation can be learned; display its timestamp rather than implying it is current.
- F5.4 On reconnect or foreground, refetch relevant queries. If an offline user cannot make a supported mutation, show that it requires a connection rather than pretending it succeeded. **ASSUMPTION ADDED:** Mutations are not queued offline because the brief only requires offline viewing.
- F5.5 Write `STATE.md` mapping every important item to server state, client state, or persisted state and explaining ownership, cache times, invalidation, and failure handling.

**Acceptance:** Upcoming shifts remain visible without network, carry a timestamp, and update after reconnect; no unrelated team's cached shifts appear after a switch.

### F6. Subscription and checkout

- F6.1 Use the exact prices in section 8, stored as integer cents. The server counts active members plus unexpired pending invites for the plan limit; only active members are billable. Starter cannot invite a sixth person when five places are active or reserved. Count all roles. Expired/revoked invites release capacity. **OPEN QUESTION (D5):** On Team or Business, can an invitation beyond included seats reserve capacity before extra-seat payment, or must payment establish the entitlement first? This blocks that invitation path.
- F6.2 Owner can initiate checkout or an upgrade/seat increase. Server computes any proration and creates an idempotent payment attempt through a small provider adapter. **CONFIRMED:** Flutterwave test mode is the first provider. Run a one-day spike to verify that the test account can check out in USD. If it cannot, Paystack test mode or Stripe, if an account is available, may replace it without changing the ledger or proration. Record the chosen fallback before implementation. App redirects to provider checkout and displays pending status; it never treats a return URL or client callback as proof of payment.
- F6.3 Verify the selected provider's webhook signature before accepting an event. Durably insert a unique event receipt or outbox record before returning a successful HTTP acknowledgment. A recoverable worker processes that record, verifies the provider transaction's status, amount, currency, and internal reference against the expected attempt, and in one transaction writes the ledger effect and subscription transition. Duplicate events return the prior processing outcome; a queue outage after receipt cannot discard work. For Flutterwave, use the chosen API version's exact signature and event fields. See [Flutterwave webhooks](https://developer.flutterwave.com/v4.0/docs/webhooks) and [checkout](https://developer.flutterwave.com/docs/flutterwave-standard-1).
- F6.4 The server writes append-only charge, credit, and refund ledger rows. Never edit or delete them. Corrections add entries. Rebuild subscription state from the ledger and verify it matches the current materialized state. Payment idempotency keys return the stored outcome on retry.
- F6.5 Upgrades and extra paid seats use remaining calendar-day proration and floor each pro-rated amount to cents. Downgrades and cost reductions take effect next period. Removing a member immediately revokes their sessions and deletes their push tokens; no partial-period credit or refund is created. A multi-team user must sign in again and re-register devices for remaining teams; those memberships are not deleted. The already-paid place may be refilled within the same period at no charge. Charge only when active members exceed the paid seat count for the current period, while still applying plan limits to active plus reserved invites. Maintain both current active count and paid seat entitlement so removal does not erase prepaid capacity.
- F6.6 On failed renewal, notify Owner immediately, on day 3, and on day 6. Provide seven calendar days of grace. After day 7, set the team read-only: members can view shifts, Managers cannot create or edit, invitations and swaps are blocked, and Owner retains billing access to pay. **ASSUMPTION ADDED:** Count grace days in UTC from the failed renewal timestamp, with restriction when the seven-day interval ends; state the exact boundary in tests.

**Acceptance:** Duplicate payment requests and webhooks never double-charge or double-credit; failed or unverified events never activate access; a signed webhook received during a queue outage remains recoverable after acknowledgment; Starter rejects a sixth active or reserved place; removal revokes access immediately but does not create a refund; a replacement can use prepaid capacity; renewal failure follows the 0/3/6-day alerts and seven-day restriction; Owner can still reach checkout. Test an abandoned initial checkout against the D1 policy once decided.

### F7. Push notifications and settings

- F7.1 Register each device token after login against user and device; allow several devices per user. Background jobs send shift-change, swap-request, swap-approval, and billing notifications. Delete invalid tokens reported by the push service.
- F7.2 A tap deep links to the exact shift, swap, or billing screen after authentication and team authorization. Missing/deleted resources show a safe error, never another team's content.
- F7.3 User can independently enable or disable shift-change, swap, and billing groups. Server-stored settings include quiet hours, IANA time zone, notification groups, language, and theme. **CONFIRMED:** English and one additional language, and system/light/dark themes. **OPEN QUESTION:** Select the additional language before localization work. **ASSUMPTION ADDED:** IANA time zone identifiers support daylight-saving changes.
- F7.4 On launch or foreground, each device refetches server settings. Optimistic changes roll back on failure. Each individual setting has server-set `updatedAt`; the newest accepted write wins. Document weakness: near-simultaneous edits can overwrite another device's intent, and clocks/arrival order do not express user intent.
- F7.5 Notification jobs check server settings and local quiet-hour window, including a window crossing midnight. A change, cancellation, swap approval, or rejection involving a shift that starts within 12 hours is urgent and bypasses quiet hours, but never a disabled notification group. New shifts, swap requests, and billing alerts wait until quiet hours end. Recheck current preferences and time-to-shift at send time. Test time-zone changes and daylight-saving transitions where relevant. **ASSUMPTION ADDED:** A negative time-to-shift does not qualify as an upcoming urgent shift.

**Acceptance:** A preference changed on device A appears on device B after foregrounding; server jobs obey it; a rejected edit rolls back; invalid tokens are removed; a tap opens the authorized target.

## 6. AI processing pipeline

Not applicable. Neither source document specifies AI input, inference, model, output, or evaluation. No AI feature or pipeline is included.

## 7. Technical requirements

### Architecture and platform

| Layer | Requirement or decision | Verification |
| --- | --- | --- |
| App | **REQUIRED:** React Native with Expo, built in Antigravity as taught | Android development build runs required flows |
| API | **CONFIRMED:** Node.js with Express; **REQUIRED:** backend under our control | Server tests and deployment configuration |
| Database | **REQUIRED and CONFIRMED:** PostgreSQL for the product backend | Pool, read replica, read-your-own-writes, index, and `EXPLAIN ANALYZE` evidence |
| ORM | **ASSUMPTION ADDED:** Prisma with PostgreSQL, because a Prisma data model is requested | Schema and migration review; use SQL migration for constraints Prisma cannot express |
| Redis | **REQUIRED:** caching, per-user/per-IP rate limits, and locks; hosted free tier such as Upstash allowed | Distributed limit and lock tests |
| Jobs | **REQUIRED:** Redis-backed queue such as BullMQ | Retry, exponential backoff, terminal failed list |
| Validation | **REQUIRED:** Zod validates every server request body | Invalid body tests for each write route |
| Payments | **CONFIRMED:** Flutterwave test mode first, conditional on USD spike; Paystack test mode or eligible Stripe fallback | Signature, verification, idempotency, duplicate event tests for the actual provider |
| Errors | **REQUIRED:** Sentry on app and server | Captured test error with sensitive values redacted |
| Load | **REQUIRED:** k6 scripts and written `load-tests/` report | Recorded run, environment, throughput, latency, and errors |

Remote push on Android requires an Expo development build; Expo Go does not support it in current SDKs. Use EAS Build. Android is sufficient for this task, and iOS real-device builds need an Apple Developer account. See [Expo notifications](https://docs.expo.dev/versions/v56.0.0/sdk/notifications/) and [development builds](https://docs.expo.dev/develop/development-builds/faq/). Do not claim a push test passed from Expo Go.

### Data access, performance, and scaling

- Use a pooled PostgreSQL connection, set and justify the pool size against provider limits, API instances, and workers. **ASSUMPTION ADDED:** Start with 10 connections per API instance, then revise from load results and the actual database connection limit.
- Configure distinct primary and read-replica connection strings. Route eligible reads to the replica and all writes to primary. For local evidence, run a PostgreSQL primary and streaming replica in Docker, introduce an artificial replica apply delay, show a stale read, then show the fix. After each user's write, set a short-lived Redis key so that user's affected reads route to primary. **ASSUMPTION ADDED:** Start with a five-second window, then compare the replica's replay position with the write position before allowing affected reads back to the replica; continue primary routing while the replica remains behind. A timer alone cannot guarantee read-your-own-writes under longer lag. Document how a managed PostgreSQL replica replaces the local setup in production. If a hosted free tier lacks a replica, the product still uses and tests the local routing configuration rather than merely documenting it.
- **Read routing matrix:** Writes, payment and subscription truth, authorization and seat checks, all transaction-bound reads, and the immediate post-write reads go to primary. Feed and calendar reads may go to replica only when no per-user primary-read marker applies and replay has caught up to that user's write position. Test each route and record the selected connection. **ASSUMPTION ADDED:** Use a separately configured Prisma client or supported read-replica extension plus an explicit routing wrapper; no Prisma call is assumed to route itself correctly.
- Document a future team-ID shard key so related records stay together; explain unevenly active teams, hot shards, cross-team analytics, migration, and why sharding is deferred.
- Apply cache-aside with explicit TTL and invalidation to suitable read-heavy nonfinancial data. **ASSUMPTION ADDED:** Candidate: team display metadata with a 60-second TTL invalidated on edit; confirm suitability under measured use. Never cache active subscriptions, payment status, credit balances, or webhook idempotency records. The 200-user feed targets compare measured uncached and cached configurations only if the chosen feed caching strategy preserves cursor correctness and invalidation; do not infer that Redis caching is required for feed pages.
- Use Redis-based per-user and per-IP limits, strict on login, password reset, invites, payment initiation, and expensive routes. **ASSUMPTION ADDED:** Actual request quotas should be set after testing and documented; do not treat example values as policy.

### Reliability, security, and observability

- Queue pushes, webhook processing, emails, and slow third-party work. Specify exponential backoff, maximum attempts, and a failed-job list. **ASSUMPTION ADDED:** Three attempts with escalating delays is a starting configuration; reconcile with provider retry behavior so a duplicate event remains harmless.
- Verify a webhook's signature, then persist a unique receipt or outbox event before acknowledging it. A dispatcher retries enqueueing pending receipts after a queue outage. The worker verifies provider transaction details; ledger writes and subscription transitions occur atomically and are idempotent. Handle out-of-order events by checking expected payment state and never regressing a final state. Test failure before durable receipt (no success acknowledgment), after receipt but before enqueue, during verification, and during ledger transaction.
- Log every request with request ID, user ID when present, route, response time, and result; log every job attempt. Correlate checkout reference, webhook event, verification result, and ledger row so support can trace a payment. Redact secrets, tokens, and sensitive payment details. Use Sentry on both app and server.
- Enumerate every `EXPO_PUBLIC_` variable and justify exposure. Keep Flutterwave secret keys, webhook secret, database credentials, and Redis credentials server-side. Require `SECURITY.md` with eight specific threats and mitigations: role bypass, cross-team access, token theft/replay, reset/invite abuse, exposed app secrets, forged or duplicate webhooks, payment retries, and notification/data leakage. **ASSUMPTION ADDED:** These are proposed threat categories; the file may refine them without dropping the count or required defenses.
- Add `load-tests/` k6 scripts and a written report with test environment, seed size, workload mix, concurrency, latency distribution, errors, bottlenecks, and changes tested. Do not invent results before execution.

### Required proof and documentation

| Artifact | Minimum proof |
| --- | --- |
| `STATE.md` | Data ownership, selected client tool, cache times, persisted shifts, invalidation, and rollback |
| `SECURITY.md` | Eight app-specific threats and mitigations; permission, isolation, token, and payment controls |
| README | Setup, Android development build, safe public variable list, proration formula and rounding, and production app store billing implications |
| Query plans | PostgreSQL `EXPLAIN ANALYZE` for the same representative cursor query on 10,000 or more seeded records before and after the index |
| Automated tests | Unauthorized Staff delete; cross-team isolation; refresh reuse; optimistic rollback; pagination race/equal time; webhook duplicates/signature and queue outage; concurrent last-seat reservation; swap stale approval; seat cap; eight distinct proration cases; ledger replay and restored-database comparison |
| `load-tests/` | k6 scripts and measured report against 200 feed virtual users, with uncached and valid cached configurations if applicable |

Production billing requires a fresh review before store submission. As of this PRD, Google Play generally requires its billing system for in-app digital functionality, subject to specific exceptions and regional programs; Apple's rules distinguish digital access and certain enterprise or companion-app cases. Rota's paid scheduling access needs classification against the actual distribution and purchase flow. The test-mode Flutterwave assessment does not settle production eligibility. Document the outcome in the README. See [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en) and [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

## 8. Business model

Businesses pay a monthly subscription based on plan and staff seats. These exact values are required and stored in integer cents:

| Plan | Base per month | Included seats | Additional seat per month |
| --- | ---: | ---: | ---: |
| Starter | 2,000 cents ($20) | Up to 5 | Not available |
| Team | 5,000 cents ($50) | Up to 15 | 300 cents ($3) |
| Business | 12,000 cents ($120) | Up to 40 | 200 cents ($2) |

The base price covers the listed included seats. Additional-seat pricing applies **only above** that count. A Team with nine active members pays the $50 base price, matching the supplied upgrade example. Active members of any role are billable. Pending invites reserve capacity for the plan limit but are not billed before acceptance. A freed, already-paid seat can be refilled in the same period without a new charge. Extra-seat charges begin only when active members exceed the number already paid for in that period. The server must also prevent reserved invites from exceeding the plan's capacity rules; D5 blocks the Team/Business invitation path beyond included seats until its payment timing is decided. The Owner's billing view separately displays active members, pending reservations, paid seat entitlement for this period, charge due today, and next renewal amount, all sourced from server calculations.

**Required proration:** For a chargeable mid-period change, calculate unused old-plan credit and remaining new-plan cost on the server, floor each monetary result to whole cents, then charge the difference when positive. If 20 days remain of 30, Starter credit is `floor(2000 × 20 / 30) = 1333` cents, Team remaining cost is `floor(5000 × 20 / 30) = 3333` cents, and today's charge is 2000 cents. The next period charges the full Team price. A downgrade takes effect at the end of the period. Do not delegate this arithmetic to Flutterwave.

**CONFIRMED:** Prorate by whole UTC calendar dates. **ASSUMPTION ADDED:** The server records the billing period start at 00:00 UTC for the date on which the period begins, independent of the provider's checkout timestamp. If a provider establishes a non-midnight billing anchor, record the normalized assessment boundary before charging and reconcile provider renewal timing explicitly. The period has its actual 28, 29, 30, or 31 calendar dates. `remainingDays = periodDays - elapsedCalendarDates`, where the first date has zero elapsed and the last date has `periodDays - 1` elapsed. A first-date change has the full period left; a last-date change has one day. Floor old credit and new cost separately, then subtract. The supplied day-11/30-day example has 20 days remaining and must remain exact. Test at the UTC midnight boundary and with a non-midnight provider callback.

Test at least eight distinct cases: (1) Starter→Team example, (2) another upgrade, (3) scheduled downgrade, (4) additional Team seat beyond 15, (5) seat removal with no credit and same-period refill, (6) first-day change, (7) last-day change, (8) two changes in one period. Also test nine Team members at base price, included-seat threshold, February period, pending invitation capacity, and repeated payment key. USD cents are the assessment prices; markets and tax are out of scope and this is documented in the README. Run a one-day Flutterwave USD test checkout spike first. If unavailable, record a decision to use Paystack test mode or Stripe where an account is available, preserving the adapter, ledger, and proration.

Failed renewal triggers Owner alerts on failure, day 3, and day 6; a seven-day grace period follows. After day 7 the team is read-only: shifts remain viewable, Managers cannot create/edit, swaps and invites are blocked, and the Owner retains billing access. The server's verified ledger and subscription projection determine access; the app does not derive payment success.

## 9. Risks

| Risk | Impact | Required mitigation or pending decision |
| --- | --- | --- |
| Transfer versus exchange undecided or stale shift | Wrong assignment or conflicting approvals | Resolve D3 before final schema and UX; transactionally reject stale approval |
| Invite reservation and paid-seat boundary | Incorrect charges or blocked invitations | Test active plus pending capacity, active billable count, and prepaid refill; decide Team/Business extra-seat invite timing |
| Webhook duplication, forgery, delay, or order | Double entry or premature activation | Signature verification, transaction verification, event uniqueness, idempotency, ledger transaction, pending UI |
| Refresh-token replay or app-bundle secret | Account or payment compromise | Secure Store, rotation/reuse rejection, server-only secrets, all-device logout |
| Replica lag or connection misrouting | User sees stale data after a write | Local delayed-replica test, per-user Redis primary-read window, tracing and read routing tests |
| Offline data after access revocation | Old schedule remains on device | **ASSUMPTION ADDED:** Clear cache when revocation is learned; show last-updated time and treat offline data as potentially stale |
| Quiet-hour and time-zone edge cases | Missed or unwanted push | Server check, delayed queue, preference recheck, transition tests; apply confirmed 12-hour urgent rule and disabled-type override |
| Flutterwave USD test availability or store policy | Checkout spike fails or production flow is rejected | One-day USD spike; documented Paystack/Stripe fallback if needed; review store policy before release |
| Free-tier limits or slow jobs | Unreliable push, payment, or feed | Queue retries, failed list, PostgreSQL pool budget, k6 results, logs and Sentry |
| Loss or inconsistent restoration of permanent financial records | Incorrect entitlement or duplicate webhook processing | Scheduled PostgreSQL backups; restore into a separate environment; compare replayed ledger with subscription state; verify retained webhook IDs remain unique. **OPEN QUESTION:** Set recovery time and recovery point objectives before production |

## 10. Prisma data model

This is the migration-ready model for settled decisions. **ASSUMPTION ADDED:** Prisma is the ORM. The swap's optional `colleagueShiftId` supports either D3 outcome, but the final transaction and UX remain blocked. Field names are implementation proposals. PostgreSQL SQL migrations below enforce rules that the Prisma schema alone cannot express.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  OWNER
  MANAGER
  STAFF
}
enum MembershipStatus {
  ACTIVE
  REMOVED
}
enum ShiftStatus {
  PUBLISHED
  CANCELLED
}
enum SwapStatus {
  PENDING_COLLEAGUE
  PENDING_MANAGER
  APPROVED
  REJECTED
  CANCELLED
}
enum SubscriptionStatus {
  PENDING_INITIAL_PAYMENT
  ACTIVE
  GRACE
  RESTRICTED
}
enum PaymentStatus {
  PENDING
  VERIFIED
  FAILED
}
enum EventStatus {
  RECEIVED
  QUEUED
  PROCESSED
  FAILED
}
enum LedgerKind {
  CHARGE
  CREDIT
  REFUND
  STATE_CHANGE
}

model User {
  id                 String @id @default(uuid()) @db.Uuid
  email              String @unique
  passwordHash       String?
  createdAt          DateTime @default(now()) @db.Timestamptz(3)
  ownedTeams         Team[] @relation("TeamOwner")
  memberships        Membership[]
  sentInvites        Invitation[] @relation("Inviter")
  assignedShifts     Shift[] @relation("Assignee")
  requestedSwaps     SwapRequest[] @relation("Requester")
  colleagueSwaps     SwapRequest[] @relation("Colleague")
  approvedSwaps      SwapRequest[] @relation("Approver")
  activity           ActivityEvent[] @relation("Actor")
  settings           UserSetting?
  devices            Device[]
  sessions           Session[]
  magicLinks         MagicLinkToken[]
  passwordResets     PasswordResetToken[]
  preferences        ShiftPreference[]
}

model Team {
  id              String @id @default(uuid()) @db.Uuid
  name            String
  ownerId         String @db.Uuid
  owner           User @relation("TeamOwner", fields: [ownerId], references: [id])
  memberships     Membership[]
  invitations     Invitation[]
  shifts          Shift[]
  preferences     ShiftPreference[]
  swaps           SwapRequest[]
  activity        ActivityEvent[]
  subscription    Subscription?
  paymentAttempts PaymentAttempt[]
  ledger          LedgerEntry[]
  createdAt       DateTime @default(now()) @db.Timestamptz(3)
}

model Membership {
  id       String @id @default(uuid()) @db.Uuid
  teamId   String @db.Uuid
  userId   String @db.Uuid
  role     Role
  status   MembershipStatus @default(ACTIVE)
  joinedAt DateTime @default(now()) @db.Timestamptz(3)
  team     Team @relation(fields: [teamId], references: [id])
  user     User @relation(fields: [userId], references: [id])
  @@unique([teamId, userId])
  @@index([userId, status])
}

model Invitation {
  id         String @id @default(uuid()) @db.Uuid
  teamId     String @db.Uuid
  inviterId  String @db.Uuid
  email      String?
  role       Role
  tokenHash  String @unique
  expiresAt  DateTime @db.Timestamptz(3)
  acceptedAt DateTime? @db.Timestamptz(3)
  revokedAt  DateTime? @db.Timestamptz(3)
  team       Team @relation(fields: [teamId], references: [id])
  inviter    User @relation("Inviter", fields: [inviterId], references: [id])
  @@index([teamId, expiresAt])
}

model MagicLinkToken {
  id        String @id @default(uuid()) @db.Uuid
  userId    String @db.Uuid
  tokenHash String @unique
  expiresAt DateTime @db.Timestamptz(3)
  usedAt    DateTime? @db.Timestamptz(3)
  user      User @relation(fields: [userId], references: [id])
}

model PasswordResetToken {
  id        String @id @default(uuid()) @db.Uuid
  userId    String @db.Uuid
  tokenHash String @unique
  expiresAt DateTime @db.Timestamptz(3)
  usedAt    DateTime? @db.Timestamptz(3)
  user      User @relation(fields: [userId], references: [id])
}

model Shift {
  id              String @id @default(uuid()) @db.Uuid
  teamId          String @db.Uuid
  assigneeId      String @db.Uuid
  startAt         DateTime @db.Timestamptz(3)
  endAt           DateTime @db.Timestamptz(3)
  status          ShiftStatus @default(PUBLISHED)
  version         Int @default(1)
  createdAt       DateTime @default(now()) @db.Timestamptz(3)
  updatedAt       DateTime @updatedAt @db.Timestamptz(3)
  team            Team @relation(fields: [teamId], references: [id])
  assignee        User @relation("Assignee", fields: [assigneeId], references: [id])
  requesterSwaps  SwapRequest[] @relation("RequesterShift")
  colleagueSwaps  SwapRequest[] @relation("ColleagueShift")
  openReservation OpenSwapShift?
  @@index([teamId, startAt])
  @@index([assigneeId, startAt])
}

model ShiftPreference {
  id        String @id @default(uuid()) @db.Uuid
  teamId    String @db.Uuid
  userId    String @db.Uuid
  weekday   Int
  startTime String
  endTime   String
  updatedAt DateTime @updatedAt @db.Timestamptz(3)
  team      Team @relation(fields: [teamId], references: [id])
  user      User @relation(fields: [userId], references: [id])
  @@index([teamId, userId, weekday])
}

model SwapRequest {
  id               String @id @default(uuid()) @db.Uuid
  teamId           String @db.Uuid
  requesterId      String @db.Uuid
  colleagueId      String @db.Uuid
  approverId       String? @db.Uuid
  requesterShiftId String @db.Uuid
  colleagueShiftId String? @db.Uuid
  requesterVersion Int
  colleagueVersion Int?
  status           SwapStatus @default(PENDING_COLLEAGUE)
  createdAt        DateTime @default(now()) @db.Timestamptz(3)
  updatedAt        DateTime @updatedAt @db.Timestamptz(3)
  team             Team @relation(fields: [teamId], references: [id])
  requester        User @relation("Requester", fields: [requesterId], references: [id])
  colleague        User @relation("Colleague", fields: [colleagueId], references: [id])
  approver         User? @relation("Approver", fields: [approverId], references: [id])
  requesterShift   Shift @relation("RequesterShift", fields: [requesterShiftId], references: [id])
  colleagueShift   Shift? @relation("ColleagueShift", fields: [colleagueShiftId], references: [id])
  reservations     OpenSwapShift[]
  @@index([teamId, status, createdAt])
}

model OpenSwapShift {
  shiftId       String @id @db.Uuid
  swapRequestId String @db.Uuid
  shift         Shift @relation(fields: [shiftId], references: [id])
  swapRequest   SwapRequest @relation(fields: [swapRequestId], references: [id])
  @@index([swapRequestId])
}

model ActivityEvent {
  id        String @id @default(uuid()) @db.Uuid
  teamId    String @db.Uuid
  actorId   String? @db.Uuid
  type      String
  targetId  String? @db.Uuid
  payload   Json
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  team      Team @relation(fields: [teamId], references: [id])
  actor     User? @relation("Actor", fields: [actorId], references: [id])
  @@index([teamId, createdAt(sort: Desc), id(sort: Desc)])
}

model UserSetting {
  userId             String @id @db.Uuid
  quietStart         String?
  quietEnd           String?
  timeZone           String
  shiftPush          Boolean @default(true)
  swapPush           Boolean @default(true)
  billingPush        Boolean @default(true)
  language           String @default("en")
  theme              String @default("system")
  fieldUpdatedAt     Json
  user               User @relation(fields: [userId], references: [id])
}

model Device {
  id            String @id @default(uuid()) @db.Uuid
  userId        String @db.Uuid
  pushToken     String? @unique
  lastSeenAt    DateTime @db.Timestamptz(3)
  invalidatedAt DateTime? @db.Timestamptz(3)
  user          User @relation(fields: [userId], references: [id])
  sessions      Session[]
}

model Session {
  id            String @id @default(uuid()) @db.Uuid
  userId        String @db.Uuid
  deviceId      String? @db.Uuid
  revokedAt     DateTime? @db.Timestamptz(3)
  user          User @relation(fields: [userId], references: [id])
  device        Device? @relation(fields: [deviceId], references: [id])
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String @id @default(uuid()) @db.Uuid
  sessionId String @db.Uuid
  familyId  String @db.Uuid
  tokenHash String @unique
  expiresAt DateTime @db.Timestamptz(3)
  usedAt    DateTime? @db.Timestamptz(3)
  revokedAt DateTime? @db.Timestamptz(3)
  session   Session @relation(fields: [sessionId], references: [id])
  @@index([familyId])
}

model Plan {
  code           String @id
  basePriceCents Int
  includedSeats  Int
  extraSeatCents Int?
  subscriptions  Subscription[]
}

model Subscription {
  id                  String @id @default(uuid()) @db.Uuid
  teamId              String @unique @db.Uuid
  planCode            String
  periodStart         DateTime @db.Timestamptz(3)
  periodEnd           DateTime @db.Timestamptz(3)
  status              SubscriptionStatus @default(PENDING_INITIAL_PAYMENT)
  pendingPlanCode     String?
  paidSeatEntitlement Int
  activeMemberCount   Int @default(0)
  graceEndAt          DateTime? @db.Timestamptz(3)
  team                Team @relation(fields: [teamId], references: [id])
  plan                Plan @relation(fields: [planCode], references: [code])
  attempts            PaymentAttempt[]
  ledger              LedgerEntry[]
}

model PaymentAttempt {
  id                  String @id @default(uuid()) @db.Uuid
  teamId              String @db.Uuid
  subscriptionId      String @db.Uuid
  idempotencyKey      String @unique
  txRef               String @unique
  provider            String
  providerTransaction String?
  expectedAmountCents Int
  currency            String
  status              PaymentStatus @default(PENDING)
  createdAt           DateTime @default(now()) @db.Timestamptz(3)
  team                Team @relation(fields: [teamId], references: [id])
  subscription        Subscription @relation(fields: [subscriptionId], references: [id])
  ledger              LedgerEntry[]
}

model WebhookEvent {
  id              String @id @default(uuid()) @db.Uuid
  provider        String
  providerEventId String
  payload         Json?
  status          EventStatus @default(RECEIVED)
  receivedAt      DateTime @default(now()) @db.Timestamptz(3)
  processedAt     DateTime? @db.Timestamptz(3)
  failureReason   String?
  @@unique([provider, providerEventId])
  @@index([status, receivedAt])
}

model LedgerEntry {
  id               String @id @default(uuid()) @db.Uuid
  teamId           String @db.Uuid
  subscriptionId   String @db.Uuid
  paymentAttemptId String? @db.Uuid
  kind             LedgerKind
  eventType        String
  amountCents      Int
  currency         String
  planCodeAfter    String?
  paidSeatsAfter   Int?
  statusAfter      SubscriptionStatus?
  periodStartAfter DateTime? @db.Timestamptz(3)
  periodEndAfter   DateTime? @db.Timestamptz(3)
  effectiveAt      DateTime @db.Timestamptz(3)
  createdAt        DateTime @default(now()) @db.Timestamptz(3)
  correctionOfId   String? @db.Uuid
  team             Team @relation(fields: [teamId], references: [id])
  subscription     Subscription @relation(fields: [subscriptionId], references: [id])
  paymentAttempt   PaymentAttempt? @relation(fields: [paymentAttemptId], references: [id])
  correctionOf     LedgerEntry? @relation("Correction", fields: [correctionOfId], references: [id])
  corrections      LedgerEntry[] @relation("Correction")
  @@index([subscriptionId, createdAt, id])
}
```

**SQL migrations and checks required beyond Prisma:**

1. Add `CHECK (end_at > start_at)` to shifts; `CHECK` rules for nonnegative plan prices, seats, and expected payment amounts; allowed language/theme and preference time formats after the extra language is selected.
2. Use PostgreSQL `btree_gist` plus an exclusion constraint on `(assignee_id, tstzrange(start_at, end_at, '[)'))` for published shifts, so concurrent inserts cannot assign overlapping shifts to one person. Exclude cancelled shifts and test adjacent boundaries. An authorized swap transaction must satisfy the same constraint for final assignments.
3. Prevent `UPDATE` and `DELETE` on `LedgerEntry` with database privileges and a protective trigger. Corrections are new rows. Ledger events carry the resulting plan, paid-seat entitlement, status, and period boundaries when those change; a zero-amount transition uses `STATE_CHANGE`. Define and test replay ordering by `(effectiveAt, createdAt, id)`. Test direct SQL mutation attempts using the application role.
4. Enforce single-use token redemption and last-seat reservations in transactions that lock the relevant team/subscription row. Create an `OpenSwapShift` row for each involved shift and delete those rows in the same transaction that makes the swap terminal. Test two concurrent attempts.
5. Retain the unique webhook event identity permanently while clearing its raw `payload` after 90 days. The durable receipt is committed before HTTP acknowledgment; a dispatcher can recover `RECEIVED` or `FAILED` events after queue outages.
6. Audit foreign keys for team consistency: a shift assignee and both swap participants must be active members of the same team; enforce in the service transaction and integration tests. Add migration checks or composite foreign keys where feasible. Normalize email to a consistent lowercase form before insert and test uniqueness.

The schema is a build specification, not evidence that migrations already ran. D3 may change the `colleagueShiftId` requirement and reservation count; D1 and D5 determine entitlement gates. Ledger replay must reconstruct the subscription projection and match it after a restore. Retention values remain configurable: activity 12 months; request/job logs and failed jobs 30 days; raw webhook payloads 90 days; webhook IDs and ledger permanently; offline snapshots replaced on refresh and cleared on logout or team departure.

## 11. Success metrics

Assessment completion is verified by evidence, not claimed adoption. Required pass conditions: all specified flows that are unblocked work in an Android development build; authorization and cross-team tests pass; 10,000 feed records are seeded; cursor race and equal-timestamp tests pass; before/after index plans are recorded; at least eight proration cases pass; duplicate, forged, and queue-outage webhook tests pass; `STATE.md`, `SECURITY.md`, README, and `load-tests/` report exist. A blocked feature is reported as blocked, never passed. The full PRD cannot be signed off until D1–D6 and the provider spike are resolved.

| Metric | Proposed target | Measurement |
| --- | --- | --- |
| Feed correctness under concurrent inserts | **ASSUMPTION ADDED:** Zero duplicate or missing IDs in scripted traversal | Seeded deterministic pagination test |
| Unauthorized and cross-team access | **ASSUMPTION ADDED:** Zero successful forbidden operations in required automated cases | API integration suite |
| Duplicate payment side effects | **ASSUMPTION ADDED:** Exactly one final ledger effect per logical successful attempt | Repeated key and webhook tests |
| Offline schedule availability | **ASSUMPTION ADDED:** 100% of last successfully synced upcoming shifts shown in a controlled offline test | Device test with last-updated display |
| Feed latency and error rate | **CONFIRMED sign-off target:** 200 virtual users; p95 <500 ms uncached, <200 ms with a valid cache strategy, errors <1% | Hold hardware, seed, page size, index, workload mix, and duration constant. Report uncached p95 and errors. Run the cached comparison only if a documented strategy preserves cursor correctness and invalidation; otherwise mark the <200 ms target **untested and unresolved**, not passed. Report misses honestly. |
| Pilot adoption | **CONFIRMED sign-off target:** three pilot teams and 80% of invited Staff active within seven days | Denominator: distinct Staff invitations accepted during the pilot. Measure each person's qualifying activity within seven days of their own acceptance. **ASSUMPTION ADDED:** qualifying activity is an authenticated shift view; agree this before the pilot. |
| Schedule use | **ASSUMPTION ADDED:** propose a weekly schedule-publishing threshold after pilot baseline | Count pilot teams with a published schedule in each pilot week; do not treat sign-in alone as scheduling adoption. Product Lead owns the threshold. |
| Swap resolution | **ASSUMPTION ADDED:** propose a completion threshold after D3 and pilot baseline | Count initiated swaps and those reaching approved/rejected/cancelled, plus median time by stage; report outside-channel resolutions if measured. Product Lead owns the threshold. |
| Push handoff | **CONFIRMED sign-off target:** 95% submitted to push service within 30 seconds of trigger outside quiet hours | Trigger, job, and provider response timestamps; this measures handoff, not device display |
| Pilot uptime | **CONFIRMED sign-off target:** 99.5% | **ASSUMPTION ADDED:** Measure API availability monthly during pilot with a defined health check and exclude only planned maintenance if disclosed |

## 12. Assumptions

This register contains proposals only. Confirmed scope choices, including no time-off flow and PostgreSQL, are not assumptions. Unanswered product decisions appear in section 14.

| ID | Proposal | Status and owner | Decide or verify by |
| --- | --- | --- | --- |
| A1 | **ASSUMPTION ADDED:** One general scheduling workflow serves all three named sectors; payroll, timesheets, and sector-specific labor rules are omitted. | Proposed; Product Lead | Before pilot scope sign-off |
| A2 | **ASSUMPTION ADDED:** Offline shifts are read-only; mutations do not queue offline; revoked access is cleared when contact resumes. | Proposed; Product Lead and Engineer | Before offline acceptance |
| A3 | **ASSUMPTION ADDED:** Magic-link, invite, and reset-token lifetimes are configurable; exact durations are not yet chosen. | Proposed; Engineer and Security reviewer | Before auth implementation |
| A4 | **ASSUMPTION ADDED:** A requester cannot approve their own swap; a colleague rejection is a terminal `rejected` state. | Proposed; Product Lead | Before swap acceptance; D2 also applies |
| A5 | **ASSUMPTION ADDED:** Prisma, the named schema fields, and the open-swap reservation table are the implementation design. | Proposed; Engineer | Before first migration and again after D3 |
| A6 | **ASSUMPTION ADDED:** Start with a 10-connection API pool, five-second primary-read marker, 60-second team metadata cache TTL, and three escalating job attempts; measure and adjust. | Proposed; Engineer | Before load and lag evidence |
| A7 | **ASSUMPTION ADDED:** Use IANA time zones, recheck delayed notification preferences, and do not treat past shifts as urgent. | Proposed; Engineer and Product Lead | Before push acceptance |
| A8 | **ASSUMPTION ADDED:** Seven-day grace starts at the failed renewal instant in UTC; billing periods start at 00:00 UTC on their recorded dates. | Proposed boundary interpretation; Product Lead | Before proration and grace tests |
| A9 | **ASSUMPTION ADDED:** An authenticated shift view defines active Staff; measure uptime monthly with disclosed maintenance treatment. | Proposed measurement method; Product Lead | Before pilot begins |
| A10 | **ASSUMPTION ADDED:** Schedule-publishing and swap-resolution thresholds are set after a pilot baseline. | Proposed measurement plan; Product Lead | Before pilot success sign-off |

## 13. Phased roadmap

Phases sequence the work; they do not remove a requirement from the assessment. A phase cannot be called complete without its stated evidence.

| Phase | Deliverables and exit evidence | Dependency |
| --- | --- | --- |
| 0. Decisions and provider spike | Record D1–D5 owners and answers before each dependent feature. Run a one-day Flutterwave USD test; select a documented fallback only if needed. Choose the second language. | Product decisions and provider access; independent foundation work may begin |
| 1. Foundation | Expo app in Antigravity; Android EAS development build; Express with pooled PostgreSQL, Redis, queue, Prisma migrations, Zod; request logs and Sentry; token rotation, reset, magic link, multi-team membership and invitations; local primary/streaming replica and routing. **Exit tests:** auth replay, Staff forbidden shift mutation, cross-team isolation, concurrent final-seat reservation, replica routing and read-your-own-writes under induced lag. | PostgreSQL environment; independent of Flutterwave USD result |
| 2. Scheduling and state | Calendar, published shifts, availability, overlap/horizon checks, D3-resolved two-step swaps, activity events, cursor API and index, 10,000 records, FlashList states, TanStack Query, Zustand, offline 14-day shifts, `STATE.md`. **Exit tests:** concurrent overlap, swap race/cancellation, pagination with inserts and equal timestamps, offline account isolation, before/after `EXPLAIN ANALYZE`. | Phase 1; D1 for prepayment publishing, D2–D4 for affected behavior |
| 3. Billing and notifications | Exact plans, D5-resolved invitation entitlement, paid-seat refill, UTC-day proration, chosen test checkout, durable webhook receipt, append-only ledger and replay, grace period, push, settings and urgent rule. **Exit tests:** eight proration cases, payment retry and queue outage, webhook duplicates, ledger replay, seat race, grace boundaries, disabled/quiet-hour push. | Phase 1; provider spike for checkout and D1/D5 for entitlement |
| 4. Integrated verification and handoff | Android deep-link/push tests, `SECURITY.md`, safe public variable list, README store policy and market/tax scope, k6 report, retention checks, and sign-off results. Restore PostgreSQL into an isolated environment; verify ledger replay, webhook uniqueness, pooling, replica routing, and query plans. Report targets as passed, missed, untested, or blocked. | Phases 2 and 3 and resolved D1–D5 for full sign-off |

## 14. Open questions

PostgreSQL, Express, magic links, FlashList, Zustand, and the prior confirmed product rules remain selected. These remaining items have different owners and block only the work shown. A proposed assumption is not a product decision.

| ID and type | Decision or evidence needed | Owner | Work blocked |
| --- | --- | --- | --- |
| D1 · Product decision | May an Owner invite and publish shifts while the initial subscription is `pending_initial_payment`? | Product Lead | Prepayment invitations/publishing and initial entitlement gate |
| D2 · Product decision | Who approves an Owner/Manager swap if no other Manager exists? Retain or revise the no-self-approval assumption. | Product Lead | Those members' swap completion flow |
| D3 · Product decision | Is a swap a one-way transfer or an exchange of two shifts? | Product Lead | Final swap schema, transaction, UI, and tests |
| D4 · Product decision | Are availability windows advisory or a hard block? | Product Lead | Availability-related shift validation and messaging |
| D5 · Product decision | For Team/Business extra seats, can an invite reserve a place before payment, or only after payment establishes paid entitlement? | Product Lead | Above-included-seat invite and checkout sequence |
| E1 · Provider spike | Does the Flutterwave test account support USD? If not, which permitted provider is available? | Engineer with account owner | Checkout adapter and end-to-end payment evidence, not independent foundation work |
| D6 · Product decision | Which additional language accompanies English? | Product Lead | Localization content and language-setting acceptance |
| T1 · Implementation tuning | Set link/token expiry, pool size, Redis primary-read window, cache TTL, retries, and health-check details from tests. | Engineer and Security reviewer | Final operational acceptance; not core scope |
| T2 · Product/operations decision | Set recovery time and recovery point objectives for database restore; approve proposed active-Staff and uptime definitions. | Product Lead and operations owner | Pilot and production recovery sign-off |

The foundation can proceed now. The full PRD becomes build-ready after D1–D6 and E1 have recorded outcomes; implementation tuning is measured rather than guessed. Flutterwave test mode remains first choice pending E1. PostgreSQL pooling, replica routing, read-your-own-writes, and `EXPLAIN ANALYZE` remain required verification work.
