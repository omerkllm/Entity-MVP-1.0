/**
 * MapLibre layer management — static overlays, arrows, zones, and pin markers.
 * Separated from the React component so map setup logic is testable and reusable.
 */
import maplibregl from 'maplibre-gl'
import type { DBWarehouse } from '@/lib/data/types'
import type { BusinessPin, DmpMapProps } from './types'
import { parseLngLat, buildBufferedZone, curvedLine, computeBearing } from './geo'

/* ── Theme ────────────────────────────────────────────────────────── */
// Single source of truth for link-type colours used by both the line layer,
// the arrow-tip icons, and the icon image registration.
export const LINK_TYPE_COLORS = {
  supplier: '#818cf8',
  customer: '#f472b6',
} as const

const FALLBACK_LINK_COLOR = LINK_TYPE_COLORS.supplier

/* ── Helpers ──────────────────────────────────────────────────────── */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function createArrowImage(color: string, size: number): ImageData {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  const cx = size / 2
  const pad = size * 0.15
  const strokeW = Math.max(2, size * 0.1)
  ctx.strokeStyle = color
  ctx.lineWidth = strokeW
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(pad, size - pad)
  ctx.lineTo(cx, pad)
  ctx.lineTo(size - pad, size - pad)
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

/* ── Public API ───────────────────────────────────────────────────── */

export function applyEnglishLabels(map: maplibregl.Map) {
  const style = map.getStyle()
  if (!style) return
  style.layers?.forEach(layer => {
    if (layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout) {
      map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']])
    }
  })
}

export function addArrowImages(map: maplibregl.Map) {
  if (!map.hasImage('arrow-supplier')) {
    map.addImage('arrow-supplier', createArrowImage(LINK_TYPE_COLORS.supplier, 32))
    map.addImage('arrow-customer', createArrowImage(LINK_TYPE_COLORS.customer, 32))
  }
}

const WORLD_POLY: GeoJSON.Feature<GeoJSON.Polygon> = {
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]] },
  properties: {},
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/** Adds idempotent static layers (darken overlay, arrow sources, zone sources). */
export function renderStaticLayers(map: maplibregl.Map) {
  if (map.getSource('darken')) return
  const style = map.getStyle()
  if (!style) return
  const firstSymbol = style.layers?.find(l => l.type === 'symbol')?.id

  // Darken overlay
  map.addSource('darken', { type: 'geojson', data: WORLD_POLY })
  map.addLayer({
    id: 'darken-overlay', type: 'fill', source: 'darken',
    paint: { 'fill-color': '#000000', 'fill-opacity': 0.45 },
  }, firstSymbol)

  // Arrow line + tip layers (data set later via setData)
  map.addSource('arrows', { type: 'geojson', data: EMPTY_FC })
  map.addLayer({
    id: 'arrows-line', type: 'line', source: 'arrows',
    paint: {
      'line-color': ['match', ['get', 'linkType'], 'supplier', LINK_TYPE_COLORS.supplier, 'customer', LINK_TYPE_COLORS.customer, FALLBACK_LINK_COLOR],
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1, 6, 1.5, 10, 2.5, 14, 4],
      'line-opacity': 0.8,
    },
  }, firstSymbol)

  map.addSource('arrow-tips', { type: 'geojson', data: EMPTY_FC })
  map.addLayer({
    id: 'arrow-heads', type: 'symbol', source: 'arrow-tips',
    layout: {
      'icon-image': ['match', ['get', 'linkType'], 'supplier', 'arrow-supplier', 'customer', 'arrow-customer', 'arrow-supplier'],
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.2, 6, 0.4, 10, 0.7, 14, 1.2],
    },
  }, firstSymbol)

  // Zone (buffered convex hull around warehouses)
  map.addSource('zone', { type: 'geojson', data: EMPTY_FC })
  map.addLayer({ id: 'zone-fill', type: 'fill', source: 'zone', paint: { 'fill-color': '#1a7f37', 'fill-opacity': 0.08 } }, firstSymbol)
  map.addLayer({ id: 'zone-border', type: 'line', source: 'zone', paint: { 'line-color': '#2ea043', 'line-width': 1.5, 'line-dasharray': [5, 3] } }, firstSymbol)
}

/* ── Pin + Data layer update ──────────────────────────────────────── */

