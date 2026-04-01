'use client'

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import maplibregl from 'maplibre-gl'
import { parseLngLat } from './map/geo'
import { applyEnglishLabels, addArrowImages, renderStaticLayers, updatePins } from './map/layers'
import MapKeyMissing from './map/MapKeyMissing'
import type { DmpMapHandle, DmpMapProps } from './map/types'

export type { BusinessPin, DmpMapHandle } from './map/types'

const DEFAULT_CENTER: [number, number] = [72.3, 32.2]
const DEFAULT_ZOOM = 6
const FLY_ZOOM = 14
const FLY_DURATION = 1200

function buildStyleUrl(key: string): string {
  return `https://api.maptiler.com/maps/basic-v2-dark/style.json?key=${key}`
}

const DmpMap = forwardRef<DmpMapHandle, DmpMapProps>(function DmpMap({ warehouses, businesses = [], onPinClick }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<maplibregl.Map | null>(null)
  const markersRef   = useRef<maplibregl.Marker[]>([])
  const mapReadyRef  = useRef(false)

  const latestRef = useRef({ warehouses, businesses, onPinClick })
  latestRef.current = { warehouses, businesses, onPinClick }

  useImperativeHandle(ref, () => ({
    zoomTo(coordinates: string) {
      const map = mapRef.current
      if (!map || !mapReadyRef.current) return
      const lngLat = parseLngLat(coordinates)
      if (!lngLat) return
      map.flyTo({ center: lngLat, zoom: FLY_ZOOM, duration: FLY_DURATION })
    },
    resetZoom() {
      const map = mapRef.current
      if (!map || !mapReadyRef.current) return
      map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: FLY_DURATION })
    },
  }), [])

  const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY

  /** Initialises map layers and pins after a style load event. */
  function hydrateMap(map: maplibregl.Map) {
    const { warehouses: w, businesses: b, onPinClick: cb } = latestRef.current
    applyEnglishLabels(map)
    addArrowImages(map)
    renderStaticLayers(map)
    updatePins(map, w, b, cb, markersRef)
  }

  // ── 1. Create map ONCE ─────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !MAPTILER_KEY) return

    mapReadyRef.current = false
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyleUrl(MAPTILER_KEY),
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    })
    mapRef.current = map

    map.once('load', () => {
      if (mapRef.current !== map) return
      hydrateMap(map)
      mapReadyRef.current = true
    })

    return () => {
      mapReadyRef.current = false
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      mapRef.current = null
      // Defer removal so MapLibre's internal rendering generators
      // can finish before the WebGL context is destroyed.
      requestAnimationFrame(() => map.remove())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [MAPTILER_KEY])

  // ── 2. Update pins when filtered data changes ──────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReadyRef.current) return
    updatePins(map, warehouses, businesses, onPinClick, markersRef)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouses, businesses])

  if (!MAPTILER_KEY) return <MapKeyMissing />

  return <div ref={containerRef} className="w-full h-full" />
})

export default DmpMap