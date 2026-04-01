'use client'

import { useState, useMemo, useCallback, useEffect, Suspense } from 'react'
import api from '@/lib/api'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import WarehouseInspector from '@/components/WarehouseInspector'
import ObjectInspector from '@/components/ObjectInspector'
import ResizablePanel from '@/components/ui/ResizablePanel'
import { CheckboxFilterSections, RangeFilter, DeleteFiltersButton } from '@/components/ui/FilterPanel'
import { computeCapacityPercent, isCapacityHealthy, isHealthPositive } from '@/lib/data/helpers'
import type { DBWarehouse, ObjectRecord } from '@/lib/data/types'
import { deriveFilterOptions, computeToggleCount, toggleFilterValue, clearAllFilters as clearFilters, createEmptyFilters } from '@/utils/filters'

// ─── Filter category definitions ────────────────────────────────────
const WAREHOUSE_FILTER_CATS = [
  { key: 'objectCategory',   label: 'Object Category' },
  { key: 'businessLinkType', label: 'Business Link Type' },
  { key: 'region',           label: 'Region' },
  { key: 'status',           label: 'Status' },
] as const

const OBJECT_FILTER_CATS = [
  { key: 'objectCategory', label: 'Object Category' },
  { key: 'transitStatus',  label: 'Transit Status' },
  { key: 'unit',           label: 'Unit' },
] as const

// ─── Table column definitions ───────────────────────────────────────
const RECORDS_PER_PAGE = 20

const WAREHOUSE_COLUMNS = [
  { label: 'Warehouse ID', minW: 120 },
  { label: 'Title', minW: 120 },
  { label: 'Region', minW: 120 },
  { label: 'Object Category', minW: 140 },
  { label: 'Status', minW: 90 },
  { label: 'Used Capacity', minW: 140 },
  { label: 'Business Link Type', minW: 150 },
]

const OBJECT_COLUMNS = [
  { label: 'Object ID', minW: 110 },
  { label: 'Object Category', minW: 140 },
  { label: 'Quantity', minW: 100 },
  { label: 'Unit', minW: 80 },
  { label: 'Transit Status', minW: 110 },
  { label: 'Object Health', minW: 120 },
]

// ─── Row background helper ──────────────────────────────────────────
function rowBg(index: number, isSelected: boolean): string {
  if (isSelected) return 'bg-[#181818]'
  return index % 2 === 1
    ? 'bg-[#0e0e0e] hover:bg-[#151515]'
    : 'bg-[#0a0a0a] hover:bg-[#131313]'
}

