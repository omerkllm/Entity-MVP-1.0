/**
 * Combined data endpoint for the Inventory / Warehousing page.
 * Fetches warehouses + processes in a single serverless invocation.
 */
import type { NextRequest } from 'next/server'
import { getAllWarehouses } from '@/lib/db/queries/warehouses'
import { getAllProcesses } from '@/lib/db/queries/processes'
import { getSession } from '@/lib/auth/session'
import { apiError, apiSuccess } from '@/lib/api-response'

const MAX_PAG = { page: 1, limit: 200, offset: 0 }

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return apiError('Unauthorized', 401)

  try {
    const [warehouses, processes] = await Promise.all([
      getAllWarehouses(MAX_PAG),
      getAllProcesses(MAX_PAG),
    ])

    return apiSuccess({ warehouses, processes })
  } catch (err) {
    console.error('[API] GET /api/warehousing-data failed:', err)
    return apiError('Failed to fetch warehousing data', 500)
  }
}
