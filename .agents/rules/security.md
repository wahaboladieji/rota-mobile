---
trigger: always_on
---

# Security Rules

Breaking a rule here fails the task even if the UI works. Follow `AGENTS.md` and PRD v2 F1, F6, F7, and section 7. Record eight app-specific threats and mitigations in `docs/SECURITY.md`; this file is the coding guardrail, not the threat register.

## Authorization and isolation

- Authenticate on the server and resolve the user's active membership for the requested team and resource. Enforce Owner, Manager, and Staff permissions on every endpoint. Reject a Staff direct request to delete a shift. Never authorize from a hidden button, client role, selected-team value, or ID supplied by the caller. [F1.3]
- Scope every team-owned read and write to the authenticated team. Check linked shifts, swap participants, invitations, devices, and billing records for the same team where relevant. Test guessed IDs from another team and deny access without leaking that team's data. [F1.4]
- Restrict billing initiation and management to Owners. Recheck subscription state and entitlement on primary. Never activate access from the app's checkout result. Leave D1's prepayment invitation/publishing behavior blocked until decided. [F6; D1]

## Tokens, secrets, and abuse prevention

- Store mobile access and refresh tokens in `expo-secure-store`, never AsyncStorage. Keep access tokens short-lived. Rotate refresh tokens atomically, reject reuse, revoke the affected token family or session according to the documented threat response, and make all-device logout effective on the server. [F1.5]
- Hash single-use invitation, magic-link, and password-reset tokens at rest. Bind each token to its purpose, team/user as appropriate, and expiry; consume it once on the server. Rate limit requests and redemption. Do not let one token type authorize another action. [F1.1–F1.2]
- Keep provider secrets, webhook secrets, PostgreSQL and Redis credentials, and signing keys on the server. Treat every `EXPO_PUBLIC_` value as public and document why it is safe. Never put secrets in source, mobile bundles, error messages, logs, or test fixtures. [Section 7]
- Validate every request body with Zod. Apply Redis-based per-IP and per-user rate limits, with strict controls for login, password reset, invitations, payment initiation, and expensive routes. Do not replace distributed limits with process memory. [Section 7]

## Payments, notifications, and retained data

- Verify a webhook signature before trusting it. Persist a unique event receipt before acknowledging it; verify status, amount, currency, and reference server-side before any entitlement change. Make processing idempotent and recoverable after queue failure. [F6.3]
- Register push tokens by user and device after login. Remove invalid tokens and those of removed members immediately. Check notification group, time zone, and quiet hours on the server at send time. Never send a disabled type, even when a shift is urgent. Authorize a push deep-link target after the user opens it. [F7]
- Persist only the approved 14-day offline shift snapshot in AsyncStorage, partitioned by account and team. Show its last-updated time, clear it on logout/team departure, and purge after revocation is learned. Never put tokens or payment secrets in the snapshot. [F5.3]
- Log request ID, user ID when known, route, duration, result, and job attempts. Redact credentials, tokens, raw payment details, and sensitive payloads. Apply the PRD retention schedule; retain ledger and webhook event IDs permanently. [Sections 7, 10]

## Proof

- Add direct API tests for forbidden roles and cross-team IDs, replay tests for used refresh/reset/magic/invite tokens, rate-limit tests, forged and duplicate webhook tests, and a queue-outage recovery test. Do not mark a security control complete based only on a happy-path mobile interaction.