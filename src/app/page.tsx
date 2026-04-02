
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'

const ROLE_DEFAULTS: Record<string, string> = {
  SA:  '/supply-chain-dashboard',
  SCA: '/supply-chain-dashboard',
  SC:  '/decision-making',
  WO:  '/inventory/warehousing',
}

export default async function Home() {
  const session = await getSession()
  if (session) {
    redirect(ROLE_DEFAULTS[session.role] ?? '/login')
  }
  redirect('/login')
}
