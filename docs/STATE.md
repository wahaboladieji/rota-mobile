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
