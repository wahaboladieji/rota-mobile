# Rota Load Tests

This directory houses k6 performance and load test scripts for Rota, specifically focusing on cursor-based activity feed pagination and authentication route throughput as required by PRD Section 7 and Section 11.

## Test Scripts
- `cursor-feed-k6.js`: Exercises cursor pagination across 10,000+ seeded records to measure latency with the `(teamId, createdAt DESC, id DESC)` composite index.
