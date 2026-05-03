import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticator } from 'otplib'
import { query } from '@/lib/db/client'
import { signAccessToken, signRefreshToken, verifyMfaToken } from '@/lib/auth/jwt'
import { setAuthCookies } from '@/lib/auth/cookies'
import { apiError, apiNoCache } from '@/lib/api-response'
import type { MfaUserRow } from '@/lib/data/types'

const MfaSchema = z.object({
  mfa_token: z.string().min(1, 'mfa_token is required'),
  code: z.string().min(6, 'code must be at least 6 digits'),
})

export async function POST(request: Request) {
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = MfaSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { mfa_token, code } = parsed.data

  // Verify the short-lived MFA token issued by /api/auth/login
  let userId: string
  try {
    userId = await verifyMfaToken(mfa_token)
  } catch {
    return apiError('Invalid or expired MFA token', 401, 'MFA_TOKEN_INVALID')
  }

  // Look up user — must still be active
  const { rows } = await query<MfaUserRow>(
    'SELECT user_id, email, role, is_active, mfa_secret FROM users WHERE user_id = $1 LIMIT 1',
    [userId],
  )
  const user = rows[0]
  if (!user?.is_active || !user.mfa_secret) {
    return apiError('Unauthorized', 401)
  }

  // Verify the TOTP code against the stored secret
  const valid = authenticator.verify({ token: code, secret: user.mfa_secret })
  if (!valid) {
    return apiError('Invalid or expired TOTP code', 401, 'MFA_CODE_INVALID')
  }

  // Issue full access + refresh tokens
  const tokenPayload = { userId: user.user_id, email: user.email, role: user.role }
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(tokenPayload),
    signRefreshToken(tokenPayload),
  ])
  await setAuthCookies(accessToken, refreshToken, user.role)

  return apiNoCache({ role: user.role })
}
