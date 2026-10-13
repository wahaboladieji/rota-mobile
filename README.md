# Rota - Mobile Shift Scheduling Application

Rota is an Android-first shift scheduling application engineered for small restaurant, clinic, and retail teams.
- **Owners** manage workspaces, subscription billing, and member access.
- **Managers** build schedules, publish shifts, and review peer shift swaps.
- **Staff** view assigned shifts, set work preferences, and request shift swaps.

This repository implements the working scaffold for **Phase 1 Foundation** following [docs/Rota_PRD_v2.md](file:///Users/admin/Desktop/rota%20mobile/docs/Rota_PRD_v2.md) and [AGENTS.md](file:///Users/admin/Desktop/rota%20mobile/AGENTS.md).

---

## 1. Locked Technology Stack

- **Mobile**: React Native with Expo (SDK 52), targeting Android EAS development builds for remote push verification.
- **API**: Node.js with Express and TypeScript (strict checking enabled).
- **Database**: PostgreSQL 16+ with Prisma ORM, pooled connections, read-your-own-writes routing, and PostgreSQL native SQL migrations (`btree_gist` exclusion constraints, triggers).
- **State Management**: TanStack Query for all server data; Zustand strictly for shared client-only UI state; `expo-secure-store` for authentication tokens.
- **Background Jobs & Cache**: Redis with BullMQ for asynchronous email delivery, invitation dispatch, and future webhook verification.
- **Design System**: Typed token mappings derived directly from `design-tokens.tokens.json` adhering to the Matisse design system rule.

---

## 2. Repository Layout

```text
/
  AGENTS.md                         # Product rules, locked stack, invariants, checklist
  README.md                         # Architecture, boot instructions, env disclosure
  package.json                      # Workspace definitions (packages/*, apps/*)
  design-tokens.tokens.json          # Source design tokens
  convert-tokens.js                 # Token converter script
  design-tokens.css                 # Compiled CSS custom properties
  docs/
    Rota_PRD_v2.md                  # PRD v2 specification
    STATE.md                        # State ownership, TTL, offline snapshot policy
    SECURITY.md                     # 8 app-specific threats and mitigations
    design-tokens-documentation.md  # Token documentation
    decisions/                      # Records for D1–D6, E1
  packages/
    shared/                         # Shared contracts, enums, pricing, Zod schemas
  apps/
    backend/                        # Express backend API, Prisma, BullMQ, tests
      prisma/
        schema.prisma               # PRD Section 10 data model (20 models, 8 enums)
        migrations/                 # Reviewed SQL migrations (btree_gist, constraints)
        seed.ts                     # Exact reference plan seeding (Starter, Team, Business)
      src/
        auth/                       # JWT access, rotating refresh tokens, session guards
        data/                       # Pooled primary/replica with read-your-own-writes
        jobs/                       # BullMQ email queue and worker
        observability/              # Structured logging, correlation IDs, secret redaction
        routes/                     # Express route handlers
      tests/                        # Jest integration and invariant test suite
    frontend/                       # React Native Expo mobile application
      src/
        components/                 # Accessible UI components (Button, Input)
        features/                   # Auth (Login, SignUp, MagicLink, Reset), Onboarding, Dashboard
        state/                      # TanStack Query client, Zustand auth store
        theme/                      # Typed token theme mapping and hooks
  infra/
    postgres/                       # Database initialization scripts
    redis/                          # Local Redis binaries and runner
  load-tests/                       # k6 load test scripts and baseline benchmarks
```

---

## 3. Environment Variables & Public Disclosure

### Public Frontend Variables (`apps/frontend/.env`)
- `EXPO_PUBLIC_API_URL`: Base URL of the Rota backend API (e.g. `http://localhost:3000` or local IP `http://10.0.2.2:3000` for Android emulator).
- **Disclosure Assessment**: Safe for public exposure in the mobile bundle. Contains no keys, secrets, or internal server tokens.

### Server Secrets (`apps/backend/.env`)
- `DATABASE_URL`: PostgreSQL connection string with pooling parameters.
- `DATABASE_REPLICA_URL`: Streaming replica connection string for lag-tested replica reads.
- `REDIS_URL`: Redis connection URL (`redis://localhost:6379`).
- `JWT_ACCESS_SECRET`: Secret key for signing 15-minute access JWTs (kept on server).
- `JWT_REFRESH_SECRET`: Secret key for rotating refresh token hashing (kept on server).
- `PORT`: HTTP port for Express (default: `3000`).

---

## 4. Setup and Boot Instructions

### Prerequisites
- Node.js LTS (v20+), npm v10+
- Local PostgreSQL 16+ running on `localhost:5432` with `btree_gist` extension
- Local Redis 7+ running on `localhost:6379`

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Initialize Database and Run Migrations
```bash
# Ensure PostgreSQL is running, then run migrations on apps/backend:
npm run prisma:migrate --workspace=@rota/backend

# Seed the exact plan reference data (Starter 2000c, Team 5000c, Business 12000c):
npm run prisma:seed --workspace=@rota/backend
```

### Step 3: Start Redis
```bash
# Launch isolated local Redis instance:
./infra/redis/run-redis.sh
```

### Step 4: Start Express API
```bash
# Starts API in development mode on port 3000:
npm run dev:backend
```
Verify health:
```bash
curl http://localhost:3000/health
# Output: {"status":"ok","service":"rota-api","timestamp":"..."}
```

### Step 5: Start Background Job Worker
```bash
# Starts BullMQ worker for asynchronous transactional emails:
npm run start:worker
```

### Step 6: Start Frontend App
```bash
# Starts Expo development server:
npm run start:frontend
```

---

## 5. Running Verification & Tests

### TypeScript Type-Checking
Typecheck all workspaces (`@rota/shared`, `@rota/backend`, `@rota/frontend`) in strict mode:
```bash
npm run typecheck
```

### Automated Invariant & Security Test Suite
Runs the 22 integration tests exercising auth invariants, token replay compromise detection, role isolation, exclusion constraints, and ledger immutability:
```bash
npm test
```

### Tested Invariants:
1. **Password Authentication & Tokens**: Bcrypt hashing, 15m access token, rotating refresh token.
2. **Compromise Detection (F1.5)**: Replay of an already-used refresh token invalidates the entire token family (`familyId`) and terminates sessions.
3. **Tenant & Role Guards (F1.3, F1.4)**: Staff role mutations rejected with `403 Forbidden`; cross-team queries return `404 Not Found` without disclosing existence.
4. **PostgreSQL Exclusion Constraint (F2, Section 10)**: Prevents overlapping published shifts for the same user via `btree_gist` at the database engine level.
5. **Ledger Immutability (F6.4, Section 10)**: Triggers prevent `UPDATE` and `DELETE` on all `LedgerEntry` rows.

---

## 6. Open Decisions Status

- **D1 (Prepayment Access Policy)**: Open. Scaffold initial subscription created in `PENDING_INITIAL_PAYMENT` without granting premature paid access.
- **D2 (Small-Team Swap Fallback)**: Open. Self-approval is blocked pending product decision.
- **D3 (Swap Transfer vs Exchange)**: Open. Field `colleagueShiftId` remains optional in Prisma schema.
- **D4 (Availability Enforcement)**: Open. Unblocked foundation scheduling only.
- **D5 (Extra-Seat Invite Timing)**: Open. Extra-seat payments blocked pending product decision.
- **D6 (Second Language)**: Open. Settings persist default `en`.
- **E1 (Flutterwave USD Spike)**: Unresolved. Checkout integration blocked until spike verification.
