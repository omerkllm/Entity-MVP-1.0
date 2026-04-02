import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAccessToken } from '@/lib/auth/jwt'

// Inline rather than importing from @/lib/auth/cookies to avoid pulling in
// `next/headers` (server-only) into the Edge proxy runtime.
const COOKIE_ACCESS = 'entity-token'

// ─── Static constants (allocated once at module load) ───────────────
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/refresh', '/api/auth/mfa']

const ROLE_PAGE_ACCESS: Record<string, string[]> = {
  WO:  ['/inventory'],
  SC:  ['/decision-making', '/inventory'],
  SCA: ['/supply-chain-dashboard'],
  SA:  ['/supply-chain-dashboard', '/inventory', '/decision-making'],
}

const ROLE_API_ACCESS: Record<string, string[]> = {
  WO:  ['/api/warehouses', '/api/objects', '/api/activity', '/api/processes', '/api/categories', '/api/warehousing-data'],
  SC:  ['/api/warehouses', '/api/objects', '/api/activity', '/api/businesses', '/api/processes', '/api/categories', '/api/dmp-data', '/api/warehousing-data'],
  SCA: ['/api/warehouses', '/api/objects', '/api/activity', '/api/businesses', '/api/processes', '/api/categories', '/api/dashboard', '/api/scd-data', '/api/warehousing-data'],
  SA:  ['/api/'],  // full access
}

const ROLE_DEFAULTS: Record<string, string> = {
  SA:  '/supply-chain-dashboard',
  SCA: '/supply-chain-dashboard',
  SC:  '/decision-making',
  WO:  '/inventory/warehousing',
}

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

      const apiAllowed = ROLE_API_ACCESS[role]
      if (!apiAllowed || !apiAllowed.some(prefix => pathname.startsWith(prefix))) {
        return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
      }

      return NextResponse.next()
    }

    // ── Page routes: role-based path restrictions ────────────────────────────
    const allowed = ROLE_PAGE_ACCESS[role]

    if (!allowed) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    if (!allowed.some(prefix => pathname.startsWith(prefix))) {
      return NextResponse.redirect(new URL(ROLE_DEFAULTS[role] ?? '/login', request.url))
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
