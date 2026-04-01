import type { DBWarehouse } from '@/lib/data/types'

export type BusinessPin = {
  id: string
  name: string
  coordinates: string
  objectCategory: string
  linkType: 'supplier' | 'customer' | null
  linkedWarehouseIds: string[]
}

export type DmpMapHandle = {
  zoomTo: (coordinates: string) => void
  resetZoom: () => void
}

export interface DmpMapProps {
  warehouses: DBWarehouse[]
  businesses?: BusinessPin[]
  onPinClick?: (type: 'warehouse' | 'business', id: string) => void
}
