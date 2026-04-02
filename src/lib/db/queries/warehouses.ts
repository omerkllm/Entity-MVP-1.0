import { query } from '@/lib/db/client'
import type { DBWarehouse } from '@/lib/data/types'
import { type PaginationParams, type PaginatedResult, extractPaginatedResult } from '@/lib/db/pagination'

const COLS = `
    w.warehouse_id       AS "warehouseId",
    w.warehouse_id       AS id,
    w.title,
    w.region,
    w.coordinates,
    COALESCE(dom.dominant_category, w.object_category) AS "objectCategory",
    w.operational_hours  AS hours,
    CASE WHEN COALESCE(agg.total_qty, 0) > 0 THEN 'Open' ELSE 'Closed' END AS status,
    w.total_capacity     AS "totalCapacity",
    COALESCE(agg.total_qty, 0)     AS "usedCapacity",
    COALESCE(agg.transit_qty, 0)   AS "transitQty",
    CASE w.business_link_type WHEN 'Supplier' THEN 'Customer' WHEN 'Customer' THEN 'Supplier' ELSE w.business_link_type END AS "businessLinkType",
    c.process_id         AS "processId",
    w.title || ' { ' || w.warehouse_id || ' }' AS "warehouseName",
    ''                   AS address
`

// Pre-aggregates object quantities per warehouse to avoid N+1 queries
const FROM = `
  FROM warehouse w
  JOIN category c ON w.category_id = c.category_id
  LEFT JOIN (
    SELECT
      warehouse_id,
      SUM(quantity)::int AS total_qty,
      SUM(CASE WHEN transit_status = 'In Transit' THEN quantity ELSE 0 END)::int AS transit_qty
    FROM object
    GROUP BY warehouse_id
  ) agg ON agg.warehouse_id = w.warehouse_id
  LEFT JOIN (
    SELECT DISTINCT ON (warehouse_id)
      warehouse_id,
      object_category AS dominant_category
    FROM (
      SELECT warehouse_id, object_category, SUM(quantity) AS cat_qty
      FROM object
      WHERE transit_status != 'In Transit'
      GROUP BY warehouse_id, object_category
    ) cat_agg
    ORDER BY warehouse_id, cat_qty DESC
  ) dom ON dom.warehouse_id = w.warehouse_id
`

export async function getAllWarehouses(
  pag: PaginationParams,
): Promise<PaginatedResult<DBWarehouse>> {
  const { rows } = await query<DBWarehouse & { total: string }>(
    `SELECT ${COLS}, COUNT(*) OVER() AS total ${FROM} ORDER BY w.warehouse_id LIMIT $1 OFFSET $2`,
    [pag.limit, pag.offset],
  )
  return extractPaginatedResult(rows, pag)
}

export async function getWarehouseById(warehouseId: string): Promise<DBWarehouse | null> {
  const { rows } = await query<DBWarehouse>(
    `SELECT ${COLS} ${FROM} WHERE w.warehouse_id = $1`,
    [warehouseId],
  )
  return rows[0] ?? null
}
