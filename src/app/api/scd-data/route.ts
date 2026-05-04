/**
 * Combined data endpoint for the Supply Chain Dashboard page.
 * Runs all 4 queries in a single serverless invocation via Promise.all,
 * eliminating 3 extra cold starts.
 */
import { getAllProcesses } from '@/lib/db/queries/processes'
import { getAllActivity } from '@/lib/db/queries/activity'
import { getAllWarehouses } from '@/lib/db/queries/warehouses'
import { getDashboardStats } from '@/lib/db/queries/dashboard'
import { apiSuccess } from '@/lib/api-response'
import { withAuthRoute } from '@/lib/api/route-handler'

const MAX_PAG = { page: 1, limit: 200, offset: 0 }

export const GET = withAuthRoute(
  { apiPath: '/api/scd-data', errorMessage: 'Failed to fetch dashboard data' },
  async () => {
    const [processes, activity, warehouses, stats] = await Promise.all([
      getAllProcesses(MAX_PAG),
      getAllActivity(MAX_PAG),
      getAllWarehouses(MAX_PAG),
      getDashboardStats(),
    ])

    return apiSuccess({
      processes,
      activity,
      warehouses,
      dashboard: {
        disruption_count: stats.disruptionCount,
        avg_health: stats.avgHealth,
        warehouse_count: stats.warehouseCount,
        node_count: stats.nodeCount,
      },
    })
  },
)
