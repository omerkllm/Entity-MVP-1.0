import { memo, useEffect, useRef, useMemo, useState } from 'react'
import api from '@/lib/api'
import type { ObjectRecord } from '@/lib/data/types'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const TRANSIT_COLORS = ['#a855f7', '#c084fc', '#d8b4fe', '#7e22ce', '#9333ea'] as const
const EMPTY_DONUT_DATA = [{ name: 'Empty', value: 1, color: '#222' }] as const
const TOOLTIP_STYLE_LIGHT = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 11, color: '#222', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' } as const
const TOOLTIP_STYLE_DARK = { background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, fontSize: 11, color: '#fff' } as const
const WORLD_POLY: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature', properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]],
    },
  }],
}

export type WarehouseForInspector = {
  warehouseId: string
  warehouseName: string
  region: string
  coordinates: string
  hours: string
  status: string
  address: string
  usedCapacity: number
  totalCapacity: number
  objectCategory: string
  businessLinkType: string | null
}

type Props = {
  warehouse: WarehouseForInspector
  onClose: () => void
  showMap?: boolean
}

function WarehouseInspector({ warehouse: w, onClose, showMap = true }: Props) {
  const [objects, setObjects] = useState<ObjectRecord[]>([])
  const [chartView, setChartView] = useState<'allocated' | 'in-depth'>('allocated')
  useEffect(() => {
    api.get(`/api/objects?warehouseId=${w.warehouseId}`)
      .then(res => setObjects(res.data.data ?? []))
      .catch(() => setObjects([]))
  }, [w.warehouseId])

  const { allocatedData, transitData } = useMemo(() => {
    // Non-transit objects grouped by category
    const nonTransit = objects.filter(o => o.transitStatus !== 'In Transit')
    const catTotals = new Map<string, number>()
    for (const o of nonTransit) {
      catTotals.set(o.objectCategory, (catTotals.get(o.objectCategory) ?? 0) + o.quantity)
    }
    let majorName = 'Major'
    let majorQty = 0
    for (const [cat, qty] of catTotals) {
      if (qty > majorQty) { majorName = cat; majorQty = qty }
    }
    const otherQty = nonTransit.reduce((s, o) => s + o.quantity, 0) - majorQty

    // Transit objects grouped by category, sorted by quantity desc
    const transitObjects = objects.filter(o => o.transitStatus === 'In Transit')
    const transitCatTotals = new Map<string, number>()
    for (const o of transitObjects) {
      transitCatTotals.set(o.objectCategory, (transitCatTotals.get(o.objectCategory) ?? 0) + o.quantity)
    }
    const transitTotalQty = transitObjects.reduce((s, o) => s + o.quantity, 0)

    // Free space based on all used
    const freeQty = w.totalCapacity - (majorQty + otherQty + transitTotalQty)
    const exceeded = freeQty < 0
    let freeColor: string
    if (exceeded) {
      freeColor = '#eab308'
    } else {
      const freePct = w.totalCapacity > 0 ? (freeQty / w.totalCapacity) * 100 : 100
      freeColor = freePct < 25 ? '#dc2626' : '#16a34a'
    }

    const allocatedData = [
      { name: majorName, value: majorQty, color: '#3b82f6' },
      { name: 'Other', value: otherQty, color: '#60a5fa' },
      { name: 'In Transit', value: transitTotalQty, color: '#a855f7' },
      { name: exceeded ? 'Exceeded' : 'Free', value: Math.abs(freeQty), color: freeColor },
    ]
    const transitData = Array.from(transitCatTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], idx) => ({ name, value, color: TRANSIT_COLORS[idx % TRANSIT_COLORS.length] }))

    return { allocatedData, transitData }
  }, [objects, w.totalCapacity])

  const allocatedDonutData = useMemo(() =>
    allocatedData.filter(d => d.name !== 'Free' && d.name !== 'Exceeded' && d.value > 0),
    [allocatedData]
  )

  const warehouseDetails = useMemo(() => [
    { label: 'Warehouse ID',      value: w.warehouseId,      colorClass: '' },
    { label: 'Title',             value: w.warehouseName,    colorClass: '' },
    { label: 'Region',            value: w.region,           colorClass: '' },
    { label: 'Coordinates',       value: w.coordinates,      colorClass: '' },
    { label: 'Operational Hours', value: w.hours,            colorClass: '' },
    { label: 'Object Category',   value: w.objectCategory,   colorClass: '' },
    { label: 'Business Link Type',value: w.businessLinkType ?? '—', colorClass: '' },
    {
      label: 'Status',
      value: w.status,
      colorClass: w.status === 'Open' ? 'text-[#86F398]' : 'text-[#F38686]',
    },
  ], [w.warehouseId, w.warehouseName, w.region, w.coordinates, w.hours, w.objectCategory, w.businessLinkType, w.status])

  // Derive used capacity live from objects (falls back to stored value while loading)
  const liveUsedCapacity = objects.length > 0
    ? objects.reduce((s, o) => s + o.quantity, 0)
    : w.usedCapacity
  const capPct = w.totalCapacity > 0 ? parseFloat(((liveUsedCapacity / w.totalCapacity) * 100).toFixed(2)) : 0
  const capPos = capPct >= 30
  const capLabel = `${capPct}%`

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY

  useEffect(() => {
    if (!showMap || !mapContainerRef.current || !MAPTILER_KEY) return

    // Parse "30.1575 N, 71.5249 E" → [lng, lat]
    const parseLngLat = (coords: string): [number, number] | null => {
      const m = coords.match(/([\d.]+)\s*N[,\s]+([\d.]+)\s*E/i)
      if (!m) return null
      return [parseFloat(m[2]), parseFloat(m[1])]
    }
    const lngLat = parseLngLat(w.coordinates)
    if (!lngLat) return

    const el = document.createElement('div')
    el.style.cssText = 'width:100%;height:100%'
    mapContainerRef.current.appendChild(el)

    const styleUrl = `https://api.maptiler.com/maps/basic-v2-dark/style.json?key=${MAPTILER_KEY}`

    const map = new maplibregl.Map({
      container: el,
      style: styleUrl,
      center: lngLat,
      zoom: 14,
      interactive: false,
      attributionControl: false,
    })

    map.on('load', () => {
      // Force all labels to English
      map.getStyle().layers?.forEach(layer => {
        if (layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout) {
          map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']])
        }
      })

      const firstSymbol = map.getStyle().layers?.find(l => l.type === 'symbol')?.id

      // Same dark overlay as DmpMap
      map.addSource('darken', { type: 'geojson', data: WORLD_POLY })
      map.addLayer({
        id: 'darken-overlay', type: 'fill', source: 'darken',
        paint: { 'fill-color': '#000000', 'fill-opacity': 0.45 },
      }, firstSymbol)

      // Same dmp-pin-warehouse marker
      const pinEl = document.createElement('div')
      pinEl.className = 'dmp-pin dmp-pin-warehouse'
      pinEl.innerHTML = '<img src="/icons/warehouse.svg" alt="" />'
      new maplibregl.Marker({ element: pinEl, anchor: 'center' }).setLngLat(lngLat).addTo(map)
    })

    return () => {
      el.parentElement?.removeChild(el)
      setTimeout(() => { try { map.remove() } catch { /* cleaned */ } }, 100)
    }
  }, [w.coordinates, showMap, MAPTILER_KEY])

  return (
    <>
      {/* Sub-header piece: selected warehouse name */}
      <div className="h-[38px] shrink-0 flex items-center justify-between px-4 border-b border-[#262626]">
        <span className="text-[13px] tracking-[-0.03em] text-white truncate">{w.warehouseName}</span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center hover:bg-[#1e1e1e] rounded-[3px] cursor-pointer transition-colors shrink-0 ml-2"
          aria-label="Close inspector"
        >
          <span className="text-[15px] leading-none text-[#aaa]">&times;</span>
        </button>
      </div>

      {/* Inspector scrollable body */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-3 flex flex-col gap-3">

        {/* Warehouse Details */}
        <div className="flex flex-col shrink-0">
          <div className="flex h-8 items-center bg-[#111111] pl-4 shrink-0">
            <span className="text-[13px] tracking-[-0.03em] text-white">Warehouse Details</span>
          </div>

          {/* Warehouse illustration — mt-[3px] matches the row gap below */}
          <div
            className="relative w-full shrink-0 overflow-hidden mt-[3px] bg-[#0c0c0c]"
            style={{ aspectRatio: '3 / 2' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/warehousing/warehouse-illustration-light.png"
              alt="Warehouse interior illustration"
              className="absolute inset-0 w-full h-full object-cover invert"
            />
          </div>

          <div className="flex flex-col gap-[3px] mt-[3px]">
            {warehouseDetails.map(({ label, value, colorClass }) => (
              <div key={label} className="bg-[#0c0c0c] h-7 flex items-center px-[5px] shrink-0">
                <div className="flex items-center justify-between px-2 rounded-[5px] h-full w-full min-w-0">
                  <span className="text-[13px] tracking-[-0.03em] text-[#d0d0d0] whitespace-nowrap shrink-0">{label}</span>
                  <div className="flex-1 ml-2 overflow-x-auto scrollbar-hide text-right min-w-0">
                    <span className={`text-[13px] tracking-[-0.03em] whitespace-nowrap inline-block ${colorClass || 'text-white'}`}>
                      {value}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Map */}
        {showMap && (
          <div className="flex flex-col shrink-0 overflow-hidden">
            <div className="flex h-8 items-center justify-center bg-[#111111] px-3 shrink-0">
              <span className="text-[11px] tracking-[-0.03em] text-white text-center leading-tight">
                {w.address}
              </span>
            </div>
            <div
              ref={mapContainerRef}
              className="relative w-full overflow-hidden shrink-0"
              style={{ height: '184px' }}
            />
            <div className="flex h-8 items-center justify-center bg-[#111111] shrink-0">
              <span className="text-[13px] tracking-[-0.03em] text-white">{w.coordinates}</span>
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="flex flex-col shrink-0">
          <div className="flex h-8 items-center bg-[#111111] pl-4 shrink-0">
            <span className="text-[13px] tracking-[-0.03em] text-white">Statistics</span>
          </div>
          <div className="flex flex-col gap-[3px] mt-[3px]">
            <div className="bg-[#0c0c0c] h-7 flex items-center px-[5px] shrink-0">
              <div className="flex items-center justify-between px-2 rounded-[5px] h-full w-full">
                <span className="text-[13px] tracking-[-0.03em] text-[#d0d0d0] shrink-0">Used Capacity</span>
                <span className="text-[13px] tracking-[-0.03em] text-right ml-2 whitespace-nowrap">
                  <span className="text-white">{liveUsedCapacity.toLocaleString()}{` \u2192`}</span>
                  {` `}
                  <span className={capPos ? 'text-[#86F398]' : 'text-[#F38686]'}>
                    {`{ ${capLabel} }`}
                  </span>
                </span>
              </div>
            </div>
            {[
              { label: 'Total Capacity', value: `${w.totalCapacity}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#0c0c0c] h-7 flex items-center px-[5px] shrink-0">
                <div className="flex items-center justify-between px-2 rounded-[5px] h-full w-full min-w-0">
                  <span className="text-[13px] tracking-[-0.03em] text-[#d0d0d0] whitespace-nowrap shrink-0">{label}</span>
                  <div className="flex-1 ml-2 overflow-x-auto scrollbar-hide text-right min-w-0">
                    <span className="text-[13px] tracking-[-0.03em] text-white whitespace-nowrap inline-block">{value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Warehouse Capacity */}
        <div className="flex flex-col shrink-0">
          <div className="flex h-8 items-center justify-between bg-[#111111] pl-4 pr-2 shrink-0">
            <span className="text-[13px] tracking-[-0.03em] text-white">Warehouse Capacity</span>
            <div className="flex items-center gap-[3px]">
              {(['allocated', 'in depth'] as const).map(view => (
                <button
                  key={view}
                  onClick={() => setChartView(view === 'in depth' ? 'in-depth' : 'allocated')}
                  className={`h-5 px-2 rounded-[3px] text-[10px] tracking-[-0.02em] capitalize transition-colors cursor-pointer ${
                    (view === 'in depth' ? chartView === 'in-depth' : chartView === 'allocated')
                      ? 'bg-white text-black'
                      : 'bg-[#1e1e1e] text-[#aaa] hover:bg-[#2a2a2a]'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>

          {chartView === 'allocated' ? (
            <>
              {/* Bar chart */}
              <div className="mt-[3px] bg-[#0c0c0c] px-2 pt-3 pb-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 px-1">
                  {allocatedData.map(({ name, color }) => (
                    <div key={name} className="flex items-center gap-1.5">
                      <div className="shrink-0 rounded-[2px]" style={{ width: 10, height: 10, backgroundColor: color }} />
                      <span className="text-[10px] tracking-[-0.03em] text-[#aaa]">{name}</span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={allocatedData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={({ x, y, payload }: { x: string | number; y: string | number; payload: { value: string } }) => {
                        const label = payload.value.length > 11 ? payload.value.slice(0, 11) + '…' : payload.value
                        return (
                          <g transform={`translate(${Number(x)},${Number(y)})`}>
                            <text x={0} y={0} dy={12} textAnchor="middle" fill="#888" fontSize={9}>
                              {label}
                            </text>
                          </g>
                        )
                      }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE_LIGHT}
                      cursor={{ fill: 'rgba(0,0,0,0.06)' }}
                      labelStyle={{ color: '#333', fontWeight: 600 }}
                      itemStyle={{ color: '#333' }}
                    />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]} barSize={28}>
                      {allocatedData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Allocated breakdown table */}
              <div className="flex flex-col gap-[3px] mt-[3px]">
                <div className="flex h-8 items-stretch bg-[#111111] shrink-0">
                  <div className="flex flex-1 items-center px-4">
                    <span className="text-[13px] tracking-[-0.03em] text-white">Object</span>
                  </div>
                  <div className="flex w-[80px] shrink-0 items-center justify-center px-2">
                    <span className="text-[13px] tracking-[-0.03em] text-white text-center">Quantity</span>
                  </div>
                  <div className="flex w-[90px] shrink-0 items-center justify-center px-2">
                    <span className="text-[11px] tracking-[-0.03em] text-white text-center whitespace-nowrap">Occupied Cap</span>
                  </div>
                </div>
                <div className="flex flex-col gap-[3px]">
                  {allocatedData.map(({ name, value, color }) => {
                    const pct = w.totalCapacity > 0 ? ((value / w.totalCapacity) * 100).toFixed(1) : '0'
                    return (
                      <div key={name} className="bg-[#0c0c0c] h-7 flex items-stretch px-[5px] shrink-0">
                        <div className="flex flex-1 items-center px-2 gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-[13px] tracking-[-0.03em] text-white truncate">{name}</span>
                        </div>
                        <div className="flex w-[80px] shrink-0 items-center justify-center px-2">
                          <span className="text-[13px] tracking-[-0.03em] text-white">{value.toLocaleString()}</span>
                        </div>
                        <div className="flex w-[90px] shrink-0 items-center justify-center px-2">
                          <span className="text-[13px] tracking-[-0.03em]" style={{ color }}>{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            /* In Depth — two stacked donut + table sections */
            <div className="flex flex-col gap-3 mt-[3px]">

              {/* ── Allocated donut + table ── */}
              <div className="flex flex-col">
                <div className="flex h-7 items-center bg-[#111111] px-4 shrink-0">
                  <span className="text-[11px] tracking-[-0.02em] text-[#aaa]">Allocated</span>
                </div>
                <div className="bg-[#0c0c0c] px-2 pt-2 pb-1">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={allocatedDonutData.length > 0 ? allocatedDonutData : EMPTY_DONUT_DATA}
                        cx="50%"
                        cy="50%"
                        innerRadius={36}
                        outerRadius={56}
                        dataKey="value"
                        strokeWidth={0}
                        isAnimationActive={false}
                      >
                        {(allocatedDonutData.length > 0 ? allocatedDonutData : EMPTY_DONUT_DATA).map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      {allocatedDonutData.length > 0 && (
                        <Tooltip
                          contentStyle={TOOLTIP_STYLE_DARK}
                        />
                      )}
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-[3px] mt-[3px]">
                  <div className="flex h-8 items-stretch bg-[#111111] shrink-0">
                    <div className="flex flex-1 items-center px-4">
                      <span className="text-[13px] tracking-[-0.03em] text-white">Object</span>
                    </div>
                    <div className="flex w-[80px] shrink-0 items-center justify-center px-2">
                      <span className="text-[13px] tracking-[-0.03em] text-white text-center">Quantity</span>
                    </div>
                    <div className="flex w-[90px] shrink-0 items-center justify-center px-2">
                      <span className="text-[11px] tracking-[-0.03em] text-white text-center whitespace-nowrap">Occupied Cap</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-[3px]">
                    {allocatedData.map(({ name, value, color }) => {
                      const pct = w.totalCapacity > 0 ? ((value / w.totalCapacity) * 100).toFixed(1) : '0'
                      return (
                        <div key={name} className="bg-[#0c0c0c] h-7 flex items-stretch px-[5px] shrink-0">
                          <div className="flex flex-1 items-center px-2 gap-2 min-w-0">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-[13px] tracking-[-0.03em] text-white truncate">{name}</span>
                          </div>
                          <div className="flex w-[80px] shrink-0 items-center justify-center px-2">
                            <span className="text-[13px] tracking-[-0.03em] text-white">{value.toLocaleString()}</span>
                          </div>
                          <div className="flex w-[90px] shrink-0 items-center justify-center px-2">
                            <span className="text-[13px] tracking-[-0.03em]" style={{ color }}>{pct}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* ── In Transit donut + table ── */}
              <div className="flex flex-col">
                <div className="flex h-7 items-center bg-[#111111] px-4 shrink-0">
                  <span className="text-[11px] tracking-[-0.02em] text-[#aaa]">In Transit</span>
                </div>
                {transitData.length > 0 ? (
                  <>
                    <div className="bg-[#0c0c0c] px-2 pt-2 pb-1">
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie
                            data={transitData}
                            cx="50%"
                            cy="50%"
                            innerRadius={36}
                            outerRadius={56}
                            dataKey="value"
                            strokeWidth={0}
                            isAnimationActive={false}
                          >
                            {transitData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={TOOLTIP_STYLE_DARK}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-[3px] mt-[3px]">
                      <div className="flex h-8 items-stretch bg-[#111111] shrink-0">
                        <div className="flex flex-1 items-center px-4">
                          <span className="text-[13px] tracking-[-0.03em] text-white">Object</span>
                        </div>
                        <div className="flex w-[80px] shrink-0 items-center justify-center px-2">
                          <span className="text-[13px] tracking-[-0.03em] text-white text-center">Quantity</span>
                        </div>
                        <div className="flex w-[90px] shrink-0 items-center justify-center px-2">
                          <span className="text-[11px] tracking-[-0.03em] text-white text-center whitespace-nowrap">Occupied Cap</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-[3px]">
                        {transitData.map(({ name, value, color }) => {
                          const pct = w.totalCapacity > 0 ? ((value / w.totalCapacity) * 100).toFixed(1) : '0'
                          return (
                            <div key={name} className="bg-[#0c0c0c] h-7 flex items-stretch px-[5px] shrink-0">
                              <div className="flex flex-1 items-center px-2 gap-2 min-w-0">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                <span className="text-[13px] tracking-[-0.03em] text-white truncate">{name}</span>
                              </div>
                              <div className="flex w-[80px] shrink-0 items-center justify-center px-2">
                                <span className="text-[13px] tracking-[-0.03em] text-white">{value.toLocaleString()}</span>
                              </div>
                              <div className="flex w-[90px] shrink-0 items-center justify-center px-2">
                                <span className="text-[13px] tracking-[-0.03em]" style={{ color }}>{pct}%</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-[#0c0c0c] flex items-center justify-center py-6">
                    <span className="text-[11px] tracking-[-0.03em] text-[#555]">No transit items</span>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

      </div>
    </>
  )
}

export default memo(WarehouseInspector)
