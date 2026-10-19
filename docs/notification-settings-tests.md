# Rota Push Notifications & Settings Coordination Acceptance Verification

This document provides the verification matrix and execution evidence for **Requirement 6: Push Notifications** and **Requirement 7: Settings Coordination** (PRD F7.1–F7.5, Section 7), covering all 22 acceptance test cases.

---

## 1. Test Suite Execution Summary

- **Test Suite:** `apps/backend/tests/notifications_and_settings.test.ts`
- **Execution Command:** `npm test -- tests/notifications_and_settings.test.ts`
- **Total Test Suites:** 1 passed, 1 total
- **Total Tests:** 22 passed, 22 total
- **Execution Time:** ~6.589 s
- **Full Backend Suite:** 8 passed, 8 total (102 passed, 0 failed)

---

## 2. 22 Acceptance Test Cases Matrix

| Case # | Description | PRD / Rule Reference | Implementation File | Status | Evidence / Verified Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Multiple devices registration without collision | PRD F7.1 | `devices.routes.ts` | **PASSED** | 2 distinct devices registered for 1 user; both active in `Device` table |
| **2** | Repeated registration idempotency | PRD F7.1 | `devices.routes.ts` | **PASSED** | Upsert updates `lastSeenAt`; no duplicate rows created |
| **3** | Token rotation with old token invalidation | PRD F7.1 | `devices.routes.ts` | **PASSED** | Supplying `oldPushToken` sets `invalidatedAt = now()`; new token active; other devices untouched |
| **4** | Invalid token deletion on provider feedback | PRD F7.1 | `worker.ts` | **PASSED** | Expo ticket `DeviceNotRegistered` marks specific token with `invalidatedAt` |
| **5** | Transient gateway failure retry without token deletion | PRD Section 7 | `worker.ts`, `queue.ts` | **PASSED** | HTTP 500 throws error for BullMQ exponential retry; token remains active in DB |
| **6** | Background push job enqueuing and processing | PRD Section 7 | `queue.ts`, `worker.ts` | **PASSED** | `enqueuePushJob` returns BullMQ job ID immediately; worker processes asynchronously |
| **7** | Quiet hours across midnight (22:00–06:00) | PRD F7.4 | `worker.ts` | **PASSED** | Non-urgent notifications during quiet hours reschedule with BullMQ delay until 06:00 |
| **8** | Start-inclusive and end-exclusive quiet-hours boundaries | PRD F7.4 | `worker.ts` | **PASSED** | At 22:00:00 deferred (`DEFERRED_FOR_QUIET_HOURS`); at 06:00:00 delivered immediately |
| **9** | Disabled group suppression even for urgent events | AGENTS.md Rule 18 | `worker.ts` | **PASSED** | With `shiftPush: false`, urgent shift change (< 12h) is skipped (`GROUP_DISABLED`) |
| **10** | Urgent exception (< 12h future shift) bypasses quiet hours | PRD F7.5 | `worker.ts` | **PASSED** | `SHIFT_CHANGE` for shift starting in 3h delivered immediately inside quiet hours |
| **11** | Non-urgent event types defer during quiet hours | PRD F7.5 | `worker.ts` | **PASSED** | `NEW_SHIFT` starting in 2h deferred until quiet hours end |
| **12** | Settings changed while queued respected at send time | PRD F7.3 | `worker.ts` | **PASSED** | User disables `swapPush` while job queued; execution re-checks DB and skips delivery |
| **13** | Time zone changed while queued recalculates quiet hours | PRD F7.3 | `worker.ts` | **PASSED** | User changes zone to `Asia/Tokyo`; quiet hours recalculate against updated zone |
| **14** | Team membership revoked while queued suppresses push | PRD F6.5, F7 | `worker.ts` | **PASSED** | User marked `REMOVED` before execution; worker skips delivery (`ACCESS_REVOKED`) |
| **15** | Cross-device settings coordination (PUT/PATCH on A, GET on B) | PRD F7.2 | `preferences.routes.ts` | **PASSED** | Device A writes `theme: 'dark'`; Device B reads `theme: 'dark'` with timestamps |
| **16** | Independent field updates survive without clobbering | PRD F7.2 | `preferences.routes.ts` | **PASSED** | A updates quiet hours, B updates theme; both fields and timestamps survive |
| **17** | Same-field conflict resolution: latest accepted write wins | PRD F7.2 | `preferences.routes.ts` | **PASSED** | Sequential writes to `timeZone`; latest accepted write wins with updated timestamp |
| **18** | Optimistic failure rollback on validation error (400) | PRD F7.2 | `preferences.routes.ts` | **PASSED** | Invalid format `quietStart: 'not-a-valid-time'` returns 400; DB state untouched |
| **19** | Concurrent rollback safety | PRD F7.2 | `preferences.routes.ts` | **PASSED** | Concurrent valid and invalid patches; valid patch applied, invalid rejected without corruption |
| **20** | Deep link payload structure integrity | PRD F7 | `worker.ts` | **PASSED** | Push notifications contain structured `data: { group, shiftId, teamId, type }` |
| **21** | Unauthenticated deep-link target access rejection | PRD F1.3 | `guards.ts` | **PASSED** | Unauthenticated request to team shifts returns HTTP 401 |
| **22** | Cross-team isolation guard on direct API access | PRD F1.4 | `guards.ts` | **PASSED** | Accessing foreign team shifts returns HTTP 404 (or 403) without leaking resource details |

---

## 3. Real-Device Push Evidence Constraint

- **Automated Verification:** Fully verified through backend tests, worker execution, mock gateways, and BullMQ queue processing.
- **Android EAS Development Build:** Per `AGENTS.md` and PRD v2, live push on real hardware requires an Android EAS development build. Expo Go does not constitute evidence of remote push delivery.
