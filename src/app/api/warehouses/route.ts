import { getAllWarehouses } from '@/lib/db/queries/warehouses'
import { apiSuccess } from '@/lib/api-response'
import { parsePaginationParams } from '@/lib/db/pagination'
import { withAuthRoute } from '@/lib/api/route-handler'

export const GET = withAuthRoute(
  { apiPath: '/api/warehouses', errorMessage: 'Failed to fetch warehouses' },
  async ({ request }) => {
    const result = await getAllWarehouses(parsePaginationParams(request.nextUrl.searchParams))
    return apiSuccess(result)
  },
)