export function updatePins(
  map: maplibregl.Map,
  warehouses: DBWarehouse[],
  businesses: BusinessPin[],
  onPinClick: DmpMapProps['onPinClick'],
  markersRef: React.MutableRefObject<maplibregl.Marker[]>,
) {
  // Remove previous DOM markers
  markersRef.current.forEach(m => m.remove())
  markersRef.current = []

  const warehousePoints = warehouses
    .map(w => ({ w, lngLat: parseLngLat(w.coordinates) }))
    .filter((x): x is { w: DBWarehouse; lngLat: [number, number] } => x.lngLat !== null)

  const businessPoints = businesses
    .map(b => ({ b, lngLat: parseLngLat(b.coordinates) }))
    .filter((x): x is { b: BusinessPin; lngLat: [number, number] } => x.lngLat !== null)

  // Zone
  const whCoords = warehousePoints.map(x => x.lngLat)
  const zoneSrc = map.getSource('zone') as maplibregl.GeoJSONSource | undefined
  if (whCoords.length >= 2) {
    const zoneRing = buildBufferedZone(whCoords, 1.2)
    zoneSrc?.setData({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [zoneRing] }, properties: {} })
  } else {
    zoneSrc?.setData(EMPTY_FC)
  }

  // Arrows
  const warehouseCoordMap = new Map(warehousePoints.map(x => [x.w.warehouseId, x.lngLat]))
  const arrowFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = []
  const tipFeatures: GeoJSON.Feature<GeoJSON.Point>[] = []

  for (const b of businesses) {
    if (!b.linkType || b.linkedWarehouseIds.length === 0) continue
    const bLngLat = parseLngLat(b.coordinates)
    if (!bLngLat) continue

    for (const whId of b.linkedWarehouseIds) {
      const wLngLat = warehouseCoordMap.get(whId)
      if (!wLngLat) continue
      const [from, to] = b.linkType === 'supplier' ? [bLngLat, wLngLat] : [wLngLat, bLngLat]
      const curved = curvedLine(from, to)
      arrowFeatures.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: curved }, properties: { linkType: b.linkType } })

      const mid = Math.floor(curved.length / 2)
      tipFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: curved[mid] },
        properties: { linkType: b.linkType, bearing: computeBearing(curved[mid - 1], curved[mid + 1]) },
      })
    }
  }

  ;(map.getSource('arrows') as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: arrowFeatures })
  ;(map.getSource('arrow-tips') as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: tipFeatures })

  // Warehouse markers
  for (const { w, lngLat } of warehousePoints) {
    const el = document.createElement('div')
    el.className = 'dmp-pin dmp-pin-warehouse'
    el.innerHTML = '<img src="/icons/warehouse.svg" alt="" />'
    el.title = w.title
    el.addEventListener('click', e => { e.stopPropagation(); onPinClick?.('warehouse', w.warehouseId) })
    const popup = new maplibregl.Popup({ offset: 18, closeButton: false, maxWidth: '200px' })
      .setHTML(`<div style="line-height:1.5"><div style="font-weight:600">${escapeHtml(w.title)}</div><div style="opacity:.7">${escapeHtml(w.warehouseId)} - ${escapeHtml(w.region)}</div><div style="opacity:.7">${escapeHtml(w.status)} - ${escapeHtml(w.objectCategory)}</div></div>`)
    markersRef.current.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).setPopup(popup).addTo(map))
  }

  // Business markers
  for (const { b, lngLat } of businessPoints) {
    const isLinked = b.linkedWarehouseIds.length > 0
    const el = document.createElement('div')
    el.className = `dmp-pin ${isLinked ? 'dmp-pin-supplier' : 'dmp-pin-external'}`
    el.innerHTML = '<img src="/icons/business.svg" alt="" />'
    el.title = b.name
    el.addEventListener('click', e => { e.stopPropagation(); onPinClick?.('business', b.id) })
    const popup = new maplibregl.Popup({ offset: 18, closeButton: false, maxWidth: '200px' })
      .setHTML(`<div style="line-height:1.5"><div style="font-weight:600">${escapeHtml(b.name)}</div><div style="opacity:.7">${b.linkType ? escapeHtml(b.linkType.charAt(0).toUpperCase() + b.linkType.slice(1)) : 'No link'}</div></div>`)
    markersRef.current.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).setPopup(popup).addTo(map))
  }
}
