import { z } from 'zod'
import { getAllObjects, warehouseExists } from '@/lib/db/queries/objects'
import { apiError, apiSuccess } from '@/lib/api-response'
import { parsePaginationParams } from '@/lib/db/pagination'
import { withAuthRoute } from '@/lib/api/route-handler'

const ObjectsQuerySchema = z.object({
  warehouseId: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
})

export const GET = withAuthRoute(
  { apiPath: '/api/objects', errorMessage: 'Failed to fetch objects' },
  async ({ request }) => {
    const qp = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = ObjectsQuerySchema.safeParse(qp)
    if (!parsed.success) {
      return apiError('Invalid query parameters', 400, 'VALIDATION_ERROR')
    }

    const { warehouseId } = parsed.data

    if (warehouseId && !(await warehouseExists(warehouseId))) {
      return apiError('Warehouse not found', 404)
    }

    const result = await getAllObjects(parsePaginationParams(request.nextUrl.searchParams), warehouseId)
    return apiSuccess(result)
  },
)
