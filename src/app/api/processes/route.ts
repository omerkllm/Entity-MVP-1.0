import { getAllProcesses } from '@/lib/db/queries/processes'
import { apiSuccess } from '@/lib/api-response'
import { parsePaginationParams } from '@/lib/db/pagination'
import { withAuthRoute } from '@/lib/api/route-handler'

export const GET = withAuthRoute(
  { apiPath: '/api/processes', errorMessage: 'Failed to fetch processes' },
  async ({ request }) => {
    const result = await getAllProcesses(parsePaginationParams(request.nextUrl.searchParams))
    return apiSuccess(result)
  },
)
