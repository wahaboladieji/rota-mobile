---
name: mobile-state-and-offline-flow
description: Build or change a Rota React Native screen that reads or mutates server data or the offline upcoming-shift view. Load before defining queries and mutations; work through ownership, query keys, invalidation, optimistic rollback, offline partitioning, and reconnect verification.
---

# Mobile state and offline flow

1. Read the affected PRD F requirement, F5, `AGENTS.md`, `coding-standards.md`, and `STATE.md` if present. Inventory each data item and decide whether it is server data, UI-only state, SecureStore token, or the permitted offline shift snapshot. Do not duplicate server truth in Zustand.
2. Define TanStack Query keys with account and team where applicable, fetches, stale and garbage-collection times, foreground/reconnect behavior, and invalidation after each write. Follow PRD F5's starting stale times and document tuning in `STATE.md`. Keep subscription and settings freshness rules.
3. Define mutations from the server contract. For a supported optimistic swap or settings change, snapshot prior data, prevent duplicate submission, apply a provisional view, roll back on failure, and reconcile or invalidate after server confirmation. Do not show a failed mutation as completed.
4. For offline upcoming shifts only, persist the next 14 days through the TanStack Query persister with AsyncStorage, partitioned by signed-in account and team. Include last-successful-sync time. Keep tokens in `expo-secure-store`; never queue an offline write or imply a stale snapshot is current. Clear snapshots on logout/team departure and on learned revocation.
5. Render loading, empty, error, reconnect, and unavailable-offline states relevant to the screen. Use FlashList and cursor pages for the feed; merge by event ID and prevent duplicate requests under rapid scroll.
6. Test account/team switching, offline/online transitions, stale data, optimistic failure, foreground refetch, and duplicate action prevention. Update `STATE.md` with ownership, cache, persistence, and rollback evidence.

Do not implement D2/D3 swap outcomes or D6 language content until the corresponding decision is recorded.