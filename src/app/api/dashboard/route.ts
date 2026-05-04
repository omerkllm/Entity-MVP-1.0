import { getDashboardStats } from '@/lib/db/queries/dashboard'
import { apiSuccess } from '@/lib/api-response'
import { withAuthRoute } from '@/lib/api/route-handler'

export const GET = withAuthRoute(
  { apiPath: '/api/dashboard', errorMessage: 'Failed to fetch dashboard data' },
  async () => {
    const stats = await getDashboardStats()
    // snake_case keys for backward compat with existing frontend consumers
    return apiSuccess({
      disruption_count: stats.disruptionCount,
      avg_health: stats.avgHealth,
      warehouse_count: stats.warehouseCount,
      node_count: stats.nodeCount,
    })
  },
)
