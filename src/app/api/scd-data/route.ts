/**
 * Combined data endpoint for the Supply Chain Dashboard page.
 * Runs all 4 queries in a single serverless invocation via Promise.all,
 * eliminating 3 extra cold starts.
 */
import { getAllProcesses } from '@/lib/db/queries/processes'
import { getAllActivity } from '@/lib/db/queries/activity'
import { getAllWarehouses } from '@/lib/db/queries/warehouses'
import { getDashboardStats } from '@/lib/db/queries/dashboard'
import { getSession } from '@/lib/auth/session'
import { canAccessApi } from '@/lib/auth/access'
import { apiError, apiSuccess } from '@/lib/api-response'

const MAX_PAG = { page: 1, limit: 200, offset: 0 }

export async function GET() {
  const session = await getSession()
  if (!session) return apiError('Unauthorized', 401)
  if (!canAccessApi(session.role, '/api/scd-data')) return apiError('Forbidden', 403)

  try {
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
  } catch (err) {
    console.error('[API] GET /api/scd-data failed:', err)
    return apiError('Failed to fetch dashboard data', 500)
  }
}
