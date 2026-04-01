import { clearAuthCookies } from '@/lib/auth/cookies'
import { apiNoCache } from '@/lib/api-response'

export async function POST() {
  await clearAuthCookies()
  return apiNoCache({ success: true })
}
