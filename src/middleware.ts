import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { canAccessApi, canAccessPage, defaultRouteFor } from '@/lib/auth/access'

// Inline rather than importing from @/lib/auth/cookies to avoid pulling in
// `next/headers` (server-only) into the Edge proxy runtime.
const COOKIE_ACCESS = 'entity-token'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/refresh', '/api/auth/mfa']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/favicon') ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$/i.test(pathname)
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get(COOKIE_ACCESS)?.value

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  try {
    const payload = await verifyAccessToken(token)
    const role = payload.role as string

    // ── API paths: per-route role-based access control ──────────────────────
    if (pathname.startsWith('/api/')) {
      // Auth-management endpoints (logout, session, mfa) are accessible to all
      // authenticated users regardless of role.
      if (pathname.startsWith('/api/auth/')) {
        return NextResponse.next()
      }

      if (!canAccessApi(role, pathname)) {
        return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
      }

      return NextResponse.next()
    }

    // ── Page routes: role-based path restrictions ────────────────────────────
    if (!canAccessPage(role, pathname)) {
      return NextResponse.redirect(new URL(defaultRouteFor(role), request.url))
    }

    return NextResponse.next()
  } catch {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
