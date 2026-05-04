/**
 * Template-method wrapper for authenticated API routes.
 *
 * Every data route in this app follows the same skeleton:
 *   1. Require a valid session                  → 401 if missing
 *   2. Check role against ROLE_API_ACCESS       → 403 if denied
 *   3. Run the route's actual work in try/catch
 *   4. On thrown errors, log + return 500
 *
 * Only step 3 varies between routes. `withAuthRoute` codifies the skeleton
 * (the "template") and lets each route supply just the variable step (the
 * "primitive operation"). Two big wins:
 *   - Removes ~10 lines of repeated boilerplate per route × 10 routes.
 *   - Makes it impossible to forget the auth/role check on a new route.
 *
 * The handler receives the validated session and the raw request, and must
 * return a NextResponse — use apiSuccess / apiError from '@/lib/api-response'.
 */
import type { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { canAccessApi } from '@/lib/auth/access'
import { apiError } from '@/lib/api-response'
import type { TokenPayload } from '@/lib/auth/jwt'

export type RouteContext = {
  request: NextRequest
  session: TokenPayload
}

export type AuthRouteHandler = (ctx: RouteContext) => Promise<NextResponse>

export interface WithAuthRouteOptions {
  /** Path used for the role-access lookup (e.g. '/api/dashboard'). */
  apiPath: string
  /** Human-readable message returned to the client when the handler throws. */
  errorMessage: string
}

export function withAuthRoute(
  opts: WithAuthRouteOptions,
  handler: AuthRouteHandler,
): (request: NextRequest) => Promise<NextResponse> {
  const { apiPath, errorMessage } = opts
  return async (request: NextRequest) => {
    const session = await getSession()
    if (!session) return apiError('Unauthorized', 401)
    if (!canAccessApi(session.role, apiPath)) return apiError('Forbidden', 403)
    try {
      return await handler({ request, session })
    } catch (err) {
      console.error(`[API] ${request.method} ${apiPath} failed:`, err)
      return apiError(errorMessage, 500)
    }
  }
}
