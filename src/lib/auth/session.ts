import { cookies } from 'next/headers'
import { verifyAccessToken, type TokenPayload } from './jwt'
import { COOKIE_ACCESS } from './cookies'

export async function getSession(): Promise<TokenPayload | null> {
  const store = await cookies()
  const token = store.get(COOKIE_ACCESS)?.value
  if (!token) return null
  try {
    return await verifyAccessToken(token)
  } catch {
    return null
  }
}
