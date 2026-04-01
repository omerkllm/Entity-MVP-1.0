import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAllObjects, warehouseExists } from '@/lib/db/queries/objects'
import { getSession } from '@/lib/auth/session'
import { apiError, apiSuccess } from '@/lib/api-response'
import { parsePaginationParams } from '@/lib/db/pagination'

const ObjectsQuerySchema = z.object({
  warehouseId: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
})

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return apiError('Unauthorized', 401)

  const qp = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = ObjectsQuerySchema.safeParse(qp)
  if (!parsed.success) {
    return apiError('Invalid query parameters', 400, 'VALIDATION_ERROR')
  }

  try {
    const { warehouseId } = parsed.data

    if (warehouseId && !(await warehouseExists(warehouseId))) {
      return apiError('Warehouse not found', 404)
    }

    const result = await getAllObjects(parsePaginationParams(request.nextUrl.searchParams), warehouseId)
    return apiSuccess(result)
  } catch (err) {
    console.error('[API] GET /api/objects failed:', err)
    return apiError('Failed to fetch objects', 500)
  }
}
