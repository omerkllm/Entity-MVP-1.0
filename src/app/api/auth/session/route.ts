import { getSession } from '@/lib/auth/session'
import { apiError, apiNoCache } from '@/lib/api-response'

export async function GET() {
  const session = await getSession()
  if (!session) return apiError('Unauthorized', 401)
  return apiNoCache({ role: session.role, userId: session.userId })
}
