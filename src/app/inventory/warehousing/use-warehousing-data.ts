'use client'

import { useEffect, useState } from 'react'
import { fetchWarehousingData, type WarehousingDataResponse } from '@/lib/api/endpoints'

/**
 * Owns the single network call for the /inventory/warehousing page.
 * Returns the raw response and a loading flag — page-level UI orchestration
 * (selection, pagination, filters) lives in the page itself.
 */
export function useWarehousingData() {
  const [data, setData] = useState<WarehousingDataResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchWarehousingData()
      .then(setData)
      .catch(err => console.error('[useWarehousingData] fetch error:', err))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}
