import { query } from '@/lib/db/client'
import type { SupplyChainNode } from '@/lib/data/types'
import { type PaginationParams, type PaginatedResult, extractPaginatedResult } from '@/lib/db/pagination'

const COLS = `
  p.process_id   AS id,
  p.name,
  CASE WHEN COALESCE(agg.total_qty, 0) > 0 THEN 'Active' ELSE 'Pending' END AS status,
  COALESCE(agg.total_qty, 0) AS quantity,
  COALESCE(agg.dominant_unit, p.unit) AS unit,
  COALESCE(to_char(agg.latest_arrival, 'YYYY-MM-DD'), to_char(p.last_updated, 'YYYY-MM-DD')) AS "lastUpdated"
`

const FROM = `
  FROM processes p
  LEFT JOIN (
    SELECT
      c.process_id,
      SUM(o.quantity)::int AS total_qty,
      MODE() WITHIN GROUP (ORDER BY o.unit) AS dominant_unit,
      MAX(o.arrival_time) AS latest_arrival
    FROM category c
    JOIN warehouse w ON w.category_id = c.category_id
    JOIN object o ON o.warehouse_id = w.warehouse_id
    GROUP BY c.process_id
  ) agg ON agg.process_id = p.process_id
`

export async function getAllProcesses(
  pag: PaginationParams,
): Promise<PaginatedResult<SupplyChainNode>> {
  const { rows } = await query<SupplyChainNode & { total: string }>(
    `SELECT ${COLS}, COUNT(*) OVER() AS total ${FROM} ORDER BY p.process_id LIMIT $1 OFFSET $2`,
    [pag.limit, pag.offset],
  )
  return extractPaginatedResult(rows, pag)
}
