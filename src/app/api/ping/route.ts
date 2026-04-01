/**
 * Keepalive endpoint — hit by Vercel cron every 4 minutes.
 * Runs a trivial query to prevent Neon compute from auto-suspending.
 * No auth required since it returns no data.
 */
import { query } from '@/lib/db/client'

export async function GET() {
  await query('SELECT 1', [])
  return new Response('ok', { status: 200 })
}
