'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import Sidebar from '@/components/Sidebar'
import WarehouseInspector from '@/components/WarehouseInspector'
import BusinessInspector from '@/components/BusinessInspector'
import { AIChatPanel } from '@/components/ai'
import ResizablePanel from '@/components/ui/ResizablePanel'
import api from '@/lib/api'
import DMP_FILTERS from '@/data/dmp-filters.json'
import AI_AGENT from '@/data/ai-agent-simulations.json'
import type { DBWarehouse, DBBusiness } from '@/lib/data/types'
import type { BusinessPin, DmpMapHandle } from '@/components/DmpMap'

const DmpMap = dynamic(() => import('@/components/DmpMap'), { ssr: false })

type InspectorTab =
  | { id: string; type: 'agent' }
  | { id: string; type: 'warehouse'; warehouseId: string; label: string }
  | { id: string; type: 'business'; businessId: string; label: string }

const AGENT_TAB: InspectorTab = { id: '__agent__', type: 'agent' }

export default function DecisionMakingPage() {
  const [warehouses, setWarehouses] = useState<DBWarehouse[]>([])
  const [businesses, setBusinesses] = useState<BusinessPin[]>([])
  const [rawBusinesses, setRawBusinesses] = useState<DBBusiness[]>([])
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const mapRef = useRef<DmpMapHandle>(null)

  // ── Filter state ────────────────────────────────────────────────
  // Entity: radio-style — only one active at a time (default: show-all)
  const [entityFilter, setEntityFilter] = useState<string>('show-all')
  // Link: radio-style — optional single selection
  const [linkFilter, setLinkFilter] = useState<string | null>(null)
  // Category: multi-select set of objectCategory names
  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(new Set())
  // Show More / Less state for filter sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  // Category search term
  const [categorySearch, setCategorySearch] = useState('')

  // ── Tabs state ──────────────────────────────────────────────────
  const [tabs, setTabs] = useState<InspectorTab[]>([AGENT_TAB])
  const [activeTabId, setActiveTabId] = useState<string>(AGENT_TAB.id)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    api.get('/api/dmp-data').then(({ data }) => {
      setWarehouses(data.warehouses.data)
      setRawBusinesses(data.businesses.data)
      const pins: BusinessPin[] = data.businesses.data.map((b: DBBusiness) => ({
        id: b.businessId,
        name: `${b.objectCategory} (${b.region})`,
        coordinates: b.coordinates,
        objectCategory: b.objectCategory,
        linkType: b.linkType ? (b.linkType.toLowerCase() as 'supplier' | 'customer') : null,
        linkedWarehouseIds: b.linkedWarehouseIds,
      }))
      setBusinesses(pins)
    }).catch(err => console.error('[DMP] data fetch error:', err))
      .finally(() => setLoading(false))
  }, [])

  // ── Derive all unique object categories from data ───────────────
  const warehouseCategories = useMemo(() => {
    const cats = new Set<string>()
    warehouses.forEach(w => cats.add(w.objectCategory))
    return Array.from(cats).sort()
  }, [warehouses])

  const businessCategories = useMemo(() => {
    const cats = new Set<string>()
    rawBusinesses.forEach(b => cats.add(b.objectCategory))
    return Array.from(cats).sort()
  }, [rawBusinesses])

  const toggleCategory = (cat: string) => {
    setCategoryFilters(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  const clearAllFilters = () => {
    setEntityFilter('show-all')
    setLinkFilter(null)
    setCategoryFilters(new Set())
    setExpandedSections(new Set())
    setCategorySearch('')
  }

  // ── Filtered data for the map ───────────────────────────────────
  const filteredWarehouses = useMemo(() => {
    if (entityFilter === 'businesses-only') return []
    let list = warehouses
    if (categoryFilters.size > 0) {
      list = list.filter(w => categoryFilters.has(w.objectCategory))
    }
    return list
  }, [warehouses, entityFilter, categoryFilters])

  const filteredBusinesses = useMemo(() => {
    if (entityFilter === 'warehouses-only') return []
    let list = businesses
    if (linkFilter === 'linked-only') list = list.filter(b => b.linkedWarehouseIds.length > 0)
    else if (linkFilter === 'not-linked') list = list.filter(b => b.linkedWarehouseIds.length === 0)
    else if (linkFilter === 'supplier-only') list = list.filter(b => b.linkType === 'supplier')
    else if (linkFilter === 'customer-only') list = list.filter(b => b.linkType === 'customer')
    if (categoryFilters.size > 0) {
      list = list.filter(b => categoryFilters.has(b.objectCategory))
    }
    return list
  }, [businesses, entityFilter, linkFilter, categoryFilters])

  // ── Pin click → open / update warehouse or business tab ──────
  const handlePinClick = useCallback((type: 'warehouse' | 'business', id: string) => {
    if (type === 'warehouse') {
      const w = warehouses.find(wh => wh.warehouseId === id)
      const label = w ? w.warehouseName : id
      setTabs(prev => {
        const idx = prev.findIndex(t => t.type === 'warehouse')
        const updated: InspectorTab = { id: 'wh', type: 'warehouse', warehouseId: id, label }
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = updated
          return next
        }
        return [...prev, updated]
      })
      setActiveTabId('wh')
      const coords = w?.coordinates
      if (coords) mapRef.current?.zoomTo(coords)
    } else if (type === 'business') {
      const b = rawBusinesses.find(biz => biz.businessId === id)
      const label = b ? `${b.objectCategory} (${b.region})` : id
      setTabs(prev => {
        const idx = prev.findIndex(t => t.type === 'business')
        const updated: InspectorTab = { id: 'biz', type: 'business', businessId: id, label }
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = updated
          return next
        }
        return [...prev, updated]
      })
      setActiveTabId('biz')
      const coords = b?.coordinates
      if (coords) mapRef.current?.zoomTo(coords)
    }
  }, [warehouses, rawBusinesses])

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => prev.filter(t => t.id !== tabId))
    setActiveTabId(prev => prev === tabId ? AGENT_TAB.id : prev)
    mapRef.current?.resetZoom()
  }, [])

  const handleTabClick = useCallback((tab: InspectorTab) => {
    setActiveTabId(tab.id)
    if (tab.type === 'warehouse') {
      const w = warehouses.find(wh => wh.warehouseId === tab.warehouseId)
      if (w?.coordinates) mapRef.current?.zoomTo(w.coordinates)
    } else if (tab.type === 'business') {
      const b = rawBusinesses.find(biz => biz.businessId === tab.businessId)
      if (b?.coordinates) mapRef.current?.zoomTo(b.coordinates)
    }
  }, [warehouses, rawBusinesses])

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      <Sidebar />

      {/* MAIN CONTENT */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* TOP BAR */}
        <div className="flex h-[38px] items-center bg-[#111111] border-b border-[#262626] px-4 gap-1.5 shrink-0">
          <span className="text-[13px] tracking-[-0.03em] text-white font-normal">Decision Making Portal</span>
          <span className="text-[13px] tracking-[-0.03em] text-[#86F398] font-normal">{`{DMP}`}</span>
        </div>

        {/* THREE-COLUMN LAYOUT */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-[13px] tracking-[-0.03em] text-[#999999] animate-pulse">Loading map data…</span>
          </div>
        ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* LEFT: Quick Actions / Filters */}
          <ResizablePanel edge="right" defaultWidth={220} minWidth={180} maxWidth={400} className="hidden md:flex border-r border-[#262626]">
            {/* Sub-header */}
            <div className="h-[38px] shrink-0 flex items-center px-4 border-b border-[#262626]">
              <span className="text-[13px] tracking-[-0.03em] text-white">Quick Actions</span>
            </div>

            {/* Filter sections */}
            <div className="flex-1 overflow-y-auto scrollbar-hide py-3 px-3 flex flex-col gap-4">

              {/* Entity Type Filters */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[14px] tracking-[-0.03em] text-[#d5d5d5] leading-tight">
                  Entity Type
                </span>
                <div className="flex flex-col gap-[5px]">
                  {(expandedSections.has('entity') ? DMP_FILTERS.entityFilters : DMP_FILTERS.entityFilters.slice(0, 3)).map((f) => {
                    const isActive = entityFilter === f.key
                    const count = f.key === 'show-all'
                      ? warehouses.length + rawBusinesses.length
                      : f.key === 'warehouses-only'
                        ? warehouses.length
                        : rawBusinesses.length
                    return (
                      <div
                        key={f.key}
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setEntityFilter(f.key)}
                      >
                        <div className="flex items-center gap-1.5">
                          {isActive ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src="/icons/filter-checked.svg" alt="" style={{ width: 11, height: 11 }} className="shrink-0" />
                          ) : (
                            <div className="shrink-0 bg-[#1b1b1b] rounded-[1px]" style={{ width: 11, height: 11 }} />
                          )}
                          <span className="text-[13px] tracking-[-0.03em] text-white">{f.label}</span>
                        </div>
                        <span className="text-[13px] tracking-[-0.03em] text-[#d0d0d0]">{count}</span>
                      </div>
                    )
                  })}
                  {DMP_FILTERS.entityFilters.length > 3 && (
                    <button
                      onClick={() => setExpandedSections(prev => {
                        const next = new Set(prev)
                        if (next.has('entity')) next.delete('entity'); else next.add('entity')
                        return next
                      })}
                      className="w-full flex items-center justify-center h-7 bg-[#111111] hover:bg-[#181818] cursor-pointer transition-colors mt-1 rounded-[3px]"
                    >
                      <span className="text-[12px] tracking-[-0.03em] text-white">
                        {expandedSections.has('entity') ? 'Show Less' : 'Show More'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Link Type Filters */}
              {entityFilter !== 'warehouses-only' && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[14px] tracking-[-0.03em] text-[#d5d5d5] leading-tight">
                    Business Link Type
                  </span>
                  <div className="flex flex-col gap-[5px]">
                    {(expandedSections.has('link') ? DMP_FILTERS.linkFilters : DMP_FILTERS.linkFilters.slice(0, 3)).map((f) => {
                      const isActive = linkFilter === f.key
                      const count = f.key === 'linked-only'
                        ? rawBusinesses.filter(b => b.linkType).length
                        : f.key === 'not-linked'
                          ? rawBusinesses.filter(b => !b.linkType).length
                          : f.key === 'supplier-only'
                            ? rawBusinesses.filter(b => b.linkType === 'Supplier').length
                            : rawBusinesses.filter(b => b.linkType === 'Customer').length
                      return (
                        <div
                          key={f.key}
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setLinkFilter(isActive ? null : f.key)}
                        >
                          <div className="flex items-center gap-1.5">
                            {isActive ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src="/icons/filter-checked.svg" alt="" style={{ width: 11, height: 11 }} className="shrink-0" />
                            ) : (
                              <div className="shrink-0 bg-[#1b1b1b] rounded-[1px]" style={{ width: 11, height: 11 }} />
                            )}
                            <span className="text-[13px] tracking-[-0.03em] text-white">{f.label}</span>
                          </div>
                          <span className="text-[13px] tracking-[-0.03em] text-[#d0d0d0]">{count}</span>
                        </div>
                      )
                    })}
                    {DMP_FILTERS.linkFilters.length > 3 && (
                      <button
                        onClick={() => setExpandedSections(prev => {
                          const next = new Set(prev)
                          if (next.has('link')) next.delete('link'); else next.add('link')
                          return next
                        })}
                        className="w-full flex items-center justify-center h-7 bg-[#111111] hover:bg-[#181818] cursor-pointer transition-colors mt-1 rounded-[3px]"
                      >
                        <span className="text-[12px] tracking-[-0.03em] text-white">
                          {expandedSections.has('link') ? 'Show Less' : 'Show More'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Warehouse Category Filters — hidden when businesses-only */}
              {entityFilter !== 'businesses-only' && warehouseCategories.length > 0 && (() => {
                const searched = categorySearch
                  ? warehouseCategories.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()))
                  : warehouseCategories
                const isExpanded = expandedSections.has('wh-cat')
                const visible = isExpanded ? searched : searched.slice(0, 3)
                const hasMore = searched.length > 3
                return (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[14px] tracking-[-0.03em] text-[#d5d5d5] leading-tight">
                      Warehouse Category
                    </span>
                    <div className="flex items-center h-[28px] border border-[#262626] rounded-[4px] bg-[#0a0a0a] overflow-hidden">
                      <input
                        type="text"
                        placeholder="Search..."
                        value={categorySearch}
                        onChange={e => setCategorySearch(e.target.value)}
                        className="w-full h-full px-2 text-[13px] tracking-[-0.03em] text-white bg-transparent outline-none placeholder:text-[#888]"
                      />
                    </div>
                    <div className="flex flex-col gap-[5px]">
                      {visible.map((cat) => {
                        const isActive = categoryFilters.has(cat)
                        const count = warehouses.filter(w => w.objectCategory === cat).length
                        return (
                          <div
                            key={cat}
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => toggleCategory(cat)}
                          >
                            <div className="flex items-center gap-1.5">
                              {isActive ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src="/icons/filter-checked.svg" alt="" style={{ width: 11, height: 11 }} className="shrink-0" />
                              ) : (
                                <div className="shrink-0 bg-[#1b1b1b] rounded-[1px]" style={{ width: 11, height: 11 }} />
                              )}
                              <span className="text-[13px] tracking-[-0.03em] text-white">{cat}</span>
                            </div>
                            <span className="text-[13px] tracking-[-0.03em] text-[#d0d0d0]">{count}</span>
                          </div>
                        )
                      })}
                      {hasMore && (
                        <button
                          onClick={() => setExpandedSections(prev => {
                            const next = new Set(prev)
                            if (next.has('wh-cat')) next.delete('wh-cat'); else next.add('wh-cat')
                            return next
                          })}
                          className="w-full flex items-center justify-center h-7 bg-[#111111] hover:bg-[#181818] cursor-pointer transition-colors mt-1 rounded-[3px]"
                        >
                          <span className="text-[12px] tracking-[-0.03em] text-white">
                            {isExpanded ? 'Show Less' : 'Show More'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Business Category Filters — hidden when warehouses-only */}
              {entityFilter !== 'warehouses-only' && businessCategories.length > 0 && (() => {
                const searched = categorySearch
                  ? businessCategories.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()))
                  : businessCategories
                const isExpanded = expandedSections.has('biz-cat')
                const visible = isExpanded ? searched : searched.slice(0, 3)
                const hasMore = searched.length > 3
                return (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[14px] tracking-[-0.03em] text-[#d5d5d5] leading-tight">
                      Business Category
                    </span>
                    <div className="flex flex-col gap-[5px]">
                      {visible.map((cat) => {
                        const isActive = categoryFilters.has(cat)
                        const count = rawBusinesses.filter(b => b.objectCategory === cat).length
                        return (
                          <div
                            key={cat}
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => toggleCategory(cat)}
                          >
                            <div className="flex items-center gap-1.5">
                              {isActive ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src="/icons/filter-checked.svg" alt="" style={{ width: 11, height: 11 }} className="shrink-0" />
                              ) : (
                                <div className="shrink-0 bg-[#1b1b1b] rounded-[1px]" style={{ width: 11, height: 11 }} />
                              )}
                              <span className="text-[13px] tracking-[-0.03em] text-white">{cat}</span>
                            </div>
                            <span className="text-[13px] tracking-[-0.03em] text-[#d0d0d0]">{count}</span>
                          </div>
                        )
                      })}
                      {hasMore && (
                        <button
                          onClick={() => setExpandedSections(prev => {
                            const next = new Set(prev)
                            if (next.has('biz-cat')) next.delete('biz-cat'); else next.add('biz-cat')
                            return next
                          })}
                          className="w-full flex items-center justify-center h-7 bg-[#111111] hover:bg-[#181818] cursor-pointer transition-colors mt-1 rounded-[3px]"
                        >
                          <span className="text-[12px] tracking-[-0.03em] text-white">
                            {isExpanded ? 'Show Less' : 'Show More'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })()}

            </div>

            {/* Footer buttons */}
            <div className="flex flex-col shrink-0 border-t border-[#262626]">
              <button
                onClick={clearAllFilters}
                className="flex items-center justify-center gap-1.5 mx-2 my-2 py-1.5 rounded-[3px] bg-[#111111] text-[13px] tracking-[-0.03em] text-[#F38686] hover:bg-[#1a0e0e] transition-colors cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/filter-trash-del.svg" alt="" style={{ width: 11, height: 11 }} />
                Delete All Filters
              </button>
            </div>
          </ResizablePanel>

          {/* CENTER: Real Time War Board (Map Placeholder) */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Sub-header */}
            <div className="h-[38px] shrink-0 flex items-center justify-between px-4 border-b border-[#262626]">
              <span className="text-[13px] tracking-[-0.03em] text-white">Real Time War Board</span>

            </div>

            {/* Map — defer until client mount to avoid SSR/hydration mismatch */}
            <div className="flex-1 relative overflow-hidden">
              {mounted && (
                <DmpMap
                  ref={mapRef}
                  warehouses={filteredWarehouses}
                  businesses={filteredBusinesses}
                  onPinClick={handlePinClick}
                />
              )}
            </div>
          </div>

          {/* RIGHT: Tabbed Inspector Panel */}
          <ResizablePanel edge="left" defaultWidth={320} minWidth={280} maxWidth={500} className="hidden lg:flex border-l border-[#262626]">
            {/* Tab bar */}
            <div className="h-[38px] shrink-0 flex items-center border-b border-[#262626] overflow-x-auto scrollbar-hide">
              {tabs.map((tab, _idx) => {
                const isActive = tab.id === activeTabId
                const label = tab.type === 'agent'
                  ? 'Parser Agent'
                  : tab.label
                return (
                  <div key={tab.id} className="flex items-center h-full shrink-0">
                    <button
                      onClick={() => handleTabClick(tab)}
                      className={`flex items-center gap-1.5 h-full px-3 shrink-0 cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-[#0a0a0a]'
                          : 'bg-[#1a1a1a] hover:bg-[#222]'
                      }`}
                    >
                      {tab.type === 'agent' && (
                        <svg viewBox="0 0 22.3325 17.6874" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={isActive ? 'text-white' : 'text-[#666]'} style={{ width: 12, height: 10, flexShrink: 0 }}>
                          <path d="M15.2679 0C15.2679 1.84064 14.8322 3.65514 13.9966 5.29516C13.161 6.93518 11.9491 8.35415 10.4599 9.43605C8.97084 10.518 7.24682 11.2321 5.42884 11.52C3.61086 11.8079 1.75055 11.6615 0 11.0927L1.80213 5.54637C2.6774 5.83077 3.60756 5.90397 4.51655 5.76C5.42553 5.61603 6.28754 5.25898 7.0321 4.71803C7.77665 4.17708 8.38261 3.46759 8.80042 2.64758C9.21824 1.82757 9.43605 0.920319 9.43605 0H15.2679Z"/>
                          <path d="M7.06467 17.6874C7.06467 15.8468 7.50029 14.0323 8.33592 12.3923C9.17155 10.7522 10.3835 9.33328 11.8726 8.25138C13.3617 7.16948 15.0857 6.45537 16.9037 6.16743C18.7217 5.87949 20.582 6.0259 22.3325 6.59469L20.5304 12.1411C19.6551 11.8567 18.725 11.7835 17.816 11.9274C16.907 12.0714 16.045 12.4285 15.3004 12.9694C14.5559 13.5104 13.9499 14.2198 13.5321 15.0399C13.1143 15.8599 12.8965 16.7671 12.8965 17.6874H7.06467Z"/>
                        </svg>
                      )}
                      <span className={`text-[12px] tracking-[-0.03em] whitespace-nowrap ${
                        isActive ? 'text-white' : 'text-[#666]'
                      }`}>
                        {label}
                      </span>
                      {(tab.type === 'warehouse' || tab.type === 'business') && (
                        <span
                          onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                          className="text-[14px] leading-none text-[#888] hover:text-white ml-0.5 cursor-pointer"
                        >
                          ×
                        </span>
                      )}
                    </button>
                  </div>
                )
              })}
              <div className="flex-1" />
            </div>

            {/* ── Tab content (exclusive — only one renders) ── */}
            {(() => {
              const activeTab = tabs.find(t => t.id === activeTabId)
              if (!activeTab || activeTab.type === 'agent') {
                return (
                  <AIChatPanel
                    config={AI_AGENT as import('@/lib/data/types').AIAgentConfig}
                  />
                )
              }

              if (activeTab.type === 'warehouse') {
                const w = warehouses.find(wh => wh.warehouseId === activeTab.warehouseId)
                if (!w) return null
                return (
                  <WarehouseInspector
                    key={activeTab.warehouseId}
                    warehouse={{
                      warehouseId: w.warehouseId,
                      warehouseName: w.warehouseName,
                      region: w.region,
                      coordinates: w.coordinates,
                      hours: w.hours,
                      status: w.status,
                      address: w.address,
                      usedCapacity: w.usedCapacity,
                      totalCapacity: w.totalCapacity,
                      objectCategory: w.objectCategory,
                      businessLinkType: w.businessLinkType,
                    }}
                    showMap={false}
                    onClose={() => closeTab(activeTab.id)}
                  />
                )
              }

              if (activeTab.type === 'business') {
                const b = rawBusinesses.find(biz => biz.businessId === activeTab.businessId)
                if (!b) return null
                return (
                  <BusinessInspector
                    key={activeTab.businessId}
                    business={{
                      businessId: b.businessId,
                      objectCategory: b.objectCategory,
                      region: b.region,
                      coordinates: b.coordinates,
                      linkType: b.linkType,
                      linkedWarehouseIds: b.linkedWarehouseIds,
                    }}
                    showMap={false}
                    onWarehouseClick={(whId) => handlePinClick('warehouse', whId)}
                    onClose={() => closeTab(activeTab.id)}
                  />
                )
              }

              return null
            })()}
          </ResizablePanel>

        </div>
        )}
      </div>
    </div>
  )
}
