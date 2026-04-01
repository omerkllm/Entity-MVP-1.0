import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { pool } from '@/lib/db/client'
import { verifyPassword } from '@/lib/auth/hash'
import { signAccessToken, signRefreshToken, signMfaToken } from '@/lib/auth/jwt'
import { setAuthCookies } from '@/lib/auth/cookies'
import { apiError, apiNoCache } from '@/lib/api-response'
import type { UserRow } from '@/lib/data/types'

// Well-formed dummy hash used to normalise bcrypt timing when no real user is found.
// Prevents username enumeration via response-time differences.
const DUMMY_HASH = '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'

// Simple in-memory rate limiter: max 10 login attempts per IP per 60 seconds.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
let _purgeCounter = 0

function isRateLimited(ip: string): boolean {
  const now = Date.now()

  // Purge expired entries every 500 calls to prevent unbounded map growth
  // in long-running Node.js instances (e.g. local dev, non-serverless deploys).
  if (++_purgeCounter >= 500) {
    _purgeCounter = 0
    for (const [k, v] of rateLimitMap) {
      if (v.resetAt <= now) rateLimitMap.delete(k)
    }
  }

  const entry = rateLimitMap.get(ip)
  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }
  if (entry.count >= 10) return true
  entry.count++
  return false
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(request: NextRequest) {
  if (isRateLimited(getClientIp(request))) {
    return apiError('Too many requests. Try again later.', 429, 'RATE_LIMITED')
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = LoginSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { username, password } = parsed.data

  const { rows } = await pool.query<UserRow>(
    `SELECT user_id, username, email, role, password_hash, mfa_secret,
            is_active, failed_attempts, locked_until
     FROM users WHERE username = $1 LIMIT 1`,
    [username.toLowerCase()]
  )
  const user = rows[0]

  const invalid = () => apiError('Invalid credentials', 401)

  // Account lockout check (before bcrypt to avoid wasting CPU on locked accounts)
  if (user?.locked_until && user.locked_until > new Date()) {
    return apiError('Account temporarily locked. Try again later.', 429, 'ACCOUNT_LOCKED')
  }

  // Always run bcrypt.compare to equalise timing whether user exists or not.
  // This prevents username enumeration via response-time differences.
  const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH)

  if (!user || !user.is_active || !valid) {
    // Only increment failed_attempts for a real, active user with a wrong password
    if (user?.is_active && !valid) {
      const newAttempts = user.failed_attempts + 1
      const lock = newAttempts >= 5
      await pool.query(
        `UPDATE users SET failed_attempts=$1, locked_until=$2 WHERE user_id=$3`,
        [newAttempts, lock ? new Date(Date.now() + 15 * 60 * 1000) : null, user.user_id]
      )
    }
    return invalid()
  }

  // Clear failed attempts on successful authentication
  await pool.query(
    'UPDATE users SET failed_attempts=0, locked_until=NULL WHERE user_id=$1',
    [user.user_id]
  )

  const tokenPayload = { userId: user.user_id, email: user.email, role: user.role }

  // MFA gate — if user has a TOTP secret, issue a short-lived mfa_token instead
  // of full access + refresh tokens. The client must then POST to /api/auth/mfa.
  if (user.mfa_secret) {
    const mfaToken = await signMfaToken(user.user_id)
    return apiNoCache({ mfa_required: true, mfa_token: mfaToken })
  }

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(tokenPayload),
    signRefreshToken(tokenPayload),
  ])

  await setAuthCookies(accessToken, refreshToken, user.role)

  return apiNoCache({ role: user.role, username: user.username })
}
