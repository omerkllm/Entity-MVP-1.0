// Single source of truth for role-based access control.
// Edge-runtime safe: pure constants + pure functions, no `next/headers` or Node deps.
// Imported by:
//   - src/middleware.ts (Edge)
//   - src/app/api/*/route.ts (Node)
//   - src/components/Sidebar.tsx (client)

export type Role = 'SA' | 'SCA' | 'SC' | 'WO'

export const ROLE_PAGE_ACCESS: Record<Role, readonly string[]> = {
  WO:  ['/inventory'],
  SC:  ['/decision-making', '/inventory'],
  SCA: ['/supply-chain-dashboard'],
  SA:  ['/supply-chain-dashboard', '/inventory', '/decision-making'],
}

export const ROLE_API_ACCESS: Record<Role, readonly string[]> = {
  WO:  ['/api/warehouses', '/api/objects', '/api/activity', '/api/processes', '/api/categories', '/api/warehousing-data'],
  SC:  ['/api/warehouses', '/api/objects', '/api/activity', '/api/businesses', '/api/processes', '/api/categories', '/api/dmp-data', '/api/warehousing-data'],
  SCA: ['/api/warehouses', '/api/objects', '/api/activity', '/api/businesses', '/api/processes', '/api/categories', '/api/dashboard', '/api/scd-data', '/api/warehousing-data'],
  SA:  ['/api/'],
}

export const ROLE_DEFAULTS: Record<Role, string> = {
  SA:  '/supply-chain-dashboard',
  SCA: '/supply-chain-dashboard',
  SC:  '/decision-making',
  WO:  '/inventory/warehousing',
}

export function isRole(value: unknown): value is Role {
  return value === 'SA' || value === 'SCA' || value === 'SC' || value === 'WO'
}

export function canAccessApi(role: string, pathname: string): boolean {
  if (!isRole(role)) return false
  return ROLE_API_ACCESS[role].some(prefix => pathname.startsWith(prefix))
}

export function canAccessPage(role: string, pathname: string): boolean {
  if (!isRole(role)) return false
  return ROLE_PAGE_ACCESS[role].some(prefix => pathname.startsWith(prefix))
}

export function defaultRouteFor(role: string): string {
  return isRole(role) ? ROLE_DEFAULTS[role] : '/login'
}
