/**
 * Formatting utilities used across the application.
 */

/** Pad a number to 2 digits (e.g. 2 → "02"). */
export function padTwo(n: number): string {
  return String(n).padStart(2, '0')
}

/** Format warehouse display name: "Warehouse Name { ID }". */
export function formatWarehouseName(warehouseName: string, id: string): string {
  return `${warehouseName.replace(/\s*\{.*\}/, '')} { ${id} }`
}
