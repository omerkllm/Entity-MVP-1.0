import { NextResponse } from 'next/server';

/**
 * Returns a standardised JSON error response.
 * All API routes must use this instead of ad-hoc Response.json() calls.
 *
 * Shape: { error: string, code?: string }
 */
export function apiError(
  message: string,
  status: number,
  code?: string,
): NextResponse {
  const body: { error: string; code?: string } = { error: message };
  if (code !== undefined) {
    body.code = code;
  }
  return NextResponse.json(body, { status });
}

/**
 * Returns a standardised JSON success response.
 * Wraps payload in NextResponse.json with a 200 status (or custom).
 * Adds Cache-Control: stale-while-revalidate so Vercel edge caches
 * responses and serves them instantly on subsequent requests.
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 's-maxage=10, stale-while-revalidate=59',
    },
  });
}

/**
 * Returns a standardised JSON success response that must never be cached.
 * Use for all auth endpoints (login, logout, refresh, session, mfa) where
 * stale responses would be a security issue.
 */
export function apiNoCache<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
