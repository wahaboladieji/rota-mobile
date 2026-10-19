import { PrismaClient } from '@prisma/client';
import { serverConfig } from '../config';
import { logger } from '../observability/logger';

/**
 * Safely redacts credentials from a database URL for logging and telemetry.
 */
export function redactDatabaseUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return '[REDACTED_DATABASE_URL]';
  }
}

/**
 * Appends or updates connection pooling parameters on PostgreSQL connection strings.
 * Enforces connection_limit, pool_timeout (acquisition bound), and connect_timeout.
 */
export function formatPooledDatabaseUrl(
  rawUrl: string,
  options: {
    connectionLimit: number;
    poolTimeoutSeconds: number;
    connectTimeoutSeconds: number;
  }
): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.set('connection_limit', String(options.connectionLimit));
    parsed.searchParams.set('pool_timeout', String(options.poolTimeoutSeconds));
    parsed.searchParams.set('connect_timeout', String(options.connectTimeoutSeconds));
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

const isWorkerProcess =
  process.env.IS_WORKER === 'true' ||
  process.argv.some((arg) => arg.includes('worker.ts'));

const primaryPoolSize = isWorkerProcess
  ? serverConfig.dbWorkerPoolSize
  : serverConfig.dbPrimaryPoolSize;

const primaryDatabaseUrl = formatPooledDatabaseUrl(serverConfig.databaseUrl, {
  connectionLimit: primaryPoolSize,
  poolTimeoutSeconds: serverConfig.dbPoolTimeoutSeconds,
  connectTimeoutSeconds: serverConfig.dbConnectTimeoutSeconds,
});

const replicaDatabaseUrl = formatPooledDatabaseUrl(serverConfig.databaseReplicaUrl, {
  connectionLimit: serverConfig.dbReplicaPoolSize,
  poolTimeoutSeconds: serverConfig.dbPoolTimeoutSeconds,
  connectTimeoutSeconds: serverConfig.dbConnectTimeoutSeconds,
});

// Reuse database clients across development reloads / hot-modules in the same process
const globalForPrisma = globalThis as unknown as {
  __rotaPrismaPrimary?: PrismaClient;
  __rotaPrismaReplica?: PrismaClient;
};

/**
 * Primary database client: handles all writes, transactions, auth, and financial operations.
 */
export const prismaPrimary =
  globalForPrisma.__rotaPrismaPrimary ||
  new PrismaClient({
    datasources: {
      db: {
        url: primaryDatabaseUrl,
      },
    },
    log: serverConfig.nodeEnv === 'test' ? [] : ['warn', 'error'],
  });

/**
 * Streaming replica client: handles eligible read-only operations when no write lag hazard exists.
 */
export const prismaReplica =
  globalForPrisma.__rotaPrismaReplica ||
  new PrismaClient({
    datasources: {
      db: {
        url: replicaDatabaseUrl,
      },
    },
    log: serverConfig.nodeEnv === 'test' ? [] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__rotaPrismaPrimary = prismaPrimary;
  globalForPrisma.__rotaPrismaReplica = prismaReplica;
}

/**
 * Gracefully disconnects all database clients during application termination or nodemon reload.
 */
export async function disconnectDbClients(): Promise<void> {
  const disconnects: Promise<void>[] = [];
  if (prismaPrimary) {
    disconnects.push(prismaPrimary.$disconnect());
  }
  if (prismaReplica) {
    disconnects.push(prismaReplica.$disconnect());
  }
  const results = await Promise.allSettled(disconnects);
  results.forEach((res, idx) => {
    if (res.status === 'rejected') {
      logger.error(`Failed to cleanly disconnect DB client [${idx === 0 ? 'primary' : 'replica'}]`, res.reason);
    }
  });
}

/**
 * Returns active connection pool configuration for diagnostics and health monitoring.
 */
export function getPoolConfig() {
  return {
    isWorkerProcess,
    primaryPoolSize,
    replicaPoolSize: serverConfig.dbReplicaPoolSize,
    poolTimeoutSeconds: serverConfig.dbPoolTimeoutSeconds,
    connectTimeoutSeconds: serverConfig.dbConnectTimeoutSeconds,
    primaryUrlMasked: redactDatabaseUrl(primaryDatabaseUrl),
    replicaUrlMasked: redactDatabaseUrl(replicaDatabaseUrl),
  };
}

export type ReadRouteType = 'PRIMARY' | 'REPLICA_ELIGIBLE';

interface RouteOptions {
  routeType?: ReadRouteType;
  lastUserWriteAt?: number | null; // Timestamp of user's last write
  maxAcceptableLagMs?: number;     // Window within which we force primary for read-your-own-writes
}

const DEFAULT_LAG_WINDOW_MS = serverConfig.dbMaxLagToleranceMs;

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
