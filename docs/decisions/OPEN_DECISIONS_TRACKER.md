# Open Decisions & Provider Spike Tracker

This tracker documents the status of open product decisions (D1–D6) and technical spikes (E1) as defined in PRD v2 Section 14. In accordance with `AGENTS.md`, dependent implementations are blocked until an explicit decision is recorded.

| ID | Title | Status | Scaffold Impact / Handling |
| :--- | :--- | :--- | :--- |
| **D1** | Prepayment invite/publish policy | **OPEN** | Teams are initialized with subscriptions in `PENDING_INITIAL_PAYMENT`. Prepayment publishing and member invitation are blocked until Product Lead approval. |
| **D2** | Small-team swap fallback | **OPEN** | Manager approval remains required after colleague acceptance. Self-approval is not implemented. |
| **D3** | Swap assignment mode (Transfer vs Exchange) | **OPEN** | `colleagueShiftId` remains an optional foreign key in the Prisma schema (`schema.prisma:130`). No transfer or exchange mutation logic is finalized. |
| **D4** | Staff availability enforcement | **OPEN** | Availability preferences table is created, but blocking vs advisory validation on shift publishing is withheld. |
| **D5** | Above-included seat invitation timing | **OPEN** | The Starter plan enforces a strict 5-seat limit; Team and Business seat billing ordering is blocked until decision is reached. |
| **D6** | Second supported language | **OPEN** | Mobile client defaults to English (`en`). Settings schema supports language code, but second locale files are not assumed. |
| **E1** | Flutterwave USD test-account spike | **UNRESOLVED** | Flutterwave integration is kept behind a provider adapter boundary. Live checkout and payment initiation are blocked pending spike outcome. |
