'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchDmpData } from '@/lib/api/endpoints'
import type { DBBusiness, DBWarehouse } from '@/lib/data/types'
import type { BusinessPin } from '@/components/DmpMap'

/**
 * Owns the single network call for the /decision-making page.
 * Returns the warehouses, raw businesses, derived map pins, and a loading flag.
 * Pin transformation lives here because it's purely a data-shape concern,
 * not page UI orchestration.
 */
export function useDmpData() {
  const [warehouses, setWarehouses] = useState<DBWarehouse[]>([])
  const [rawBusinesses, setRawBusinesses] = useState<DBBusiness[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDmpData()
      .then(d => {
        setWarehouses(d.warehouses.data)
        setRawBusinesses(d.businesses.data)
      })
      .catch(err => console.error('[useDmpData] fetch error:', err))
      .finally(() => setLoading(false))
  }, [])

  const businesses: BusinessPin[] = useMemo(
    () => rawBusinesses.map(b => ({
      id: b.businessId,
      name: `${b.objectCategory} (${b.region})`,
      coordinates: b.coordinates,
      objectCategory: b.objectCategory,
      linkType: b.linkType ? (b.linkType.toLowerCase() as 'supplier' | 'customer') : null,
      linkedWarehouseIds: b.linkedWarehouseIds,
    })),
    [rawBusinesses],
  )

  return { warehouses, rawBusinesses, businesses, loading }
}
