# Rota Security Architecture & Threat Register (SECURITY.md)

This threat register records eight app-specific threats and mitigations for Rota, aligning with PRD v2 F1, F6, F7, and Section 7.

## 1. Threat Register & Mitigations

### Threat 1: Cross-Team Data Leakage via Guessed UUIDs
- **Vector**: An authenticated Staff member guesses or captures a UUID belonging to another team (shift ID, team ID, swap request ID) and submits direct API requests.
- **Impact**: Unauthorized exposure or tampering with another team's schedule or roster.
- **Mitigation**: Every server query and mutation resolves the caller's active `(teamId, userId)` membership on PostgreSQL primary. Every query includes an explicit `WHERE teamId = :authorizedTeamId` constraint. Cross-team requests return `404 Not Found` without disclosing existence or details.

### Threat 2: Role Escalation via Hidden UI or Tampered Request Payloads
- **Vector**: A Staff member sends a direct HTTP request attempting to delete a shift, approve a swap, or invite members with `role: "OWNER"`.
- **Impact**: Unauthorized privilege escalation and shift destruction.
- **Mitigation**: Authorization is strictly enforced inside server domain services. Staff role attempts to mutate shifts, approve swaps, or access billing endpoints are immediately rejected with `403 Forbidden`. The role stored in the client session or request body is ignored; the server retrieves role from the verified `Membership` record on primary.

### Threat 3: Refresh Token Replay and Session Hijacking
- **Vector**: An attacker steals an expired or used refresh token from network transit or compromised client storage.
- **Impact**: Persistent unauthorized account access.
- **Mitigation**: Refresh tokens are stored exclusively in `expo-secure-store` on mobile (never AsyncStorage). Refresh tokens rotate on every use. Replay of an already-used refresh token triggers compromise detection, which immediately revokes the entire token family (`familyId`) and terminates all active sessions for that user.

### Threat 4: Last-Seat Capacity Race in Invitations
- **Vector**: Two users simultaneously attempt to accept or reserve invitations when a Starter plan has only one remaining seat (4 active + 1 remaining).
- **Impact**: Over-subscription exceeding the strict 5-seat Starter limit.
- **Mitigation**: Seat reservation and acceptance run inside PostgreSQL serializable/row-locked transactions (`SELECT ... FOR UPDATE` on Team/Subscription). The server counts active members plus unexpired pending invitations. Exactly one request succeeds; the concurrent request fails with a capacity limit error.

### Threat 5: Simultaneous Overlapping Shift Creation
- **Vector**: Two managers concurrently publish shifts for the same staff member that overlap in time (e.g. 09:00–17:00 and 13:00–21:00).
- **Impact**: Double-booking, payroll errors, and staffing conflicts.
- **Mitigation**: A PostgreSQL exclusion constraint using `btree_gist` (`assignee_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&`) rejects overlapping published shifts at the database engine level, eliminating race conditions that application-level read checks miss.

### Threat 6: Ledger Tampering and Fraudulent Subscription Upgrades
- **Vector**: An internal service or compromised application process attempts to modify or delete historical ledger rows or mark payment verified without an authentic transaction.
- **Impact**: Financial loss, incorrect seat billing, corruption of billing audit trail.
- **Mitigation**: The `LedgerEntry` table is append-only. A PostgreSQL database trigger and privilege revoke prevents `UPDATE` and `DELETE` on ledger rows. Corrections must be written as new rows referencing `correctionOfId`. Ledger state is replayable and verified against subscription projections.

### Threat 7: Forged Payment Webhooks and Replay Attacks
- **Vector**: An adversary sends forged webhook requests claiming successful checkout or replays an intercepted checkout event.
- **Impact**: Activation of unpaid subscription features.
- **Mitigation**: Webhook signatures are cryptographically verified before processing. The server durably commits a unique receipt (`provider, providerEventId`) before acknowledging HTTP success. A background worker re-verifies amount, currency, status, and transaction reference with the payment provider before updating ledger or subscription state.

### Threat 8: Push Notification Token Leakage and Stale Member Access
- **Vector**: A removed team member retains valid push tokens on their device and continues receiving sensitive shift update notifications or opens shifts via deep link.
- **Impact**: Exposure of private scheduling data to former employees.
- **Mitigation**: Upon member removal, all active push tokens and sessions for that user are revoked immediately. When an incoming push deep link is tapped, the mobile app re-authenticates and verifies active team membership on the server before rendering the target resource.

## 2. Public Environment Variables Disclosure
The only `EXPO_PUBLIC_` variable in the mobile app bundle is:
- `EXPO_PUBLIC_API_URL`: Points to the Rota backend API endpoint (e.g. `http://localhost:3000` or production URL).
- **Security Assessment**: Safe for public disclosure. It contains no API keys, private credentials, or secrets. All sensitive keys (JWT secrets, PostgreSQL passwords, Redis credentials) are kept exclusively on the server.
