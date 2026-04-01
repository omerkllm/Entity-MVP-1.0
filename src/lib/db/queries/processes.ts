import { query } from '@/lib/db/client'
import type { SupplyChainNode } from '@/lib/data/types'
import { type PaginationParams, type PaginatedResult, extractPaginatedResult } from '@/lib/db/pagination'

const COLS = `
  process_id   AS id,
  name,
  status,
  quantity,
  unit,
  to_char(last_updated, 'YYYY-MM-DD') AS "lastUpdated"
`

export async function getAllProcesses(
  pag: PaginationParams,
): Promise<PaginatedResult<SupplyChainNode>> {
  const { rows } = await query<SupplyChainNode & { total: string }>(
    `SELECT ${COLS}, COUNT(*) OVER() AS total
     FROM processes ORDER BY process_id
     LIMIT $1 OFFSET $2`,
    [pag.limit, pag.offset],
  )
  return extractPaginatedResult(rows, pag)
}
