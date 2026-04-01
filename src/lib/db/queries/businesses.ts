import { query } from '@/lib/db/client'
import type { DBBusiness } from '@/lib/data/types'
import { type PaginationParams, type PaginatedResult, extractPaginatedResult } from '@/lib/db/pagination'

const SQL_ALL_BUSINESSES = `
  SELECT
    b.business_id                                                            AS "businessId",
    b.object_category                                                        AS "objectCategory",
    b.region,
    b.coordinates,
    COALESCE(
      array_agg(w.warehouse_id) FILTER (WHERE w.business_link_type IS NOT NULL),
      ARRAY[]::TEXT[]
    )                                                                        AS "linkedWarehouseIds",
    MAX(w.business_link_type)                                                AS "linkType",
    COUNT(*) OVER()                                                          AS total
  FROM businesses b
  LEFT JOIN warehouse w ON w.business_id = b.business_id
  GROUP BY b.business_id, b.object_category, b.region, b.coordinates
  ORDER BY b.business_id
  LIMIT $1 OFFSET $2
`

export async function getAllBusinesses(
  pag: PaginationParams,
): Promise<PaginatedResult<DBBusiness>> {
  const { rows } = await query<DBBusiness & { total: string }>(
    SQL_ALL_BUSINESSES,
    [pag.limit, pag.offset],
  )
  return extractPaginatedResult(rows, pag)
}
