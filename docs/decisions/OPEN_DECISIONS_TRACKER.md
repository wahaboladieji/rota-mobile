# Open Decisions & Provider Spike Tracker

This tracker documents the status of open product decisions (D1–D6) and technical spikes (E1) as defined in PRD v2 Section 14. In accordance with `AGENTS.md`, dependent implementations are blocked until an explicit decision is recorded.

| ID | Title | Status | Scaffold Impact / Handling |
| :--- | :--- | :--- | :--- |
| **D1** | Prepayment invite/publish policy | **CONFIRMED** | Initial teams stay in `PENDING_INITIAL_PAYMENT` until subscribed. Member invitation and shift publishing are held until initial payment completes. |
| **D2** | Small-team swap fallback | **OPEN** | Manager approval remains required after colleague acceptance. Self-approval is not implemented. |
| **D3** | Swap assignment mode (Transfer vs Exchange) | **OPEN** | `colleagueShiftId` remains an optional foreign key in the Prisma schema (`schema.prisma:130`). No transfer or exchange mutation logic is finalized. |
| **D4** | Staff availability enforcement | **OPEN** | Availability preferences table is created, but blocking vs advisory validation on shift publishing is withheld. |
| **D5** | Above-included seat invitation timing | **CONFIRMED** | Starter plan enforces strict 5-seat limit with no extra seats. For Team and Business plans, extra seat capacity ($3/mo and $2/mo per seat) is purchased to establish paid seat entitlement before invitations beyond included seats are permitted. |
| **D6** | Second supported language | **OPEN** | Mobile client defaults to English (`en`). Settings schema supports language code, but second locale files are not assumed. |
| **E1** | Flutterwave USD test-account spike | **RESOLVED (PASSED)** | Verified live on 2026-10-17 via `POST https://api.flutterwave.com/v3/payments` in USD ($20.00). Flutterwave test mode confirmed as primary payment provider (see `2026-10-17-e1-flutterwave-usd-spike.md`). |

---

## Approved Design Token & System Resolutions

| Date | Topic | Status | Decision Summary |
| :--- | :--- | :--- | :--- |
| **2026-10-16** | Error 97 token | **APPROVED** | Added `errorContainerHigh` (`hsl(7, 100%, 97%)`) for light mode. |
| **2026-10-18** | Error 98 token | **APPROVED** | Added `error98` (`hsl(7, 100%, 98%)`) for billing cancellation card background. |
| **2026-10-18** | Accessible Dark Mode System | **APPROVED** | Replaced all 16 magenta placeholder tokens with high-contrast neutral slate elevation ramp (`hsl(220, 15%, 8%–20%)`) and accessible crimson error palette (`hsl(358, 100%, 69%)`). All foreground/background pairs verified to meet WCAG 2.1 AA/AAA. See `2026-10-18-accessible-dark-mode-palette.md`. |

