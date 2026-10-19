# Rota State Ownership and Persistence Architecture (STATE.md)

This document maps data ownership, caching, freshness policies, and failure strategies across the Rota system, following PRD v2 F5.

## 1. Data Ownership Classification

| Data Category | Authority / Owner | Storage Mechanism | Freshness / Stale Window | Invalidation Trigger |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication & Sessions** | Server | `expo-secure-store` (tokens) / PostgreSQL (sessions) | Short-lived access token; rotating refresh token | Logout, refresh token reuse, session revocation |
| **Memberships & Roles** | Server | TanStack Query / PostgreSQL | 5 minutes (roster) | Team switch, member removal, invite accept |
| **Upcoming Shifts** | Server | TanStack Query / PostgreSQL | 60 seconds (calendar) | Shift creation/edit/publish, swap approval |
| **Offline Shift Snapshot** | Client Snapshot | AsyncStorage (TanStack persister) | Next 14 days; timestamped | Logout, team departure, network sync |
| **Swap Requests** | Server | TanStack Query / PostgreSQL | Real-time refetch on action | Swap creation, colleague decision, manager approval |
| **Activity Feed** | Server | TanStack Query / PostgreSQL | 30 seconds | Feed pull-to-refresh, new page fetch |
| **Client UI State** | Client (Local only) | Zustand Store | Ephemeral (Session lifetime) | Tab navigation, team switcher, modal close |
| **Subscription & Billing** | Server | PostgreSQL Primary ONLY | 0 seconds (Immediate fetch) | Checkout completion, webhook event |
| **User Settings** | Server | TanStack Query / PostgreSQL | App foreground / on-demand | Settings update mutation |

## 2. Server vs Client State Rules
- **Server Data Ownership**: TanStack Query owns all server-derived data (shifts, rosters, swaps, settings).
- **Client State Ownership**: Zustand is restricted strictly to shared client-only UI state (e.g. `selectedTeamId`, `activeTab`, `filterState`, `optimisticDraft`). Zustand NEVER stores server authorization truth or copies of pricing models.
- **Token Security**: Tokens are NEVER placed in Zustand, AsyncStorage, or logs. Mobile tokens reside exclusively in `expo-secure-store`.
- **Financial State Protection**: Redis is never used to cache active subscriptions, payment status, credit balances, or idempotency keys. All financial truth is fetched from PostgreSQL Primary.

## 3. Offline Data Partitioning
- Persistence is strictly limited to the next 14 days of upcoming shifts.
- Storage keys are explicitly partitioned: `rota_offline_shifts_${userId}_${teamId}`.
- Every offline view prominently displays the `lastSuccessfulSync` timestamp.
- On logout or departure from a team, all offline shift snapshots for that account/team are instantly purged.

## 4. Activity Feed Pagination & Deduplication (PRD F4, F5.1)
- **Pagination Model**: Server cursor pagination using an opaque base64 cursor encoding `(createdAt, id)` in deterministic descending order.
- **Client State**: Owned by TanStack Query `useInfiniteQuery` with a 30-second stale time.
- **Deduplication**: Multi-page items are merged by unique `item.id` to guarantee no duplicated items upon cursor page merges.
- **Rapid Scroll Protection**: `onEndReached` is protected by `isFetchingNextPage` and `isFetchNextPageError` gates to prevent overlapping requests for the same next page.
- **Pull-to-Refresh**: Initiates a clean page 1 refetch and cancels older in-flight requests, avoiding feed corruption.
- **Error & Resilience**: Next-page failures preserve previously fetched items and provide an inline retry action.

