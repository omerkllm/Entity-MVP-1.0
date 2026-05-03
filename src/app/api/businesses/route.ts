import type { NextRequest } from 'next/server'
import { getAllBusinesses } from '@/lib/db/queries/businesses'
import { getSession } from '@/lib/auth/session'
import { canAccessApi } from '@/lib/auth/access'
import { apiError, apiSuccess } from '@/lib/api-response'
import { parsePaginationParams } from '@/lib/db/pagination'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return apiError('Unauthorized', 401)
  if (!canAccessApi(session.role, '/api/businesses')) return apiError('Forbidden', 403)

  try {
    const result = await getAllBusinesses(parsePaginationParams(request.nextUrl.searchParams))
    return apiSuccess(result)
  } catch (err) {
    console.error('[API] GET /api/businesses failed:', err)
    return apiError('Failed to fetch businesses', 500)
  }
}
