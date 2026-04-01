import { getDashboardStats } from '@/lib/db/queries/dashboard'
import { getSession } from '@/lib/auth/session'
import { apiError, apiSuccess } from '@/lib/api-response'

const ALLOWED_ROLES = new Set(['SCA', 'SA'])

export async function GET() {
  const session = await getSession()
  if (!session) return apiError('Unauthorized', 401)
  if (!ALLOWED_ROLES.has(session.role)) return apiError('Forbidden', 403)

  try {
    const stats = await getDashboardStats()
    // snake_case keys for backward compat with existing frontend consumers
    return apiSuccess({
      disruption_count: stats.disruptionCount,
      avg_health: stats.avgHealth,
      warehouse_count: stats.warehouseCount,
      node_count: stats.nodeCount,
    })
  } catch (err) {
    console.error('[API] GET /api/dashboard failed:', err)
    return apiError('Failed to fetch dashboard data', 500)
  }
}
