import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

// ─── Token expiry constants (must stay in sync with cookie maxAge in cookies.ts) ──
export const ACCESS_TOKEN_EXPIRY  = '15m'
export const REFRESH_TOKEN_EXPIRY = '7d'
const MFA_TOKEN_EXPIRY            = '5m'

const ALG = 'HS256' as const

export type TokenPayload = JWTPayload & {
  userId: string
  email: string
  role: string
}

function secret(key: 'JWT_SECRET' | 'JWT_REFRESH_SECRET') {
  const val = process.env[key]
  if (!val) throw new Error(`${key} is not set`)
  return new TextEncoder().encode(val)
}

// ─── Access / Refresh tokens ────────────────────────────────────────

export async function signAccessToken(payload: Omit<TokenPayload, keyof JWTPayload>): Promise<string> {
  return new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(secret('JWT_SECRET'))
}

export async function signRefreshToken(payload: Omit<TokenPayload, keyof JWTPayload>): Promise<string> {
  return new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(secret('JWT_REFRESH_SECRET'))
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, secret('JWT_SECRET'))
  return payload as TokenPayload
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, secret('JWT_REFRESH_SECRET'))
  return payload as TokenPayload
}

// ─── MFA tokens (short-lived, userId-only payload) ──────────────────

export async function signMfaToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(MFA_TOKEN_EXPIRY)
    .sign(secret('JWT_SECRET'))
}

export async function verifyMfaToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret('JWT_SECRET'))
  if (typeof payload.userId !== 'string') throw new Error('Invalid MFA token payload')
  return payload.userId
}
