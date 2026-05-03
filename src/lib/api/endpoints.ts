// Single place where HTTP endpoint paths live for client-side fetches.
// Components import named functions from here instead of hardcoding URLs;
// this isolates the wire format from React code (DIP).

import api from '@/lib/api'
import type {
  DBWarehouse,
  DBBusiness,
  ObjectRecord,
  SupplyChainNode,
  ActivityLogEntry,
} from '@/lib/data/types'
import type { PaginatedResult } from '@/lib/db/pagination'

// ─── Response shapes (mirror what each /api route actually returns) ──

export type WarehousingDataResponse = {
  warehouses: PaginatedResult<DBWarehouse>
  processes:  PaginatedResult<SupplyChainNode>
  objects:    PaginatedResult<ObjectRecord>
}

export type ScdDataResponse = {
  processes:  PaginatedResult<SupplyChainNode>
  activity:   PaginatedResult<ActivityLogEntry>
  warehouses: PaginatedResult<DBWarehouse>
  dashboard: {
    disruption_count: number
    avg_health: number
    warehouse_count: number
    node_count: number
  }
}

export type DmpDataResponse = {
  warehouses: PaginatedResult<DBWarehouse>
  businesses: PaginatedResult<DBBusiness>
}

export type LoginResponse = { role: string; username: string }

// ─── Endpoint functions ─────────────────────────────────────────────

const unwrap = <T>(p: Promise<{ data: T }>): Promise<T> => p.then(r => r.data)

export const fetchWarehousingData = () =>
  unwrap<WarehousingDataResponse>(api.get('/api/warehousing-data'))

export const fetchScdData = () =>
  unwrap<ScdDataResponse>(api.get('/api/scd-data'))

export const fetchDmpData = () =>
  unwrap<DmpDataResponse>(api.get('/api/dmp-data'))

export const fetchProcesses = () =>
  unwrap<PaginatedResult<SupplyChainNode>>(api.get('/api/processes'))

export const fetchObjectsByWarehouse = (warehouseId: string) =>
  unwrap<PaginatedResult<ObjectRecord>>(api.get(`/api/objects?warehouseId=${encodeURIComponent(warehouseId)}`))

export const postLogout = () => api.post('/api/auth/logout')
