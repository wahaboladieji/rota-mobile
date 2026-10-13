---
name: secure-api-change
description: Build or change a Rota Node.js Express endpoint. Load before designing the request contract for shifts, swaps, teams, invitations, settings, billing, or any other API route; follow validation, authentication, team authorization, transaction, response, and direct API verification in order.
---

# Secure API change

1. Read the applicable PRD requirement and open decisions, `AGENTS.md`, `security.md`, and `coding-standards.md`. Identify actor, resource owner, mutation, response, failure states, and any decision blocking the route. Stop only the blocked branch.
2. Define the method and path, Zod body schema, authenticated identity, target team, response shape, and safe errors. Validate every request body, including empty or optional bodies. Do not trust a body-supplied team, role, price, or subscription state.
3. Resolve the target through an authenticated active team membership. Check role, resource team, and current subscription gate on the server. Verify every linked resource belongs to that team. Put authorization and rules in server services, not mobile visibility checks.
4. Identify a consistency boundary. Use a PostgreSQL transaction and row lock when seats, tokens, swaps, or other writes can race. Recheck the invariant inside the transaction. Keep routes thin and write through primary.
5. Return server-confirmed results and distinguish forbidden, missing, invalid, conflict, and retryable errors without exposing another team's data. Enqueue email, push, and slow external work rather than waiting for delivery in the response.
6. Test direct API calls: authorized, wrong role, guessed cross-team ID, invalid body, and relevant state/concurrency cases. Include Staff direct shift-delete denial when shift permissions change. Record actual outcomes against PRD IDs.

Use `identity-links-and-sessions` for token routes and the schema or payment skills for their effects. Do not turn D1–D6 or E1 into a hidden default.