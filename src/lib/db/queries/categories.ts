import { query } from '@/lib/db/client'
import type { Category } from '@/lib/data/types'
import { type PaginationParams, type PaginatedResult, extractPaginatedResult } from '@/lib/db/pagination'

export async function getCategories(
  pag: PaginationParams,
): Promise<PaginatedResult<Category>> {
  const { rows } = await query<Category & { total: string }>(
    `SELECT
       category_id AS "categoryId",
       name,
       process_id  AS "processId",
       COUNT(*) OVER() AS total
     FROM category
     ORDER BY category_id
     LIMIT $1 OFFSET $2`,
    [pag.limit, pag.offset],
  )
  return extractPaginatedResult(rows, pag)
}
