import { cookies } from 'next/headers'

// ─── Shared auth constants ──────────────────────────────────────────
export const COOKIE_ACCESS  = 'entity-token'
export const COOKIE_REFRESH = 'entity-refresh'
export const COOKIE_ROLE    = 'entity-role'

/** Must stay in sync with ACCESS_TOKEN_EXPIRY in jwt.ts ('15m'). */
export const ACCESS_MAX_AGE_S  = 60 * 15            // 15 minutes
/** Must stay in sync with REFRESH_TOKEN_EXPIRY in jwt.ts ('7d'). */
export const REFRESH_MAX_AGE_S = 60 * 60 * 24 * 7   // 7 days

const IS_PROD = process.env.NODE_ENV === 'production'

// ─── Shared cookie options builders ─────────────────────────────────
function accessCookieOpts() {
  return { httpOnly: true, secure: IS_PROD, sameSite: 'lax' as const, path: '/', maxAge: ACCESS_MAX_AGE_S }
}
function refreshCookieOpts() {
  return { httpOnly: true, secure: IS_PROD, sameSite: 'lax' as const, path: '/', maxAge: REFRESH_MAX_AGE_S }
}
function roleCookieOpts() {
  return { httpOnly: false, secure: IS_PROD, sameSite: 'lax' as const, path: '/', maxAge: REFRESH_MAX_AGE_S }
}

/** Client-readable cookie so Sidebar can show nav icons synchronously. */
function setRoleCookie(store: Awaited<ReturnType<typeof cookies>>, role: string) {
  store.set(COOKIE_ROLE, role, roleCookieOpts())
}

export async function setAuthCookies(accessToken: string, refreshToken: string, role: string) {
  const store = await cookies()
  store.set(COOKIE_ACCESS, accessToken, accessCookieOpts())
  store.set(COOKIE_REFRESH, refreshToken, refreshCookieOpts())
  setRoleCookie(store, role)
}

/** Sets only the access-token and role cookies (used by the refresh flow). */
export async function refreshAccessCookie(accessToken: string, role: string) {
  const store = await cookies()
  store.set(COOKIE_ACCESS, accessToken, accessCookieOpts())
  setRoleCookie(store, role)
}

export async function clearAuthCookies() {
  const store = await cookies()
  store.delete(COOKIE_ACCESS)
  store.delete(COOKIE_REFRESH)
  store.delete(COOKIE_ROLE)
}
