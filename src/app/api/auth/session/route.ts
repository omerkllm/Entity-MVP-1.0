import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { apiError } from '@/lib/api-response'

export async function GET() {
  const session = await getSession()
  if (!session) return apiError('Unauthorized', 401)
  return NextResponse.json({ role: session.role, userId: session.userId })
}