## 5. Payment Lifecycle & Audit Logs (PRD F6, Section 8, 10)
- **Lifecycle Partitioning**:
  1. `PaymentAttempt`: Tracks gateway reference, idempotency keys, and payment status (`PENDING`, `VERIFIED`, `FAILED`).
  2. `WebhookEvent`: Stores raw webhook events, guaranteeing unique identity receipt (`providerEventId`) before HTTP acknowledgment.
  3. `PaymentLog`: Explicit 4-stage audit log tracking payment progression:
     - `USER_INITIATED`: When user begins checkout and generates hosted session.
     - `PROVIDER_COLLECTED`: When Flutterwave successfully collects payment funds.
     - `WEBHOOK_RECEIVED`: When the signed webhook notification arrives at the server.
     - `USER_PAID`: When payment is re-verified via API and subscription is activated.
  4. `LedgerEntry`: Append-only financial record (`CHARGE`, `CREDIT`, `REFUND`, `STATE_CHANGE`) with database trigger forbidding `UPDATE` and `DELETE`.
- **Financial Authority**: PostgreSQL Primary is the single authority; no financial state is cached in Redis.

## 6. Push Notification & Device Lifecycle State (PRD F7, Section 7)
- **Device Token Authority**: Stored in PostgreSQL `Device` table, bound to `userId`. Multiple devices per user are retained.
- **Idempotency & Rotation**: Registering an existing token updates `lastSeenAt`. Providing `oldPushToken` sets `invalidatedAt = now()` on the old token while preserving other user devices.
- **Queue & Worker Architecture**: BullMQ queue `rota_push_notifications` backed by Redis with exponential backoff (3 attempts, 1500ms delay).
- **Send-Time Evaluation**: Worker checks active team membership (`Membership.status == 'ACTIVE'`), notification group preference (`shiftPush`, `swapPush`, `billingPush`), quiet hours (`[quietStart, quietEnd)` in recipient's `timeZone`), and urgency exception (`< 12h` future shift).
- **Token Invalidation**: Tickets returning `DeviceNotRegistered` or `InvalidCredentials` set `invalidatedAt = now()` for that specific device token.

## 7. User Settings Coordination & Conflict Resolution (PRD F7.2, F7.3)
- **Server Authority**: Stored in PostgreSQL `UserSetting` table. Server is the single authority for user preferences, time zone, theme, language, and quiet hours.
- **Freshness Policy**: TanStack Query (`QUERY_KEYS.SETTINGS`) caches settings on mobile. Refetched on app foreground resume (`AppState` listener) and launch.
- **Granular Timestamps**: Server maintains `fieldUpdatedAt` JSON dictionary with ISO-8601 timestamps per field.
- **Conflict Resolution**:
  - Independent fields merge cleanly without clobbering other settings.
  - Same-field concurrent writes resolve via latest server-accepted write wins.
- **Optimistic UI & Rollback**: Mobile client applies optimistic cache updates on mutation and cleanly rolls back on network error or validation failure (400).
- **Dark Mode & Appearance State**: Resolves between user server setting ('LIGHT' | 'DARK' | 'SYSTEM') and device system appearance. `ThemeProvider` applies high-contrast WCAG 2.1 AA/AAA dark palette with reverse tonal elevation ramp and dynamic status bar styling.

## 8. Server-Side Cache-Aside Architecture (Redis)

The backend employs a strict cache-aside pattern via `apps/backend/src/services/cache.service.ts` for read-heavy non-financial data with bounded TTLs and explicit invalidation upon mutation.

### What is Cached:
| Data Type | Cache Key Pattern | TTL | Invalidation Trigger |
| :--- | :--- | :---: | :--- |
| **Team Metadata** | `cache:team:${teamId}:meta` | 60 seconds (PRD A6) | Team details update (`PATCH /api/teams/:teamId`) |
| **User Profile / Memberships** | `cache:user:${userId}:me` | 120 seconds | Team creation, member removal, invitation accepted |
| **User Settings** | `cache:settings:${userId}` | 300 seconds | User settings update (`PUT` / `PATCH /api/settings`) |
| **Availability Preferences** | `cache:prefs:${teamId}:${userId}` | 300 seconds | Preference save or delete (`POST` / `DELETE /preferences`) |
| **Subscription Plans Catalog** | `cache:plans` | 3600 seconds (1 hr) | Static plan configuration changes |

### What is NEVER Cached:
Per AGENTS.md Rule 12 and PRD Section 7, the following categories are **strictly prohibited** from Redis caching and must always be queried directly from PostgreSQL Primary:
- **Active Subscriptions & Paid Seat Entitlement** (`Subscription`)
- **Payment Status & Transactions** (`PaymentAttempt`)
- **Credit Balances & Proration Records**
- **Append-Only Financial Ledger Entries** (`LedgerEntry`)
- **Payment Progression Audit Logs** (`PaymentLog`)
- **Webhook Idempotency Records & Events** (`WebhookEvent`)
- **Authentication Tokens & Session Revocations** (`Session`, `RefreshToken`)

*Enforcement:* The `assertCacheKeyPermitted()` guard automatically throws an immediate runtime security error if any key contains `subscription`, `billing`, `payment`, `ledger`, `credit`, `webhook`, or `idempotency`.

## 9. Distributed Rate Limiting Architecture (Redis)

Rate limiting is enforced at the network boundary using Redis-backed distributed counters in `apps/backend/src/middleware/rate-limiter.ts`:
- **Atomic Operations:** Uses a single-roundtrip Redis Lua script (`RATE_LIMIT_LUA`) executing atomic `INCR` + `EXPIRE` + `TTL`. No keys can leak without expiration.
- **Dual-Tier & Multi-Dimensional Scoping:**
  - Authenticated requests are bounded by **both** user ID (`user:${userId}`) and IP address (`ip:${ip}`).
  - Unauthenticated requests are bounded by IP address (`ip:${ip}`).
  - Auth endpoints (login, password reset) enforce dual-key checking across normalized email and client IP to prevent both targeted account spraying and distributed botnet credential stuffing.
- **Strict Route Budgets:**
  - `POST /api/auth/login`: 5 requests / 15 minutes (`RL_LOGIN_MAX=5`)
  - `POST /api/auth/password-reset` & `/magic-link`: 3 requests / 15 minutes (`RL_RESET_MAX=3`)
  - `POST /api/teams/:teamId/billing/initiate`: 10 requests / 1 hour (`RL_PAY_MAX=10`)
  - `POST /api/teams/:teamId/invitations`: 15 requests / 1 hour (`RL_INVITE_MAX=15`)
  - Global API Limiter: 200 requests / 1 minute (`RL_GENERAL_MAX=200`)
- **HTTP Headers:** Emits `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After`. Returns HTTP 429 with real-time countdown `retryAfterSeconds`.

## 10. Background Job & Queue Architecture (BullMQ)

All slow, unreliable, or third-party operations are decoupled from HTTP request lifecycles and dispatched via BullMQ Redis queues (`apps/backend/src/jobs/queue.ts`):
1. **`rota_emails`:**
   - Handles magic links, password resets, verification codes, team invitations, and shift notification emails (`SHIFT_NOTIFICATION`).
   - Configured with **5 attempts**, **exponential backoff** (initial delay 3,000ms), and **failed list retention** (`removeOnFail: 500`).
2. **`rota_push_notifications`:**
   - Handles shift changes, shift cancellations, swap approvals/rejections, and billing alerts.
   - Evaluates quiet hours, recipient timezone, urgency (< 12h), and active membership at send-time in `apps/backend/src/jobs/worker.ts`.
   - Configured with **3 attempts**, **exponential backoff** (initial delay 1,500ms), and **failed list retention** (`removeOnFail: 500`).
3. **`rota_payment_webhooks`:**
   - Ingests Flutterwave webhooks, persists durable `WebhookEvent` in PostgreSQL with HTTP 200 acknowledgment, and queues background transaction re-verification and ledger settlement.
   - Configured with **5 attempts**, **exponential backoff** (initial delay 2,000ms), and **failed list retention** (`removeOnFail: 500`).

