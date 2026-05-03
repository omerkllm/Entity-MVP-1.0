/**
 * Combined data endpoint for the Decision Making Portal page.
 * Runs warehouses + businesses in a single serverless invocation
 * via Promise.all, eliminating 1 extra cold start.
 */
import { getAllWarehouses } from '@/lib/db/queries/warehouses'
import { getAllBusinesses } from '@/lib/db/queries/businesses'
import { getSession } from '@/lib/auth/session'
import { canAccessApi } from '@/lib/auth/access'
import { apiError, apiSuccess } from '@/lib/api-response'

const MAX_PAG = { page: 1, limit: 200, offset: 0 }

export async function GET() {
  const session = await getSession()
  if (!session) return apiError('Unauthorized', 401)
  if (!canAccessApi(session.role, '/api/dmp-data')) return apiError('Forbidden', 403)

  try {
    const [warehouses, businesses] = await Promise.all([
      getAllWarehouses(MAX_PAG),
      getAllBusinesses(MAX_PAG),
    ])

    return apiSuccess({ warehouses, businesses })
  } catch (err) {
    console.error('[API] GET /api/dmp-data failed:', err)
    return apiError('Failed to fetch DMP data', 500)
  }
}
