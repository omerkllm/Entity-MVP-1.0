/**
 * Pure geometry helpers for DMP map rendering.
 * No DOM or MapLibre dependencies — safe for testing and server-side import.
 */

/** Parse a human-readable coordinate string (e.g. "30.5°N, 69.3°E") to [lng, lat]. */
export function parseLngLat(coord: string): [number, number] | null {
  if (!coord) return null
  const m = coord.match(/([\d.]+)\s*°?\s*([NS]),?\s*([\d.]+)\s*°?\s*([EW])/i)
  if (!m) return null
  let lat = parseFloat(m[1])
  let lng = parseFloat(m[3])
  if (m[2].toUpperCase() === 'S') lat = -lat
  if (m[4].toUpperCase() === 'W') lng = -lng
  return [lng, lat]
}

/** Generate a circle of points around a center in degrees. */
export function circleAround(center: [number, number], radiusDeg: number, segments = 36): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i <= segments; i++) {
    const angle = (2 * Math.PI * i) / segments
    pts.push([
      center[0] + radiusDeg * Math.cos(angle),
      // compress lat slightly for visual roundness on a Mercator projection
      center[1] + radiusDeg * Math.sin(angle) * 0.75,
    ])
  }
  return pts
}

/** Convex hull via gift-wrapping algorithm. */
export function convexHull(pts: [number, number][]): [number, number][] {
  if (pts.length < 3) return [...pts, pts[0]]
  const n = pts.length
  let l = 0
  for (let i = 1; i < n; i++) if (pts[i][0] < pts[l][0]) l = i
  const hull: [number, number][] = []
  let p = l
  let safe = 0
  do {
    hull.push(pts[p])
    let q = (p + 1) % n
    for (let i = 0; i < n; i++) {
      const cross =
        (pts[q][0] - pts[p][0]) * (pts[i][1] - pts[p][1]) -
        (pts[q][1] - pts[p][1]) * (pts[i][0] - pts[p][0])
      if (cross < 0) q = i
    }
    p = q
  } while (p !== l && ++safe < n + 1)
  hull.push(hull[0]) // close ring
  return hull
}

/** Build a buffered zone: circle each point then take convex hull of all circle points. */
export function buildBufferedZone(coords: [number, number][], radiusDeg: number): [number, number][] {
  const allPts: [number, number][] = []
  for (const c of coords) {
    allPts.push(...circleAround(c, radiusDeg, 24))
  }
  return convexHull(allPts)
}

/** Quadratic Bézier curve between two points (for supply-chain flow arrows). */
export function curvedLine(from: [number, number], to: [number, number], segments = 32): [number, number][] {
  const midLng = (from[0] + to[0]) / 2
  const midLat = (from[1] + to[1]) / 2
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const dist = Math.sqrt(dx * dx + dy * dy)
  const offset = dist * 0.25
  const cpLng = midLng - (dy / dist) * offset
  const cpLat = midLat + (dx / dist) * offset
  const pts: [number, number][] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const u = 1 - t
    pts.push([
      u * u * from[0] + 2 * u * t * cpLng + t * t * to[0],
      u * u * from[1] + 2 * u * t * cpLat + t * t * to[1],
    ])
  }
  return pts
}

/** Bearing in degrees between two lng/lat points. */
export function computeBearing(from: [number, number], to: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLng = toRad(to[0] - from[0])
  const lat1 = toRad(from[1])
  const lat2 = toRad(to[1])
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** Compute a tight bounding box from an array of [lng, lat] coords. */
export function computeBounds(coords: [number, number][]): [[number, number], [number, number]] | null {
  if (coords.length === 0) return null
  const minLng = Math.min(...coords.map(c => c[0]))
  const maxLng = Math.max(...coords.map(c => c[0]))
  const minLat = Math.min(...coords.map(c => c[1]))
  const maxLat = Math.max(...coords.map(c => c[1]))
  return [[minLng, minLat], [maxLng, maxLat]]
}
