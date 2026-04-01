import type { NextRequest } from 'next/server'
import { getAllActivity } from '@/lib/db/queries/activity'
import { getSession } from '@/lib/auth/session'
import { apiError, apiSuccess } from '@/lib/api-response'
import { parsePaginationParams } from '@/lib/db/pagination'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return apiError('Unauthorized', 401)

  try {
    const result = await getAllActivity(parsePaginationParams(request.nextUrl.searchParams))
    return apiSuccess(result)
  } catch (err) {
    console.error('[API] GET /api/activity failed:', err)
    return apiError('Failed to fetch activity log', 500)
  }
}
