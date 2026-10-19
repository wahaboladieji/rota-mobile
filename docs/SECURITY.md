# Rota Security Architecture & Threat Register (SECURITY.md)

This threat register records eight app-specific threats and defenses for Rota, in strict compliance with **Rota PRD v2 Section 7 (Security, sessions, and environment)**, **AGENTS.md**, and repository security standards.

---

## 1. Threat Register & Mitigations

### Threat 1: Authentication or Role Bypass
- **Attack & Likely Impact**: An unauthenticated actor or low-privilege Staff member bypasses the client UI (using direct HTTP tools like `curl`, Postman, or custom scripts) and submits requests to mutate shifts, approve swaps, invite team members, or modify team subscriptions. The impact includes shift destruction, unauthorized roster modification, and privilege escalation.
- **Affected Entry Points**:
  - `DELETE /api/teams/:teamId/shifts/:shiftId`
  - `POST /api/teams/:teamId/shifts`
  - `POST /api/teams/:teamId/swaps/:swapId/manager-decision`
  - `POST /api/teams/:teamId/invitations`
  - `DELETE /api/teams/:teamId/invitations/:invitationId`
  - `DELETE /api/teams/:teamId/members/:memberId`
  - `/api/teams/:teamId/billing/*`
- **Implemented Defense**:
  - `authenticate` middleware strictly validates the JWT access token and queries PostgreSQL Primary (`Session.findUnique`) to verify `session.revokedAt === null`.
  - `requireTeamMembership([allowedRoles])` resolves the caller's role directly on PostgreSQL Primary (`Membership.findUnique` with `teamId_userId`). Client-supplied roles in headers, cookies, or request bodies are completely ignored.
  - Operations restricted to Owner/Manager reject Staff with HTTP `403 Forbidden`.
  - Shifts cannot be self-approved for swaps (`swap.requesterId === userId` is explicitly rejected with `403`).
