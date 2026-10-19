# Decision / Spike Result: E1 Flutterwave USD Test-Account Spike

- **Date:** 2026-10-17
- **Type:** Technical Spike E1 / Provider Validation (PRD v2 Section 14, F6.2)
- **Status:** PASSED (Flutterwave Test Mode verified for USD payments)

## Context

PRD v2 Section 14 and Requirement F6.2 specify:
> "Run a one-day spike to verify that the test account can check out in USD. If it cannot, Paystack test mode or Stripe, if an account is available, may replace it without changing the ledger or proration. Record the chosen fallback before implementation."

## Verification & Outcome

1. Configured the backend with test-mode credentials (`FLWPUBK_TEST-...`, `FLWSECK_TEST-...`, and webhook secret hash).
2. Initiated an automated test payload to the Flutterwave Standard v3 endpoint:
   - **Endpoint:** `POST https://api.flutterwave.com/v3/payments`
   - **Headers:** `Authorization: Bearer FLWSECK_TEST-...`, `Content-Type: application/json`
   - **Payload:**
     - `amount`: `"20.00"` (representing the Starter Plan $20.00 / 2,000 cents)
     - `currency`: `"USD"`
     - `tx_ref`: `rota_test_spike_<timestamp>`
     - `customer`: `{ "email": "test_owner@rota.app", "name": "Test Owner" }`
3. **Result:**
   - **HTTP Status:** `200 OK`
   - **API Response:** `status: "success"`, `message: "Hosted Link"`
   - **Hosted Checkout URL Generated:** `https://checkout-v2.dev-flutterwave.com/v3/hosted/pay/...`

## Conclusion

- The Flutterwave test account **successfully supports USD checkout** and returns valid hosted checkout sessions.
- **Outcome:** Spike **E1 is RESOLVED (PASSED)**.
- Flutterwave test mode remains the locked payment provider for Rota Phase 3 billing. No fallback to Paystack or Stripe is required.
