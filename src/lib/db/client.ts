import { Pool, type QueryResultRow } from '@neondatabase/serverless';
import { env } from '@/lib/env';

/* ── Pool configuration constants ─────────────────────────────────── */
const MAX_POOL_SIZE = 5;
const IDLE_TIMEOUT_MS = 30_000;
const CONNECTION_TIMEOUT_MS = 10_000;

/* ── Singleton pool (survives Next.js HMR in dev) ─────────────────── */
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: MAX_POOL_SIZE,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  });

// Log unexpected pool-level errors instead of crashing the process
pool.on('error', (err: Error) => {
  console.error('[pg pool] Unexpected idle-client error:', err.message);
});

if (process.env.NODE_ENV !== 'production') {
  globalForPg.pgPool = pool;
}

/**
 * Typed query helper — wraps pool.query with a consistent error surface.
 * All query modules should call this instead of pool.query directly.
 */
export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  return pool.query<T>(text, params);
}
