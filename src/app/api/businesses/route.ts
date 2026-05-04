import { getAllBusinesses } from '@/lib/db/queries/businesses'
import { apiSuccess } from '@/lib/api-response'
import { parsePaginationParams } from '@/lib/db/pagination'
import { withAuthRoute } from '@/lib/api/route-handler'

export const GET = withAuthRoute(
  { apiPath: '/api/businesses', errorMessage: 'Failed to fetch businesses' },
  async ({ request }) => {
    const result = await getAllBusinesses(parsePaginationParams(request.nextUrl.searchParams))
    return apiSuccess(result)
  },
)
