import type { NextRequest } from 'next/server'
import { getCategories } from '@/lib/db/queries/categories'
import { getSession } from '@/lib/auth/session'
import { apiError, apiSuccess } from '@/lib/api-response'
import { parsePaginationParams } from '@/lib/db/pagination'

const ALLOWED_ROLES = new Set(['SC', 'SCA', 'SA', 'WO'])

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return apiError('Unauthorized', 401)
  if (!ALLOWED_ROLES.has(session.role)) return apiError('Forbidden', 403)

  try {
    const result = await getCategories(parsePaginationParams(request.nextUrl.searchParams))
    return apiSuccess(result)
  } catch (err) {
    console.error('[API] GET /api/categories failed:', err)
    return apiError('Failed to fetch categories', 500)
  }
}
