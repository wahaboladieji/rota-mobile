# Rota Load Tests

This directory houses k6 performance and load test scripts for Rota, specifically focusing on cursor-based activity feed pagination and authentication route throughout as required by PRD Section 7 and Section 11.

## Test Scripts
- `cursor-feed-k6.js`: Exercises cursor pagination across 10,000+ seeded records to measure latency with the `(teamId, createdAt DESC, id DESC)` composite index.
- `burst_pool_verification.ts`: Exercises a 300-request parallel burst against bounded PostgreSQL connection pools with real-time `pg_stat_activity` sampling to verify pool budgeting, latency percentiles, and load shedding under pool saturation. Run with:
  ```bash
  cd apps/backend && npx ts-node -O '{"module":"commonjs"}' ../../load-tests/burst_pool_verification.ts
  ```
