import { neon } from '@neondatabase/serverless';
import { env } from '@/lib/env';

/** Minimal type matching pg.QueryResultRow — avoids importing 'pg'. */
type QueryResultRow = Record<string, unknown>;

/**
 * Neon HTTP query function — stateless, zero connection overhead.
 * Each call is a single HTTP request to Neon's SQL proxy.
 * No pool, no WebSocket, no cold-start handshake.
 */
const sql = neon(env.DATABASE_URL);

/**
 * Typed query helper — drop-in replacement for the old pool.query().
 * Uses sql.query() which accepts (string, params[]) unlike the tagged
 * template form.
 * Returns { rows } to match the pg.QueryResult shape that all query
 * modules already depend on.
 */
export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  const rows = await sql.query(text, params as unknown[]) as T[];
  return { rows };
}

/**
 * Backward-compat export — login route and a few others use pool.query
 * directly.  Wrap it so it Just Works™ without changing every call site.
 */
export const pool = {
  query: async <T extends QueryResultRow>(text: string, params?: unknown[]) => {
    const rows = await sql.query(text, params as unknown[]) as T[];
    return { rows };
  },
};
