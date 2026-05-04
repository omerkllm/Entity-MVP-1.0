/**
 * Combined data endpoint for the Decision Making Portal page.
 * Runs warehouses + businesses in a single serverless invocation
 * via Promise.all, eliminating 1 extra cold start.
 */
import { getAllWarehouses } from '@/lib/db/queries/warehouses'
import { getAllBusinesses } from '@/lib/db/queries/businesses'
import { apiSuccess } from '@/lib/api-response'
import { withAuthRoute } from '@/lib/api/route-handler'

const MAX_PAG = { page: 1, limit: 200, offset: 0 }

export const GET = withAuthRoute(
  { apiPath: '/api/dmp-data', errorMessage: 'Failed to fetch DMP data' },
  async () => {
    const [warehouses, businesses] = await Promise.all([
      getAllWarehouses(MAX_PAG),
      getAllBusinesses(MAX_PAG),
    ])
    return apiSuccess({ warehouses, businesses })
  },
)
