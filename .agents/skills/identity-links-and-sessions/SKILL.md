---
name: identity-links-and-sessions
description: Implement or change Rota email sign-in, magic links, invitations, password reset, refresh tokens, sessions, or logout. Load before designing a token or session flow; follow purpose-bound issuance, background delivery, one-time redemption, rotation, revocation, and replay verification.
---

# Identity links and sessions

1. Read PRD F1 and F6.1, `AGENTS.md`, and `security.md`. Identify the token's sole purpose, actor, account/team binding, configured expiry, device/session effect, and deep-link destination. Preserve D1's initial-payment invitation gate and the active-plus-pending seat rule.
2. Issue a random purpose-specific single-use token. Persist only its hash, binding, expiry, and consumption state on the server. Apply distributed per-IP and per-user rate limits. Queue the email; never log the token or put it in a mobile public variable.
3. On deep-link open, complete authentication or sign-up as required, then redeem on the server. In one transaction validate purpose, hash, expiry, unused state, and binding; consume exactly once before granting the effect. For invitations, lock and recheck team capacity and membership, then land the user in the correct team. Handle expired, revoked, used, and wrong-purpose links safely.
4. Keep access and refresh tokens in `expo-secure-store`. Issue short-lived access tokens. Rotate refresh tokens atomically, reject reuse, apply the documented compromise response, and make all-device logout effective server-side. On member removal, revoke sessions and push tokens immediately while preserving other memberships.
5. Test initial use, replay, expiry boundary, wrong purpose, wrong account/team, duplicate acceptance, concurrent final-seat attempts, multi-device refresh, and all-device logout at the API boundary. Verify deep-link authorization before exposing a target.

Use `secure-api-change` for endpoints. Set token lifetimes through PRD A3/T1 configuration decisions, not an invented screen constant.