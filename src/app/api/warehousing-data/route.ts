/**
 * Combined data endpoint for the Inventory / Warehousing page.
 * Fetches warehouses + processes + objects in a single serverless invocation
 * using Promise.all — all three queries run concurrently.
 * Objects are included so the drill-down view is instant (no second API call).
 */
import { getAllWarehouses } from '@/lib/db/queries/warehouses'
import { getAllProcesses } from '@/lib/db/queries/processes'
import { getAllObjects } from '@/lib/db/queries/objects'
import { apiSuccess } from '@/lib/api-response'
import { withAuthRoute } from '@/lib/api/route-handler'

const MAX_PAG = { page: 1, limit: 200, offset: 0 }
const OBJ_PAG = { page: 1, limit: 500, offset: 0 }

export const GET = withAuthRoute(
  { apiPath: '/api/warehousing-data', errorMessage: 'Failed to fetch warehousing data' },
  async () => {
    const [warehouses, processes, objects] = await Promise.all([
      getAllWarehouses(MAX_PAG),
      getAllProcesses(MAX_PAG),
      getAllObjects(OBJ_PAG),
    ])
    return apiSuccess({ warehouses, processes, objects })
  },
)