// ─── Main content (wrapped in Suspense at export) ───────────────────
function WarehousingContent() {
  const searchParams = useSearchParams()
  const processId = searchParams.get('process')

  const [processName, setProcessName] = useState('All')
  const [warehouses, setWarehouses] = useState<DBWarehouse[]>([])
  const [objects, setObjects] = useState<ObjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)

  // ── Warehouse-level state ───────────────────────────────────────
  // Declared before the fetch effect that pre-selects the first row on load.
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState(() => createEmptyFilters(WAREHOUSE_FILTER_CATS))
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [capacityMin, setCapacityMin] = useState('')
  const [capacityMax, setCapacityMax] = useState('')

  // ── Object-level state (drilled-in view) ────────────────────────
  const [drilledWarehouseIdx, setDrilledWarehouseIdx] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    api.get('/api/warehousing-data').then(({ data }) => {
      setWarehouses(data.warehouses.data)
      setObjects(data.objects?.data ?? [])
      if (processId) {
        const found = data.processes.data.find((p: { id: string }) => p.id === processId)
        setProcessName(found?.name ?? 'All')
      }
      // Pre-select first record so the inspector is visible on load
      if (data.warehouses.data.length > 0) setSelectedIdx(0)
    }).catch(err => console.error('[WarehousingPage] data fetch error:', err))
      .finally(() => setLoading(false))
  }, [processId])

  // Warehouses for the selected supply-chain process
  const processWarehouses = useMemo(() => {
    if (!processId) return warehouses
    return warehouses.filter(w => w.processId === processId)
  }, [processId, warehouses])
  useEffect(() => {
    setFilters(createEmptyFilters(WAREHOUSE_FILTER_CATS))
    setExpandedCats(new Set())
    setCapacityMin('')
    setCapacityMax('')
    setPage(0)
    setSelectedIdx(null)
    setDrilledWarehouseIdx(null)
    setFilterOpen(false)
  }, [processId])
  const [selectedObjectIdx, setSelectedObjectIdx] = useState<number | null>(null)
  const [objectFilters, setObjectFilters] = useState(() => createEmptyFilters(OBJECT_FILTER_CATS))
  const [objectExpandedCats, setObjectExpandedCats] = useState<Set<string>>(new Set())
  const [objectHealthMin, setObjectHealthMin] = useState('')
  const [objectHealthMax, setObjectHealthMax] = useState('')

  // ── Warehouse filter handlers ───────────────────────────────────
  const handleToggleFilter = useCallback((key: string, value: string) => {
    setFilters(prev => toggleFilterValue(prev, key, value))
    setPage(0)
  }, [])

  const handleClearFilters = useCallback(() => {
    setFilters(prev => clearFilters(prev))
    setCapacityMin('')
    setCapacityMax('')
    setExpandedCats(new Set())
    setPage(0)
  }, [])

  // ── Object filter handlers ─────────────────────────────────────
  const handleToggleObjectFilter = useCallback((key: string, value: string) => {
    setObjectFilters(prev => toggleFilterValue(prev, key, value))
  }, [])

  const handleClearObjectFilters = useCallback(() => {
    setObjectFilters(prev => clearFilters(prev))
    setObjectExpandedCats(new Set())
    setObjectHealthMin('')
    setObjectHealthMax('')
  }, [])

  // ── Capacity range check (shared by filter + count) ─────────────
  const capacityRangeCheck = useCallback((w: DBWarehouse) => {
    const capPct = computeCapacityPercent(w.usedCapacity, w.totalCapacity)
    if (capacityMin !== '' && capPct < Number(capacityMin)) return false
    if (capacityMax !== '' && capPct > Number(capacityMax)) return false
    return true
  }, [capacityMin, capacityMax])

  // ── Filtered + paginated warehouses ─────────────────────────────
  const filteredWarehouses = useMemo(() => {
    return processWarehouses.filter(w => {
      for (const cat of WAREHOUSE_FILTER_CATS) {
        const active = filters[cat.key]
        if (active.size === 0) continue
        if (!active.has(String(w[cat.key as keyof DBWarehouse]))) return false
      }
      return capacityRangeCheck(w)
    })
  }, [filters, processWarehouses, capacityRangeCheck])

  const totalPages = Math.max(1, Math.ceil(filteredWarehouses.length / RECORDS_PER_PAGE))
  const pageRecords = filteredWarehouses.slice(page * RECORDS_PER_PAGE, (page + 1) * RECORDS_PER_PAGE)

  // ── Dynamic filter counts (warehouse) ───────────────────────────
  const getWarehouseOptionCount = useCallback(
    (catKey: string, optValue: string) =>
      computeToggleCount(processWarehouses, filters, WAREHOUSE_FILTER_CATS, catKey, optValue, capacityRangeCheck),
    [filters, processWarehouses, capacityRangeCheck],
  )

  const sel = selectedIdx !== null ? (pageRecords[selectedIdx] ?? null) : null

  // ── Drilled warehouse → objects (key-based join) ────────────────
  const drilledWarehouse = drilledWarehouseIdx !== null ? filteredWarehouses[drilledWarehouseIdx] : null

  // Objects are pre-fetched in the initial load — filter client-side by warehouse
  const warehouseObjects = useMemo(() => {
    if (!drilledWarehouse) return []
    return objects.filter(o => o.warehouseId === drilledWarehouse.warehouseId)
  }, [drilledWarehouse, objects])

  // ── Health range check (shared by filter + count) ───────────────
  const healthRangeCheck = useCallback((o: ObjectRecord) => {
    const health = Math.abs(parseFloat(o.objectHealth))
    if (objectHealthMin !== '' && health < Number(objectHealthMin)) return false
    if (objectHealthMax !== '' && health > Number(objectHealthMax)) return false
    return true
  }, [objectHealthMin, objectHealthMax])

  const filteredObjects = useMemo(() => {
    return warehouseObjects.filter(o => {
      for (const cat of OBJECT_FILTER_CATS) {
        const active = objectFilters[cat.key]
        if (active.size > 0 && !active.has(String(o[cat.key]))) return false
      }
      return healthRangeCheck(o)
    })
  }, [warehouseObjects, objectFilters, healthRangeCheck])

  // ── Object filter option derivation ─────────────────────────────
  const deriveObjectOptions = useCallback(
    (key: string) => deriveFilterOptions(warehouseObjects, key as keyof ObjectRecord, undefined, key === 'transitStatus' ? { '\u2014': 'Not in Transit' } : undefined),
    [warehouseObjects],
  )

  // ── Dynamic filter counts (objects) ─────────────────────────────
  const getObjectOptionCount = useCallback(
    (catKey: string, optValue: string) =>
      computeToggleCount(warehouseObjects, objectFilters, OBJECT_FILTER_CATS, catKey, optValue, healthRangeCheck),
    [objectFilters, warehouseObjects, healthRangeCheck],
  )

  // ── Selected object for inspector ───────────────────────────────
  const selObject = selectedObjectIdx !== null ? (filteredObjects[selectedObjectIdx] ?? null) : null
  const objectForInspector = selObject && drilledWarehouse ? {
    objectId: selObject.objectId,
    objectCategory: selObject.objectCategory,
    quantity: selObject.quantity,
    unit: selObject.unit,
    arrivalTime: selObject.arrivalTime,
    transitStatus: selObject.transitStatus,
    objectHealth: selObject.objectHealth,
    warehouseId: drilledWarehouse.warehouseId,
  } : null

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      <Sidebar />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* TOP BAR */}
        <div className="flex h-[38px] items-center bg-[#111111] border-b border-[#262626] px-4 gap-1.5 shrink-0">
          <span className="text-[13px] tracking-[-0.03em] text-white font-normal">Inventory / Warehousing</span>
          <span className="text-[13px] tracking-[-0.03em] text-[#86F398] font-normal">{'{IW}'}</span>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-[13px] tracking-[-0.03em] text-[#999999] animate-pulse">Loading warehouses…</span>
          </div>
        ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden bg-[#0a0a0a]">

          {/* ── MOBILE FILTER OVERLAY ──────────────────────────────── */}
          {filterOpen && (
            <div className="fixed inset-0 z-50 flex md:hidden">
              <div className="flex flex-col w-[240px] max-w-[80vw] bg-[#0a0a0a] h-full border-r border-[#262626]">
                <div className="h-[38px] shrink-0 flex items-center justify-between px-4 border-b border-[#262626]">
                  <span className="text-[13px] tracking-[-0.03em] text-white">Search Filters</span>
                  <button onClick={() => setFilterOpen(false)} className="text-[13px] text-white opacity-60 hover:opacity-100 transition-opacity">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide py-3 px-3 flex flex-col gap-3">
                  {drilledWarehouse ? (
                    <>
                      <CheckboxFilterSections
                        categories={OBJECT_FILTER_CATS}
                        getOptions={deriveObjectOptions}
                        activeFilters={objectFilters}
                        expanded={objectExpandedCats}
                        setExpanded={setObjectExpandedCats}
                        getCount={getObjectOptionCount}
                        onToggle={handleToggleObjectFilter}
                      />
                      <RangeFilter
                        label="Object Health"
                        minVal={objectHealthMin}
                        maxVal={objectHealthMax}
                        onMinChange={v => { setObjectHealthMin(v) }}
                        onMaxChange={v => { setObjectHealthMax(v) }}
                      />
                    </>
                  ) : (
                    <>
                      <CheckboxFilterSections
                        categories={WAREHOUSE_FILTER_CATS}
                        getOptions={key => deriveFilterOptions(processWarehouses, key as keyof DBWarehouse)}
                        activeFilters={filters}
                        expanded={expandedCats}
                        setExpanded={setExpandedCats}
                        getCount={getWarehouseOptionCount}
                        onToggle={handleToggleFilter}
                      />
                      <RangeFilter
                        label="Used Capacity"
                        minVal={capacityMin}
                        maxVal={capacityMax}
                        onMinChange={v => { setCapacityMin(v); setPage(0) }}
                        onMaxChange={v => { setCapacityMax(v); setPage(0) }}
                      />
                    </>
                  )}
                </div>
                <DeleteFiltersButton onClick={drilledWarehouse ? handleClearObjectFilters : handleClearFilters} />
              </div>
              <div className="flex-1 bg-black/50" onClick={() => setFilterOpen(false)} />
            </div>
          )}

          {/* ── FILTER COLUMN ──────────────────────────────────────── */}
          <ResizablePanel edge="right" defaultWidth={200} minWidth={160} maxWidth={360} className="hidden md:flex border-r border-[#262626]">
            <div className="h-[38px] shrink-0 flex items-center px-4 border-b border-[#262626]">
              <span className="text-[13px] tracking-[-0.03em] text-white">Search Filters</span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide py-3 px-3 flex flex-col gap-3">
              {drilledWarehouse ? (
                <>
                  <CheckboxFilterSections
                    categories={OBJECT_FILTER_CATS}
                    getOptions={deriveObjectOptions}
                    activeFilters={objectFilters}
                    expanded={objectExpandedCats}
                    setExpanded={setObjectExpandedCats}
                    getCount={getObjectOptionCount}
                    onToggle={handleToggleObjectFilter}
                  />
                  <RangeFilter
                    label="Object Health"
                    minVal={objectHealthMin}
                    maxVal={objectHealthMax}
                    onMinChange={v => { setObjectHealthMin(v) }}
                    onMaxChange={v => { setObjectHealthMax(v) }}
                  />
                </>
              ) : (
                <>
                  <CheckboxFilterSections
                    categories={WAREHOUSE_FILTER_CATS}
                    getOptions={key => deriveFilterOptions(processWarehouses, key as keyof DBWarehouse)}
                    activeFilters={filters}
                    expanded={expandedCats}
                    setExpanded={setExpandedCats}
                    getCount={getWarehouseOptionCount}
                    onToggle={handleToggleFilter}
                  />
                  <RangeFilter
                    label="Used Capacity"
                    minVal={capacityMin}
                    maxVal={capacityMax}
                    onMinChange={v => { setCapacityMin(v); setPage(0) }}
                    onMaxChange={v => { setCapacityMax(v); setPage(0) }}
                  />
                </>
              )}
            </div>
            <DeleteFiltersButton onClick={drilledWarehouse ? handleClearObjectFilters : handleClearFilters} />
          </ResizablePanel>

          {/* ── TABLE COLUMN ───────────────────────────────────────── */}
          <div className="flex flex-[7] flex-col min-w-0 overflow-hidden">
            {/* Breadcrumb + pagination */}
            <div className="h-[38px] shrink-0 flex items-center justify-between px-4 border-b border-[#262626]">
              <span className="text-[13px] tracking-[-0.03em] text-white truncate">
                {drilledWarehouse ? (
                  <>
                    <Link href="/inventory" className="underline cursor-pointer hover:text-[#86F398] transition-colors">
                      Supply Chain
                    </Link>
                    {`  \u2192  ${processName}  \u2192  `}
                    <button
                      onClick={() => { setDrilledWarehouseIdx(null); setSelectedObjectIdx(null) }}
                      className="underline cursor-pointer hover:text-[#86F398] transition-colors"
                    >
                      Warehouses
                    </button>
                    {`  \u2192  ${drilledWarehouse.warehouseName.replace(/\s*\{.*\}/, '')}  \u2192  Objects`}
                  </>
                ) : (
                  <>
                    <Link href="/inventory" className="underline cursor-pointer hover:text-[#86F398] transition-colors">
                      Supply Chain
                    </Link>
                    {`  \u2192  ${processName}  \u2192  Warehouses`}
                  </>
                )}
              </span>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {/* Filter toggle — mobile only */}
                <button
                  className="flex md:hidden items-center px-2.5 h-7 bg-[#1b1b1b] border border-[#2c2c2c] hover:bg-[#222222] cursor-pointer transition-colors text-[12px] tracking-[-0.03em] text-white"
                  onClick={() => setFilterOpen(v => !v)}
                >
                  Filters
                </button>
                {drilledWarehouse && (
                  <button
                    onClick={() => { setDrilledWarehouseIdx(null); setSelectedObjectIdx(null) }}
                    className="flex items-center gap-1 px-2.5 h-7 bg-[#1b1b1b] border border-[#2c2c2c] hover:bg-[#222222] cursor-pointer transition-colors text-[12px] tracking-[-0.03em] text-white"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icons/nav-back.svg" alt="" width={12} height={12} style={{ width: 12, height: 12 }} className="invert" />
                    Back to Warehouses
                  </button>
                )}
                {!drilledWarehouse && (
                  <>
                    <button
                      disabled={page === 0}
                      onClick={() => { setPage(p => p - 1); setSelectedIdx(null) }}
                      className="w-7 h-7 flex items-center justify-center bg-[#1b1b1b] border border-[#2c2c2c] hover:bg-[#222222] disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/icons/nav-back.svg" alt="Previous page" width={14} height={14} style={{ width: 14, height: 14 }} className="invert" />
                    </button>
                    <button
                      disabled={page >= totalPages - 1}
                      onClick={() => { setPage(p => p + 1); setSelectedIdx(null) }}
                      className="w-7 h-7 flex items-center justify-center bg-[#1b1b1b] border border-[#2c2c2c] hover:bg-[#222222] disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/icons/nav-forward.svg" alt="Next page" width={14} height={14} style={{ width: 14, height: 14 }} className="invert" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Scrollable table area */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide flex flex-col min-h-0">
              <div className="flex flex-col h-full" style={{ minWidth: 'max-content' }}>
                {drilledWarehouse ? (
                  <>
                    {/* OBJECT TABLE HEADER */}
                    <div className="flex h-9 shrink-0 items-stretch bg-[#0a0a0a] border-b border-[#262626]">
                      {OBJECT_COLUMNS.map(col => (
                        <div key={col.label} className="flex flex-1 items-center px-4 shrink-0" style={{ minWidth: col.minW }}>
                          <span className="text-[13px] tracking-[-0.03em] text-[#aaaaaa] whitespace-nowrap">{col.label}</span>
                        </div>
                      ))}
                    </div>
                    {/* OBJECT TABLE ROWS */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                      {filteredObjects.map((o, i) => {
                        const healthPos = isHealthPositive(o.objectHealth)
                        return (
                          <div
                            key={o.objectId}
                            onClick={() => setSelectedObjectIdx(i)}
                            className={`flex h-7 items-stretch border-b border-[#151515] cursor-pointer transition-colors ${rowBg(i, selectedObjectIdx === i)}`}
                          >
                            <div className="flex min-w-[110px] flex-1 items-center gap-1.5 px-4 shrink-0">
                              <span className="text-[13px] tracking-[-0.03em] text-white whitespace-nowrap">{o.objectId}</span>
                            </div>
                            <div className="flex min-w-[140px] flex-1 items-center px-4 shrink-0">
                              <span className="text-[13px] tracking-[-0.03em] text-white whitespace-nowrap">{o.objectCategory}</span>
                            </div>
                            <div className="flex min-w-[100px] flex-1 items-center px-4 shrink-0">
                              <span className="text-[13px] tracking-[-0.03em] text-white whitespace-nowrap">{o.quantity}</span>
                            </div>
                            <div className="flex min-w-[80px] flex-1 items-center px-4 shrink-0">
                              <span className="text-[13px] tracking-[-0.03em] text-white whitespace-nowrap">{o.unit}</span>
                            </div>
                            <div className="flex min-w-[110px] flex-1 items-center px-4 shrink-0">
                              <span className={`text-[13px] tracking-[-0.03em] whitespace-nowrap ${o.transitStatus === 'In Transit' ? 'text-[#60a5fa]' : 'text-[#aaaaaa]'}`}>
                                {o.transitStatus}
                              </span>
                            </div>
                            <div className="flex min-w-[120px] flex-1 items-center px-4 shrink-0">
                              <span className={`text-[13px] tracking-[-0.03em] whitespace-nowrap ${healthPos ? 'text-[#86F398]' : 'text-[#F38686]'}`}>
                                {o.objectHealth}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    {/* WAREHOUSE TABLE HEADER */}
                    <div className="flex h-9 shrink-0 items-stretch bg-[#0a0a0a] border-b border-[#262626]">
                      {WAREHOUSE_COLUMNS.map(col => (
                        <div key={col.label} className="flex flex-1 items-center px-4 shrink-0" style={{ minWidth: col.minW }}>
                          <span className="text-[13px] tracking-[-0.03em] text-[#aaaaaa] whitespace-nowrap">{col.label}</span>
                        </div>
                      ))}
                    </div>
                    {/* WAREHOUSE TABLE ROWS */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                      {pageRecords.map((w, i) => {
                        const capPct = computeCapacityPercent(w.usedCapacity, w.totalCapacity)
                        const pos = isCapacityHealthy(capPct)
                        return (
                          <div
                            key={w.warehouseId}
                            onClick={() => setSelectedIdx(i)}
                            onDoubleClick={() => { setDrilledWarehouseIdx(page * RECORDS_PER_PAGE + i); setSelectedObjectIdx(null); handleClearObjectFilters() }}
                            className={`flex h-7 items-stretch border-b border-[#151515] cursor-pointer transition-colors ${rowBg(i, selectedIdx === i)}`}
                          >
                            <div className="flex min-w-[120px] flex-1 items-center gap-1.5 px-4 shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="/icons/warehouse.svg" alt="" style={{ width: 11, height: 11 }} className="shrink-0 invert" />
                              <span className="text-[13px] tracking-[-0.03em] text-white whitespace-nowrap">{w.id}</span>
                            </div>
                            <div className="flex min-w-[120px] flex-1 items-center px-4 shrink-0">
                              <span className="text-[13px] tracking-[-0.03em] text-white whitespace-nowrap">{w.title}</span>
                            </div>
                            <div className="flex min-w-[120px] flex-1 items-center px-4 shrink-0">
                              <span className="text-[13px] tracking-[-0.03em] text-white whitespace-nowrap">{w.region}</span>
                            </div>
                            <div className="flex min-w-[140px] flex-1 items-center px-4 shrink-0">
                              <span className="text-[13px] tracking-[-0.03em] text-white whitespace-nowrap">{w.objectCategory}</span>
                            </div>
                            <div className="flex min-w-[90px] flex-1 items-center px-4 shrink-0">
                              <span className={`text-[13px] tracking-[-0.03em] whitespace-nowrap ${w.status === 'Open' ? 'text-white' : 'text-[#F38686]'}`}>
                                {w.status}
                              </span>
                            </div>
                            <div className="flex min-w-[140px] flex-1 items-center gap-1.5 px-4 shrink-0">
                              <span className={`text-[13px] tracking-[-0.03em] whitespace-nowrap ${pos ? 'text-[#86F398]' : 'text-[#F38686]'}`}>
                                {capPct}%
                              </span>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={pos ? '/icons/arrow-up.svg' : '/icons/arrow-down.svg'} alt="" style={{ width: 14, height: 9 }} className="shrink-0" />
                            </div>
                            <div className="flex min-w-[150px] flex-1 items-center px-4 shrink-0">
                              <span className="text-[13px] tracking-[-0.03em] text-white whitespace-nowrap">{w.businessLinkType ?? '—'}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Status bar */}
            {!drilledWarehouse && totalPages > 1 && (
              <div className="flex h-6 shrink-0 items-center justify-center border-t border-[#262626] bg-[#0a0a0a]">
                <span className="text-[11px] tracking-[-0.03em] text-[#d0d0d0]">
                  Page {page + 1} of {totalPages} &middot; {filteredWarehouses.length} records
                </span>
              </div>
            )}
            {drilledWarehouse && (
              <div className="flex h-6 shrink-0 items-center justify-center border-t border-[#262626] bg-[#0a0a0a]">
                <span className="text-[11px] tracking-[-0.03em] text-[#d0d0d0]">
                  {filteredObjects.length} objects
                </span>
              </div>
            )}
          </div>

          {/* ── INSPECTOR COLUMN ───────────────────────────────────── */}
          {drilledWarehouse && objectForInspector ? (
            <ResizablePanel edge="left" defaultWidth={290} minWidth={250} maxWidth={450} className="hidden lg:flex border-l border-[#262626]">
              <ObjectInspector object={objectForInspector} onClose={() => setSelectedObjectIdx(null)} />
            </ResizablePanel>
          ) : drilledWarehouse ? (
            <ResizablePanel edge="left" defaultWidth={290} minWidth={250} maxWidth={450} className="hidden lg:flex border-l border-[#262626]">
              <WarehouseInspector warehouse={drilledWarehouse} onClose={() => { setDrilledWarehouseIdx(null); setSelectedObjectIdx(null) }} />
            </ResizablePanel>
          ) : sel ? (
            <ResizablePanel edge="left" defaultWidth={290} minWidth={250} maxWidth={450} className="hidden lg:flex border-l border-[#262626]">
              <WarehouseInspector warehouse={sel} onClose={() => setSelectedIdx(null)} />
            </ResizablePanel>
          ) : null}

        </div>
        )}
      </div>
    </div>
  )
}

export default function WarehousingPage() {
  return (
    <Suspense>
      <WarehousingContent />
    </Suspense>
  )
}

