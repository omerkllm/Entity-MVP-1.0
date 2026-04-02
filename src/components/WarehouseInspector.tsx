import { memo, useEffect, useRef, useMemo, useState } from 'react'
import api from '@/lib/api'
import type { ObjectRecord } from '@/lib/data/types'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { PieChart, Pie, BarChart, Bar, XAxis, CartesianGrid, Label, Rectangle } from 'recharts'
import type { BarShapeProps } from 'recharts/types/cartesian/Bar'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

const TRANSIT_COLORS = ['#a855f7', '#c084fc', '#d8b4fe', '#7e22ce', '#9333ea'] as const

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
      { name: majorName, value: majorQty, color: '#60a5fa' },
      { name: 'Other', value: otherQty, color: '#3b82f6' },
      { name: 'In Transit', value: transitTotalQty, color: '#1d4ed8' },
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

  // Shadcn chart config + transformed data for the bar chart
  const { barChartConfig, barChartData, barActiveIndex } = useMemo(() => {
    const config: ChartConfig = { value: { label: 'Quantity' } }
    const data: { category: string; value: number; fill: string }[] = []
    let activeIdx = 0
    let maxVal = 0
    allocatedData.forEach((d, i) => {
      const key = d.name.toLowerCase().replace(/\s+/g, '-')
      config[key] = { label: d.name, color: d.color }
      data.push({ category: key, value: d.value, fill: `var(--color-${key})` })
      if (d.value > maxVal) { maxVal = d.value; activeIdx = i }
    })
    return { barChartConfig: config, barChartData: data, barActiveIndex: activeIdx }
  }, [allocatedData])

  const { allocDonutConfig, allocDonutChartData, allocDonutTotal } = useMemo(() => {
    const config: ChartConfig = { value: { label: 'Quantity' } }
    const data: { category: string; value: number; fill: string }[] = []
    let total = 0
    if (allocatedDonutData.length === 0) {
      config['empty'] = { label: 'Empty', color: '#222' }
      data.push({ category: 'empty', value: 1, fill: 'var(--color-empty)' })
    } else {
      for (const d of allocatedDonutData) {
        const key = d.name.toLowerCase().replace(/\s+/g, '-')
        config[key] = { label: d.name, color: d.color }
        data.push({ category: key, value: d.value, fill: `var(--color-${key})` })
        total += d.value
      }
    }
    return { allocDonutConfig: config, allocDonutChartData: data, allocDonutTotal: total }
  }, [allocatedDonutData])

  const { transitDonutConfig, transitDonutChartData, transitDonutTotal } = useMemo(() => {
    const config: ChartConfig = { value: { label: 'Quantity' } }
    const data: { category: string; value: number; fill: string }[] = []
    let total = 0
    for (const d of transitData) {
      const key = d.name.toLowerCase().replace(/\s+/g, '-')
      config[key] = { label: d.name, color: d.color }
      data.push({ category: key, value: d.value, fill: `var(--color-${key})` })
      total += d.value
    }
    return { transitDonutConfig: config, transitDonutChartData: data, transitDonutTotal: total }
  }, [transitData])

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

    const styleUrl = `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`

    const map = new maplibregl.Map({
      container: el,
      style: styleUrl,
      center: lngLat,
      zoom: 15,
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

      // Darken the map further to match the app's black/dark-grey theme
      const DARK_POLY: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature', properties: {},
          geometry: { type: 'Polygon', coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]] },
        }],
      }
      const firstSymbol = map.getStyle().layers?.find(l => l.type === 'symbol')?.id
      map.addSource('darken', { type: 'geojson', data: DARK_POLY })
      map.addLayer({
        id: 'darken-overlay', type: 'fill', source: 'darken',
        paint: { 'fill-color': '#000000', 'fill-opacity': 0.35 },
      }, firstSymbol)

      // Warehouse marker
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
          <div className="flex h-8 items-center bg-[#111111] pl-4 shrink-0">
            <span className="text-[13px] tracking-[-0.03em] text-white">Warehouse Capacity</span>
          </div>
          <div className="flex items-center bg-[#0c0c0c] px-3 py-2">
            <div className="inline-flex items-center rounded-lg bg-[#1a1a1a] p-1 gap-px">
              {(['allocated', 'in depth'] as const).map(view => {
                const isActive = view === 'in depth' ? chartView === 'in-depth' : chartView === 'allocated'
                return (
                  <button
                    key={view}
                    onClick={() => setChartView(view === 'in depth' ? 'in-depth' : 'allocated')}
                    className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-[11px] tracking-[-0.03em] font-normal capitalize transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#111] text-white shadow-sm'
                        : 'text-[#888] hover:text-white'
                    }`}
                  >
                    {view}
                  </button>
                )
              })}
            </div>
          </div>

          {chartView === 'allocated' ? (
            <>
              {/* Bar chart — shadcn/ui pattern */}
              <div className="mt-[3px] bg-[#0c0c0c] px-2 pt-3 pb-1">
                <ChartContainer config={barChartConfig} className="aspect-video">
                  <BarChart accessibilityLayer data={barChartData}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="category"
                      tickLine={false}
                      tickMargin={10}
                      axisLine={false}
                      tickFormatter={(value) =>
                        (barChartConfig[value as keyof typeof barChartConfig]?.label as string) ?? value
                      }
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel />}
                    />
                    <Bar
                      dataKey="value"
                      strokeWidth={2}
                      radius={8}
                      shape={({ index, ...props }: BarShapeProps) =>
                        index === barActiveIndex ? (
                          <Rectangle
                            {...props}
                            fillOpacity={0.8}
                            stroke={props.payload.fill}
                            strokeDasharray={4}
                            strokeDashoffset={4}
                          />
                        ) : (
                          <Rectangle {...props} />
                        )
                      }
                    />
                  </BarChart>
                </ChartContainer>
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
                          <div className="w-[9px] h-[9px] rounded-[3px] shrink-0" style={{ backgroundColor: color }} />
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
                  <ChartContainer config={allocDonutConfig} className="mx-auto aspect-square max-h-[180px]">
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel nameKey="category" />}
                      />
                      <Pie
                        data={allocDonutChartData}
                        dataKey="value"
                        nameKey="category"
                        innerRadius={50}
                        outerRadius={65}
                        strokeWidth={0}
                      >
                        <Label
                          content={({ viewBox }) => {
                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                              return (
                                <text
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                >
                                  <tspan
                                    x={viewBox.cx}
                                    y={viewBox.cy}
                                    className="fill-white text-2xl font-bold tracking-[-0.03em]"
                                  >
                                    {allocDonutTotal.toLocaleString()}
                                  </tspan>
                                  <tspan
                                    x={viewBox.cx}
                                    y={(viewBox.cy || 0) + 20}
                                    className="fill-[#888] text-[10px]"
                                  >
                                    Allocated
                                  </tspan>
                                </text>
                              )
                            }
                          }}
                        />
                      </Pie>
                    </PieChart>
                  </ChartContainer>
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
                            <div className="w-[9px] h-[9px] rounded-[3px] shrink-0" style={{ backgroundColor: color }} />
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
                      <ChartContainer config={transitDonutConfig} className="mx-auto aspect-square max-h-[180px]">
                        <PieChart>
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel nameKey="category" />}
                          />
                          <Pie
                            data={transitDonutChartData}
                            dataKey="value"
                            nameKey="category"
                            innerRadius={50}
                            outerRadius={65}
                            strokeWidth={0}
                          >
                            <Label
                              content={({ viewBox }) => {
                                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                  return (
                                    <text
                                      x={viewBox.cx}
                                      y={viewBox.cy}
                                      textAnchor="middle"
                                      dominantBaseline="middle"
                                    >
                                      <tspan
                                        x={viewBox.cx}
                                        y={viewBox.cy}
                                        className="fill-white text-2xl font-bold tracking-[-0.03em]"
                                      >
                                        {transitDonutTotal.toLocaleString()}
                                      </tspan>
                                      <tspan
                                        x={viewBox.cx}
                                        y={(viewBox.cy || 0) + 20}
                                        className="fill-[#888] text-[10px]"
                                      >
                                        In Transit
                                      </tspan>
                                    </text>
                                  )
                                }
                              }}
                            />
                          </Pie>
                        </PieChart>
                      </ChartContainer>
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
                                <div className="w-[9px] h-[9px] rounded-[3px] shrink-0" style={{ backgroundColor: color }} />
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

