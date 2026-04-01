import { query } from '@/lib/db/client'
import type { DashboardStats } from '@/lib/data/types'

const DISRUPTION_LOOKBACK_MS = 24 * 60 * 60 * 1000

/**
 * Fetches all four dashboard KPIs in a single parallel batch.
 * Each counter is an independent lightweight query — no N+1 risk.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const since = new Date(Date.now() - DISRUPTION_LOOKBACK_MS).toISOString()

  const [disruptions, health, warehouses, nodes] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM activity_log
       WHERE event_type ILIKE '%Disrupted%'
         AND time >= $1`,
      [since],
    ),
    query<{ avg: string }>(
      `SELECT ROUND(AVG(REPLACE(REPLACE(object_health, '%', ''), '+', '')::numeric), 2) AS avg
       FROM object`,
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM warehouse`,
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM processes`,
    ),
  ])

  return {
    disruptionCount: parseInt(disruptions.rows[0].count, 10),
    avgHealth: parseFloat(health.rows[0].avg ?? '0'),
    warehouseCount: parseInt(warehouses.rows[0].count, 10),
    nodeCount: parseInt(nodes.rows[0].count, 10),
  }
}