- **Exact Supporting Code Paths**:
  - [apps/backend/src/auth/guards.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/auth/guards.ts#L21-L125) (`authenticate`, `requireTeamMembership`)
  - [apps/backend/src/routes/shifts.routes.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/routes/shifts.routes.ts#L66-L70) (`POST /shifts`), [L456-L463](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/routes/shifts.routes.ts#L456-L463) (`DELETE /shifts/:shiftId`)
  - [apps/backend/src/routes/swaps.routes.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/routes/swaps.routes.ts#L339-L375) (`manager-decision`)
  - [apps/backend/src/routes/teams.routes.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/routes/teams.routes.ts#L182-L186) (`GET /billing`), [L435-L439](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/routes/teams.routes.ts#L435-L439) (`POST /payment/initiate`)
- **Test & Verification Evidence**:
  - `tests/teams_and_isolation.test.ts`: "rejects Staff direct request to delete/mutate a shift with 403 Forbidden"
  - `tests/teams_and_isolation.test.ts`: "allows Owner to access shift delete mutation endpoint and marks it CANCELLED"
  - `tests/teams_and_isolation.test.ts`: "enforces membership-specific role: Owner in Team A has only Staff rights in Team B"
- **Remaining Limitations & Status**: **Fully implemented and verified.**

---

### Threat 2: Cross-Team Data Access via Guessed UUIDs or Scope Tampering
- **Attack & Likely Impact**: An authenticated member of Team A attempts to view, edit, or delete Team B's shifts, swaps, member rosters, activity events, or billing records by substituting Team B's UUID in URL path parameters, request bodies, or headers. Impact includes multi-tenant data exposure and cross-tenant data corruption.
- **Affected Entry Points**: All `/api/teams/:teamId/*` routes (`/shifts`, `/swaps`, `/members`, `/invitations`, `/activity`, `/billing`).
- **Implemented Defense**:
  - Two-tier isolation on every server operation:
    1. **Boundary Gate**: `requireTeamMembership` verifies active membership in `:teamId` on PostgreSQL Primary. If the caller does not belong to the requested team, the server immediately returns `404 Not Found` (never 403), preventing attackers from probing whether the target team or resource ID exists.
    2. **Query Scoping**: Every database lookup, update, and delete includes an explicit `{ where: { teamId, id: resourceId } }` clause.
  - Linked resources (such as shift assignees or swap colleague members) are verified against `teamId` before any mutation is applied.
- **Exact Supporting Code Paths**:
  - [apps/backend/src/auth/guards.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/auth/guards.ts#L74-L95) (`requireTeamMembership` Primary membership resolution)
  - [apps/backend/src/routes/shifts.routes.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/routes/shifts.routes.ts#L26-L30) (team-scoped shift queries)
  - [apps/backend/src/routes/swaps.routes.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/routes/swaps.routes.ts#L29-L33) (team-scoped swap queries)
  - [apps/backend/src/routes/activity.routes.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/routes/activity.routes.ts#L74-L95) (team-scoped cursor pagination)
- **Test & Verification Evidence**:
  - `tests/teams_and_isolation.test.ts`: "returns 404 when querying an existing team user does not belong to (prevents leakage)"
  - `tests/teams_and_isolation.test.ts`: "rejects access from client-supplied fake or guessed team UUIDs with 404"
  - `tests/teams_and_isolation.test.ts`: "rejects cross-team write attempts with 404 and leaves foreign record unmodified"
- **Remaining Limitations & Status**: **Fully implemented and verified.**

---

### Threat 3: Malformed Input and Mass Assignment
- **Attack & Likely Impact**: Untrusted payloads containing unexpected fields (such as `role: "OWNER"`, `status: "ACTIVE"`, `paidSeatEntitlement: 100`, or `version: 99`) attempt to override privileged model attributes or bypass business checks. Malicious input strings attempt SQL injection.
- **Affected Entry Points**: All 24 mutation endpoints across auth, teams, shifts, swaps, preferences, and device registration.
- **Implemented Defense**:
  - Every incoming request body and query parameter is parsed and validated at runtime using strict Zod schemas (`safeParse`) before reaching domain services.
  - Unrecognized or privileged fields are stripped by schema validation; domain transactions extract only validated data (`parseResult.data`).
  - Zero raw SQL query string concatenation exists. Database interactions rely exclusively on parameterized Prisma ORM operations and reviewed PostgreSQL migrations.
- **Exact Supporting Code Paths**:
  - Packages: `@rota/shared/src/schemas/*`
  - Routes: `apps/backend/src/routes/*`
- **Test & Verification Evidence**:
  - `tests/auth.test.ts`: Rejects malformed passwords, duplicate emails, invalid token inputs.
  - `tests/billing_quotes_and_guards.test.ts`: Rejects invalid seat bounds and unrecognized plan codes.
  - `tests/activity_pagination.test.ts`: Rejects malformed cursor inputs with `400 Bad Request`.
- **Remaining Limitations & Status**: **Fully implemented and verified.**

---

### Threat 4: Session and Identity-Link Theft or Replay
- **Attack & Likely Impact**: An attacker steals or replays an expired, revoked, or already-used token (refresh token, invitation link, magic link, password reset code) to gain unauthorized account or team access.
- **Affected Entry Points**:
  - `POST /api/auth/refresh`
  - `POST /api/auth/magic-link/verify`
  - `POST /api/auth/password-reset/confirm`
  - `POST /api/invitations/:token/accept`
- **Implemented Defense**:
  - **Refresh Token Rotation**: Refresh tokens rotate on every use. A consumed token is marked `usedAt = now()`. Replay of an already-used token triggers immediate compromise detection, which revokes the entire token family (`familyId`) and terminates all active user sessions on Primary.
  - **Single-Use Identity Tokens**: Magic link tokens and password reset tokens are single-use, hashed at rest (`SHA-256`), and expire in 15 minutes.
  - **Invitation Binding & Capacity**: Team invitations are hashed at rest, bound to the invited email address, and accepted within a PostgreSQL serializable transaction that rechecks plan seat capacity.
  - **Secure Storage**: Mobile tokens (`accessToken`, `refreshToken`) are stored exclusively in `expo-secure-store`, never in `AsyncStorage`.
- **Exact Supporting Code Paths**:
  - [apps/backend/src/auth/tokens.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/auth/tokens.ts#L18-L40) (`hashToken`, `TOKEN_LIFETIMES`)
  - [apps/backend/src/routes/auth.routes.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/routes/auth.routes.ts#L159-L235) (refresh token rotation & reuse revocation)
  - [apps/backend/src/routes/invitations.routes.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/routes/invitations.routes.ts#L248-L389) (atomic invitation consumption)
  - [apps/frontend/src/state/authStore.ts](file:///Users/admin/Desktop/rota%20mobile/apps/frontend/src/state/authStore.ts#L36-L56) (`expo-secure-store`)
- **Test & Verification Evidence**:
  - `tests/auth.test.ts`: "detects refresh token reuse and immediately revokes token family (PRD F1.5)"
  - `tests/teams_and_isolation.test.ts`: "single-use accept and replay attempt rejected with 410"
- **Remaining Limitations & Status**: **Fully implemented and verified.**

---

### Threat 5: Endpoint Abuse, Brute Force, and Denial of Service
- **Attack & Likely Impact**: Attackers execute credential stuffing against login, spam password reset emails, rapidly generate invitations, or flood payment checkout initialization, causing service degradation or financial denial-of-service.
- **Affected Entry Points**:
  - `POST /api/auth/login`
  - `POST /api/auth/password-reset`
  - `POST /api/teams/:teamId/invitations`
  - `POST /api/teams/:teamId/payment/initiate`
  - All public and protected API routes.
- **Implemented Defense**:
  - Redis-backed distributed rate-limiting middleware (`apps/backend/src/middleware/rate-limiter.ts`) enforcing atomic counters (`INCR` + `EXPIRE`):
    - **Login**: 5 attempts per 15 minutes per IP + normalized email.
    - **Password Reset**: 3 attempts per 15 minutes per IP + normalized email.
    - **Invitations**: 15 invitations per hour per team + IP.
    - **Payment Initiation**: 10 attempts per hour per team.
    - **General API**: 200 requests per minute per IP (skipped during test runs).
  - Rejection behavior: Returns HTTP `429 Too Many Requests` with `Retry-After: N` header and descriptive JSON payload.
  - Proxy support: Uses `req.ip` behind `trust proxy: 1` with fallback to `x-forwarded-for`.
  - Outage behavior: Graceful fail-open on Redis timeout/unavailability with logger warnings to prevent locking out valid users during Redis blips.
- **Exact Supporting Code Paths**:
  - [apps/backend/src/middleware/rate-limiter.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/middleware/rate-limiter.ts) (`createRateLimiter`, specific limiters)
  - [apps/backend/src/app.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/app.ts#L20-L25) (`generalApiRateLimiter`, `trust proxy`)
  - [apps/backend/src/routes/auth.routes.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/routes/auth.routes.ts#L100,L393) (`loginRateLimiter`, `passwordResetRateLimiter`)
  - [apps/backend/src/routes/teams.routes.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/routes/teams.routes.ts#L435,L853) (`paymentInitiateRateLimiter`, `invitationsRateLimiter`)
- **Test & Verification Evidence**:
  - `tests/rate_limiting.test.ts`: "allows requests within the limit and includes X-RateLimit headers"
  - `tests/rate_limiting.test.ts`: "enforces shared Redis limit across sequential requests and returns HTTP 429 when exhausted"
  - `tests/rate_limiting.test.ts`: "verifies distributed Redis state is shared across requests targeting the same namespace"
  - `tests/rate_limiting.test.ts`: "resets and allows requests again once the rate-limit window expires or key is cleared"
- **Remaining Limitations & Status**: **Fully implemented and verified.**

---

### Threat 6: Exposed Secrets and Mobile Bundle Leakage
- **Attack & Likely Impact**: Privileged credentials (Flutterwave secret keys, PostgreSQL database URLs, Redis passwords, JWT signing keys) leak through source control, environment templates, mobile app bundles, or client logs. An attacker decompiles the mobile APK to extract keys, leading to total database compromise or fraudulent transactions.
- **Affected Entry Points**: Mobile bundle assets, Git repository, environment files, error responses, application logs.
- **Implemented Defense**:
  - Zero server secrets exist in `apps/frontend/`. Privileged billing actions occur exclusively through server endpoints.
  - The only public mobile environment variable is `EXPO_PUBLIC_API_URL` (points to backend host/port).
  - Production secrets and tokens are loaded strictly on the backend via server `.env`.
  - Application logger redacts passwords, tokens, authorization headers, and payment card details before console output.
  - Global Express error handler suppresses stack traces and returns generic `500 Internal server error` with correlation `requestId`.
- **Exact Supporting Code Paths**:
  - [apps/backend/src/observability/logger.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/observability/logger.ts#L11-L30) (field redaction)
  - [apps/backend/src/app.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/app.ts#L69-L73) (global error handler)
  - [apps/frontend/.env.example](file:///Users/admin/Desktop/rota%20mobile/apps/frontend/.env.example) (public configuration template)
- **Test & Verification Evidence**:
  - Static repository scan for keywords (`secret`, `FLW_`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`) confirms zero leaks in `apps/frontend/src`.
  - Frontend typecheck and build profiles verified.
- **Remaining Limitations & Status**: **Fully implemented and verified.**

---

### Threat 7: Forged or Repeated Payment Webhooks and Callbacks
- **Attack & Likely Impact**: An adversary crafts fake webhook requests claiming successful payment or replays an intercepted checkout return to fraudulently activate paid subscription tiers or generate duplicate ledger rows.
- **Affected Entry Points**:
  - `POST /api/webhooks/flutterwave`
  - `GET /api/payment/callback`
- **Implemented Defense**:
  - **Cryptographic Signature Verification**: Incoming webhooks must supply a matching `verif-hash` header verified with constant-time string comparison against `FLW_WEBHOOK_HASH`. Invalid signatures are rejected with `401 Unauthorized`.
  - **Durable Idempotency**: Webhook receipts are committed to `WebhookEvent` with a unique constraint on `(provider, providerEventId)`. Replay attempts return `200 duplicate_acknowledged` without re-processing.
  - **Independent Provider Re-check**: A BullMQ worker (`paymentWebhookQueue`) independently queries the Flutterwave API to verify transaction status (`successful`), currency (`USD`), amount, and `txRef` before updating the subscription or ledger.
  - **Append-Only Financial Ledger**: `LedgerEntry` rows cannot be updated or deleted. Database triggers and privilege restrictions guarantee an immutable audit trail.
  - **Hosted Redirect Isolation**: The checkout return callback (`/api/payment/callback`) does not activate access from URL parameters; it triggers server verification and deep-links to the mobile app, which queries the server-verified status.
- **Exact Supporting Code Paths**:
  - [apps/backend/src/routes/webhooks.routes.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/routes/webhooks.routes.ts#L14-L62) (signature check & durable idempotency)
  - [apps/backend/src/domain/payment-settlement.service.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/domain/payment-settlement.service.ts#L60-L150) (independent API verification & ledger effect)
  - [apps/backend/src/routes/payment-callback.routes.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/routes/payment-callback.routes.ts#L27-L40) (server-settled return callback)
- **Test & Verification Evidence**:
  - `tests/payment_flutterwave.test.ts`: "rejects webhook with missing or invalid verif-hash signature with 401"
  - `tests/payment_flutterwave.test.ts`: "idempotently acknowledges duplicate webhook without duplicate processing"
  - `tests/payment_flutterwave.test.ts`: "verifies transaction with Flutterwave API and activates subscription"
- **Remaining Limitations & Status**: **Fully implemented and verified.**

---

### Threat 8: Push Notification Token, Cache, and Log Leakage
- **Attack & Likely Impact**: Former team members retain active push tokens and receive private shift updates after removal. Notifications violate user quiet hours or leak sensitive personal data.
- **Affected Entry Points**:
  - `POST /devices/push-token`
  - `DELETE /devices/push-token`
  - Push notification background queue & worker.
- **Implemented Defense**:
  - **Immediate Token Revocation on Removal**: When a member is removed (`DELETE /api/teams/:teamId/members/:memberId`), all device registrations for that user are immediately invalidated (`invalidatedAt = now()`, `pushToken = null`).
  - **Send-Time Evaluation**: Background push jobs re-verify user notification settings, active team membership, quiet hours, and recipient time zone at send time. A disabled notification group always wins and blocks delivery, even for shifts starting within 12 hours. Urgent changes for shifts starting within 12 hours bypass quiet hours; all other messages are deferred until quiet hours end.
  - **Deep Link Re-authorization**: When a user opens a push deep link, the mobile app re-authenticates and verifies active membership before displaying protected shift or swap data.
- **Exact Supporting Code Paths**:
  - [apps/backend/src/routes/teams.routes.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/routes/teams.routes.ts#L1038-L1043) (immediate token deletion on member removal)
  - [apps/backend/src/jobs/worker.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/jobs/worker.ts#L70-L210) (send-time preference, quiet hours, and membership checks)
  - [apps/backend/src/routes/devices.routes.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/src/routes/devices.routes.ts#L27-L109) (token registration and explicit deletion)
- **Test & Verification Evidence**:
  - `tests/notifications_and_settings.test.ts`: "delivers push notification when group is enabled and outside quiet hours"
  - `tests/notifications_and_settings.test.ts`: "delays non-urgent notification during quiet hours"
  - `tests/notifications_and_settings.test.ts`: "bypasses quiet hours for urgent shift update within 12 hours"
  - `tests/teams_and_isolation.test.ts`: "immediately revokes access and sessions when a member is removed from a team"
- **Remaining Limitations & Status**: **Fully implemented and verified.**

---

## 2. Public Environment Variables Inventory

| Variable Name | Referencing Locations | Purpose | Justification for Public Exposure | Security Controls & Restrictions |
|---|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | [apps/frontend/src/config/index.ts:L15](file:///Users/admin/Desktop/rota%20mobile/apps/frontend/src/config/index.ts#L15)<br/>[apps/frontend/.env:L1](file:///Users/admin/Desktop/rota%20mobile/apps/frontend/.env#L1) | Specifies the backend API base URL for mobile network requests. | Safe to disclose. Contains exclusively a destination host and port (`http://192.168.0.165:3000` or production URL). Contains zero API keys, secrets, or privileged credentials. | Must point to an accessible network address for physical Android devices and development builds. |
| `EXPO_PUBLIC_SENTRY_DSN` | [apps/frontend/src/config/index.ts:L20](file:///Users/admin/Desktop/rota%20mobile/apps/frontend/src/config/index.ts#L20)<br/>[apps/frontend/.env.example:L5](file:///Users/admin/Desktop/rota%20mobile/apps/frontend/.env.example#L5) | Configures Sentry client-side error and crash telemetry. | Safe to disclose. A Sentry DSN is designed by Sentry for public client disclosure; it can only submit crash events and grants no administrative or read access. | Blank in local development; configured during production EAS builds. |

---

## 3. Redis Rate-Limiting Policy & Outage Behavior

| Endpoint Category | Route Pattern | Window & Max Requests | Key Construction Strategy | Outage / Failure Behavior |
|---|---|---|---|---|
| **Login** | `POST /api/auth/login` | 5 attempts per 15 minutes | `rl:login:${clientIp}:${normalizedEmail}` | Fail open with logger warning |
| **Password Reset** | `POST /api/auth/password-reset` | 3 requests per 15 minutes | `rl:reset:${clientIp}:${normalizedEmail}` | Fail open with logger warning |
| **Invitations** | `POST /api/teams/:teamId/invitations` | 15 invitations per hour | `rl:invite:${teamId}:${clientIp}` | Fail open with logger warning |
| **Payment Initiation** | `POST /api/teams/:teamId/payment/initiate` | 10 attempts per hour | `rl:payment_init:${teamId}` | Fail open with logger warning |
| **General API** | All routes | 200 requests per minute | `rl:general:${clientIp}` | Fail open; bypassed when `NODE_ENV=test` |

- **HTTP Rejection**: Returns HTTP status code `429 Too Many Requests` with response headers:
  - `Retry-After: <seconds>`
  - `X-RateLimit-Limit: <max>`
  - `X-RateLimit-Remaining: 0`
  - `X-RateLimit-Reset: <unix_epoch_timestamp>`
- **Atomic Operations**: Employs Redis `INCR` followed by `EXPIRE` on first creation to prevent race conditions without external locks.
- **Reverse Proxy Support**: Express configured with `app.set('trust proxy', 1)`. Normalizes `req.ip` and falls back to `x-forwarded-for`.

---

## 4. Required Security Test Matrix (14/14 Verified)

| # | Security Invariant Test | Automated Test Location | Execution Result |
|---|---|---|---|
| 1 | Missing authentication rejection | [tests/auth.test.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/tests/auth.test.ts) | **PASSED** (401 Unauthorized) |
| 2 | Staff permission bypass on shift delete | [tests/teams_and_isolation.test.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/tests/teams_and_isolation.test.ts) | **PASSED** (403 Forbidden) |
| 3 | Authorized Owner positive control | [tests/teams_and_isolation.test.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/tests/teams_and_isolation.test.ts) | **PASSED** (200 OK, shift marked CANCELLED) |
| 4 | Cross-team read access denial | [tests/teams_and_isolation.test.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/tests/teams_and_isolation.test.ts) | **PASSED** (404 Not Found) |
| 5 | Cross-team write access denial | [tests/teams_and_isolation.test.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/tests/teams_and_isolation.test.ts) | **PASSED** (404 Not Found, record unchanged) |
| 6 | Team-ID tampering | [tests/teams_and_isolation.test.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/tests/teams_and_isolation.test.ts) | **PASSED** (404 Not Found) |
| 7 | Membership-specific role isolation | [tests/teams_and_isolation.test.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/tests/teams_and_isolation.test.ts) | **PASSED** (Owner in A has only Staff rights in B; 403 Forbidden) |
| 8 | Removed member session revocation | [tests/teams_and_isolation.test.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/tests/teams_and_isolation.test.ts) | **PASSED** (Immediate 401/404 on subsequent requests) |
| 9 | Invalid payload and mass assignment | [tests/auth.test.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/tests/auth.test.ts), [tests/billing_quotes_and_guards.test.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/tests/billing_quotes_and_guards.test.ts) | **PASSED** (400 Bad Request, no state mutation) |
| 10 | Distributed rate limit enforcement | [tests/rate_limiting.test.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/tests/rate_limiting.test.ts) | **PASSED** (429 Too Many Requests after 5 attempts) |
| 11 | Rate-limit window expiry & reset | [tests/rate_limiting.test.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/tests/rate_limiting.test.ts) | **PASSED** (Requests accepted after TTL expiry) |
| 12 | Payment webhook authenticity | [tests/payment_flutterwave.test.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/tests/payment_flutterwave.test.ts) | **PASSED** (401 on forged signature) |
| 13 | Duplicate payment idempotency | [tests/payment_flutterwave.test.ts](file:///Users/admin/Desktop/rota%20mobile/apps/backend/tests/payment_flutterwave.test.ts) | **PASSED** (Duplicate acknowledged without duplicate ledger row) |
| 14 | Mobile secret exclusion | Static codebase scan & `.env.example` audit | **PASSED** (Zero server credentials in mobile bundle) |
