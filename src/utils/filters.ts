/**
 * Generic filter utilities used by warehouse and object filter panels.
 * Extracted from warehousing page to eliminate duplication (DRY).
 */

/**
 * Derive unique filter options from a list of records for a given key.
 */
export function deriveFilterOptions<T extends Record<string, unknown>>(
  records: T[],
  key: keyof T,
  exclude?: string[],
  labelMap?: Record<string, string>,
): { value: string; label?: string }[] {
  const seen = new Set<string>()
  const result: { value: string; label?: string }[] = []
  for (const record of records) {
    const raw = record[key]
    if (raw == null) continue
    const v = String(raw)
    if (exclude?.includes(v)) continue
    if (!seen.has(v)) {
      seen.add(v)
      const label = labelMap?.[v]
      result.push(label ? { value: v, label } : { value: v })
    }
  }
  return result
}

/**
 * Check whether a record passes a single filter category.
 * Returns true if no active filters are set (empty = "show all").
 */
export function matchesFilterSet(value: string, activeSet: Set<string>): boolean {
  if (activeSet.size === 0) return true
  return activeSet.has(value)
}

/**
 * Count how many records would match if a given filter value were toggled.
 * Used to show dynamic counts next to each filter checkbox.
 */
export function computeToggleCount<T extends Record<string, unknown>>(
  records: T[],
  allFilters: Record<string, Set<string>>,
  filterCategories: readonly { key: string }[],
  targetKey: string,
  targetValue: string,
  rangeCheck?: (record: T) => boolean,
): number {
  // Determine hypothetical state for the target filter without cloning
  const currentSet = allFilters[targetKey]
  const isCurrentlyActive = currentSet?.has(targetValue) ?? false
  // After toggle: if currently active → remove it; if not → add it
  // We simulate this inline rather than cloning all Sets

  let count = 0
  for (const record of records) {
    let pass = true
    for (const cat of filterCategories) {
      const active = allFilters[cat.key]
      const val = String(record[cat.key as keyof T])

      if (cat.key === targetKey) {
        // Simulate toggled set
        if (isCurrentlyActive) {
          // Would remove targetValue — effective set is active minus targetValue
          const effectiveSize = active.size - 1
          if (effectiveSize > 0 && !(active.has(val) && val !== targetValue)) {
            pass = false; break
          }
        } else {
          // Would add targetValue — effective set is active plus targetValue
          if (active.size === 0) {
            // Adding first value: only targetValue passes
            if (val !== targetValue) { pass = false; break }
          } else {
            if (!active.has(val) && val !== targetValue) { pass = false; break }
          }
        }
      } else {
        if (active.size > 0 && !active.has(val)) {
          pass = false; break
        }
      }
    }
    if (pass && rangeCheck && !rangeCheck(record)) pass = false
    if (pass) count++
  }
  return count
}

/**
 * Toggle a value in a filter state record. Returns new state object.
 */
export function toggleFilterValue(
  prev: Record<string, Set<string>>,
  key: string,
  value: string,
): Record<string, Set<string>> {
  const next = { ...prev }
  const s = new Set(prev[key] ?? [])
  if (s.has(value)) s.delete(value)
  else s.add(value)
  next[key] = s
  return next
}

/**
 * Clear all filter sets in a filter state record. Returns new state object.
 */
export function clearAllFilters(
  prev: Record<string, Set<string>>,
): Record<string, Set<string>> {
  const next: Record<string, Set<string>> = {}
  for (const k of Object.keys(prev)) next[k] = new Set()
  return next
}

/**
 * Initialize empty filter state for a given list of categories.
 */
export function createEmptyFilters(
  categories: readonly { key: string }[],
): Record<string, Set<string>> {
  const state: Record<string, Set<string>> = {}
  for (const cat of categories) state[cat.key] = new Set()
  return state
}
