# Rota Settings Coordination & Synchronization Specification

## 1. Overview & PRD Alignment

Rota's settings system (PRD F7.2, F7.3, Section 7) provides multi-device settings coordination with server-side authority. Settings govern user quiet hours, time zones, notification group toggles, theme, and language.

The server is the authoritative source of truth. All client updates synchronize through REST endpoints (`GET`, `PUT`, `PATCH /api/settings`), use granular per-field timestamps for deterministic conflict resolution, and support optimistic client updates with rollback on network or validation failures.

---

## 2. Server Authority & Per-Field Timestamps

### 2.1 Data Model (`UserSetting`)
The PostgreSQL `UserSetting` model stores the following attributes:
- `userId`: Unique reference to `User.id` (1:1 relation).
- `quietStart`: String in `HH:mm` format (e.g. `'22:00'`).
- `quietEnd`: String in `HH:mm` format (e.g. `'07:00'`).
- `timeZone`: IANA timezone identifier (e.g. `'Africa/Lagos'`, `'UTC'`).
- `shiftPush`: Boolean flag for shift notifications (default `true`).
- `swapPush`: Boolean flag for swap notifications (default `true`).
- `billingPush`: Boolean flag for billing alerts (default `true`).
- `theme`: Enum `'system' | 'light' | 'dark'` (default `'system'`).
- `language`: Supported language code (default `'en'`).
- `fieldUpdatedAt`: JSON dictionary tracking ISO-8601 update timestamps per field:
  ```json
  {
    "quietHours": "2026-10-18T14:00:00.000Z",
    "quietStart": "2026-10-18T14:00:00.000Z",
    "quietEnd": "2026-10-18T14:00:00.000Z",
    "timeZone": "2026-10-18T14:00:00.000Z",
    "shiftPush": "2026-10-18T14:00:00.000Z",
    "swapPush": "2026-10-18T14:00:00.000Z",
    "billingPush": "2026-10-18T14:00:00.000Z",
    "theme": "2026-10-18T14:00:00.000Z",
    "language": "2026-10-18T14:00:00.000Z"
  }
  ```

---

## 3. Conflict Resolution Strategy

### 3.1 Independent Field Updates (Field Independence)
When Device A updates one setting (e.g. `quietStart: '23:00'`) and Device B concurrently updates a different setting (e.g. `theme: 'light'`), the server merges the changes cleanly:
- Device A's write updates only `quietStart` and its corresponding `fieldUpdatedAt.quietStart`.
- Device B's write updates only `theme` and its corresponding `fieldUpdatedAt.theme`.
- Neither device clobbers or resets the other device's independent settings.

### 3.2 Same-Field Conflict Resolution (Latest-Accepted-Write Wins)
When two devices simultaneously or sequentially attempt to update the same field:
- The server processes each atomic write transaction on PostgreSQL Primary.
- The latest transaction accepted by the server becomes the authoritative state.
- Its timestamp is stamped in `fieldUpdatedAt[key] = new Date().toISOString()`.
- Subsequent reads by all devices receive the latest accepted state.

---

## 4. Mobile Client Integration & Optimistic Rollback

### 4.1 State Architecture
- **Server Data Ownership:** TanStack Query (`QUERY_KEYS.SETTINGS`) owns cached settings with zero background stale pollution.
- **Client-Only UI State:** Zustand owns purely ephemeral client UI states (e.g. active tab, draft toggles).
- **Foreground Synchronization:** The app registers an `AppState` listener in `App.tsx` that triggers `queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SETTINGS })` whenever the application resumes from background to active.

### 4.2 Optimistic UI Updates & Error Rollback
When the user toggles a preference or edits quiet hours in `SettingsPreferencesScreen.tsx`:
1. `onMutate`:
   - Cancels any outgoing settings queries.
   - Snapshots the previous settings via `queryClient.getQueryData(QUERY_KEYS.SETTINGS)`.
   - Optimistically writes the new settings into TanStack Query cache.
2. `onError`:
   - Reverts the TanStack Query cache back to the snapshotted state.
   - Displays a user-facing toast / alert indicating that the update could not be saved.
3. `onSettled`:
   - Re-invalidates `QUERY_KEYS.SETTINGS` to ensure complete consistency with PostgreSQL Primary.

---

## 5. Security & Boundary Guards

- **Strict Server Validation:** All inputs are parsed and validated via Zod (`UserSettingsPatchSchema`). Invalid formats (such as `'not-a-valid-time'` or `'99:99'`) are rejected with HTTP 400 Validation Error before touching the database.
- **Tenant & User Isolation:** All settings operations are scoped to the authenticated `req.user.userId`. Users cannot view or modify another user's preferences.
- **Token Independence:** Settings are never stored in tokens or unencrypted storage.
