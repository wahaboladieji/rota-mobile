import { PrismaClient } from '@prisma/client';

const primaryDatabaseUrl = process.env.DATABASE_URL || 'postgresql://admin@localhost:5432/rota_dev?schema=public';
const replicaDatabaseUrl = process.env.DATABASE_REPLICA_URL || primaryDatabaseUrl;

/**
 * Primary database client: handles all writes, transactions, auth, and financial operations.
 */
export const prismaPrimary = new PrismaClient({
  datasources: {
    db: {
      url: primaryDatabaseUrl,
    },
  },
  log: process.env.NODE_ENV === 'test' ? [] : ['warn', 'error'],
});

/**
 * Streaming replica client: handles eligible read-only operations when no write lag hazard exists.
 */
export const prismaReplica = new PrismaClient({
  datasources: {
    db: {
      url: replicaDatabaseUrl,
    },
  },
  log: process.env.NODE_ENV === 'test' ? [] : ['warn', 'error'],
});

export type ReadRouteType = 'PRIMARY' | 'REPLICA_ELIGIBLE';

interface RouteOptions {
  routeType?: ReadRouteType;
  lastUserWriteAt?: number | null; // Timestamp of user's last write
  maxAcceptableLagMs?: number;     // Window within which we force primary for read-your-own-writes
}

const DEFAULT_LAG_WINDOW_MS = 5000;

/**
 * Resolves the appropriate Prisma client based on the Rota read-routing matrix.
 * Guarantees read-your-own-writes by routing to primary if the caller performed a write within the lag window.
 */
export function getPrismaClient(options: RouteOptions = {}): PrismaClient {
  const {
    routeType = 'PRIMARY',
    lastUserWriteAt = null,
    maxAcceptableLagMs = DEFAULT_LAG_WINDOW_MS,
  } = options;

  if (routeType === 'REPLICA_ELIGIBLE') {
    if (lastUserWriteAt) {
      const msSinceWrite = Date.now() - lastUserWriteAt;
      if (msSinceWrite < maxAcceptableLagMs) {
        // Enforce Read-Your-Own-Writes: recently written, route to primary
        return prismaPrimary;
      }
    }
    return prismaReplica;
  }

  return prismaPrimary;
}
