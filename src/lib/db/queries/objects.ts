import { query } from '@/lib/db/client'
import type { ObjectRecord } from '@/lib/data/types'
import { type PaginationParams, type PaginatedResult, extractPaginatedResult } from '@/lib/db/pagination'

const COLS = `
  object_id        AS "objectId",
  object_category  AS "objectCategory",
  quantity,
  unit,
  to_char(arrival_time, 'YYYY-MM-DD HH24:MI') AS "arrivalTime",
  transit_status   AS "transitStatus",
  object_health    AS "objectHealth",
  warehouse_id     AS "warehouseId"
`

export async function getAllObjects(
  pag: PaginationParams,
  warehouseId?: string,
): Promise<PaginatedResult<ObjectRecord>> {
  type Row = ObjectRecord & { total: string }

  const { rows } = warehouseId
    ? await query<Row>(
        `SELECT ${COLS}, COUNT(*) OVER() AS total
         FROM object WHERE warehouse_id = $1
         ORDER BY object_id LIMIT $2 OFFSET $3`,
        [warehouseId, pag.limit, pag.offset],
      )
    : await query<Row>(
        `SELECT ${COLS}, COUNT(*) OVER() AS total
         FROM object
         ORDER BY object_id LIMIT $1 OFFSET $2`,
        [pag.limit, pag.offset],
      )

  return extractPaginatedResult(rows, pag)
}

/** Returns true if a warehouse with the given ID exists. */
export async function warehouseExists(warehouseId: string): Promise<boolean> {
  const { rows } = await query<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM warehouse WHERE warehouse_id = $1) AS exists',
    [warehouseId],
  )
  return rows[0].exists
}
