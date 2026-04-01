import { query } from '@/lib/db/client'
import type { ActivityLogEntry } from '@/lib/data/types'
import { type PaginationParams, type PaginatedResult, extractPaginatedResult } from '@/lib/db/pagination'

export async function getAllActivity(
  pag: PaginationParams,
): Promise<PaginatedResult<ActivityLogEntry>> {
  const { rows } = await query<ActivityLogEntry & { total: string }>(
    `SELECT
       node_id    AS "nodeId",
       event_type AS "eventType",
       time,
       COUNT(*) OVER() AS total
     FROM activity_log
     ORDER BY id
     LIMIT $1 OFFSET $2`,
    [pag.limit, pag.offset],
  )
  return extractPaginatedResult(rows, pag)
}
