import { getAllActivity } from '@/lib/db/queries/activity'
import { apiSuccess } from '@/lib/api-response'
import { parsePaginationParams } from '@/lib/db/pagination'
import { withAuthRoute } from '@/lib/api/route-handler'

export const GET = withAuthRoute(
  { apiPath: '/api/activity', errorMessage: 'Failed to fetch activity log' },
  async ({ request }) => {
    const result = await getAllActivity(parsePaginationParams(request.nextUrl.searchParams))
    return apiSuccess(result)
  },
)
