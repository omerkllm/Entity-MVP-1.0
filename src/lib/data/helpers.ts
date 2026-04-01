/**
 * Pure utility functions for capacity and health calculations.
 * No JSON data imports — safe for client bundles without pulling in data files.
 */

/** Minimum absolute health value considered "positive" (green). Single source of truth. */
export const HEALTH_THRESHOLD = 30;

/** Calculates `(used / total) * 100` rounded to 2 decimal places. */
export function computeCapacityPercent(used: number, total: number): number {
  if (total <= 0) return 0
  return parseFloat(((used / total) * 100).toFixed(2))
}

/** Returns `true` if capacity usage is below 75% (healthy). Red when >=75%. */
export function isCapacityHealthy(pct: number): boolean {
  return pct < 75
}

/** Parses the health string (e.g. `"+42.5%"`) into a numeric float value. */
export function parseHealthValue(health: string): number {
  return parseFloat(health)
}

/** Returns `true` if the absolute health value is >= HEALTH_THRESHOLD (used for green/red styling). */
export function isHealthPositive(health: string): boolean {
  return Math.abs(parseHealthValue(health)) >= HEALTH_THRESHOLD
}
