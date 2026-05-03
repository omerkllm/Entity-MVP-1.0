import type { NextRequest } from 'next/server'
import { getAllProcesses } from '@/lib/db/queries/processes'
import { getSession } from '@/lib/auth/session'
import { canAccessApi } from '@/lib/auth/access'
import { apiError, apiSuccess } from '@/lib/api-response'
import { parsePaginationParams } from '@/lib/db/pagination'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return apiError('Unauthorized', 401)
  if (!canAccessApi(session.role, '/api/processes')) return apiError('Forbidden', 403)

  try {
    const result = await getAllProcesses(parsePaginationParams(request.nextUrl.searchParams))
    return apiSuccess(result)
  } catch (err) {
    console.error('[API] GET /api/processes failed:', err)
    return apiError('Failed to fetch processes', 500)
  }
}
