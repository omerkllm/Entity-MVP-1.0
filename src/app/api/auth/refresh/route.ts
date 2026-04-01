import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyRefreshToken, signAccessToken } from '@/lib/auth/jwt'
import { COOKIE_REFRESH, refreshAccessCookie } from '@/lib/auth/cookies'
import { apiError } from '@/lib/api-response'
import { pool } from '@/lib/db/client'

export async function POST() {
  const store = await cookies()
  const refreshToken = store.get(COOKIE_REFRESH)?.value

  if (!refreshToken) return apiError('No refresh token', 401)

  try {
    // jose verifies the `exp` claim automatically, enforcing the absolute expiry
    // that was baked in when the refresh token was originally signed.
    // We do NOT re-sign the refresh token here — that would create a sliding window.
    const payload = await verifyRefreshToken(refreshToken)

    // Verify the user is still active before issuing a new access token
    const { rows } = await pool.query<{ is_active: boolean }>(
      'SELECT is_active FROM users WHERE user_id = $1',
      [payload.userId]
    )
    if (!rows[0]?.is_active) return apiError('Account inactive', 401)

    // Issue a new access token only — refresh token stays unchanged
    const tokenPayload = { userId: payload.userId, email: payload.email, role: payload.role }
    const newAccess = await signAccessToken(tokenPayload)
    await refreshAccessCookie(newAccess, payload.role)

    return NextResponse.json({ success: true })
  } catch {
    return apiError('Invalid or expired refresh token', 401)
  }
}
