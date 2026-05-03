'use client'

import { useEffect, useState } from 'react'
import { fetchScdData, type ScdDataResponse } from '@/lib/api/endpoints'

/**
 * Owns the single network call for the /supply-chain-dashboard page.
 * Returns the raw response and a loading flag — page-level UI orchestration
 * (dropdown selections, derived filters, charts) lives in the page itself.
 */
export function useScdData() {
  const [data, setData] = useState<ScdDataResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchScdData()
      .then(setData)
      .catch(err => console.error('[useScdData] fetch error:', err))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}
