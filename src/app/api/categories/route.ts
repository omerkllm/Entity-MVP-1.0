import { getCategories } from '@/lib/db/queries/categories'
import { apiSuccess } from '@/lib/api-response'
import { parsePaginationParams } from '@/lib/db/pagination'
import { withAuthRoute } from '@/lib/api/route-handler'

export const GET = withAuthRoute(
  { apiPath: '/api/categories', errorMessage: 'Failed to fetch categories' },
  async ({ request }) => {
    const result = await getCategories(parsePaginationParams(request.nextUrl.searchParams))
    return apiSuccess(result)
  },
)
