'use client'

import { useState, useMemo, useEffect, memo } from 'react'
import api from '@/lib/api'
import Sidebar from '@/components/Sidebar'
import SupplyChainFlow from '@/components/SupplyChainFlow'
import { computeCapacityPercent } from '@/lib/data/helpers'
import type { DBWarehouse, SupplyChainNode } from '@/lib/data/types'
import { padTwo } from '@/utils/format'
import { formatWarehouseName } from '@/utils/format'

// -- Colors -----------------------------------------------------------------
const TRANSIT_COLORS = ['#aeffbd', '#7ef794', '#4fd768', '#2fb84a', '#1a9633']

// ---------------------------------------------------------------------------
export default function SupplyChainDashboardPage() {
  const [nodes, setNodes] = useState<SupplyChainNode[]>([])
  const [recentActivity, setRecentActivity] = useState<{ text: string; time: string }[]>([])
  const [warehouses, setWarehouses] = useState<DBWarehouse[]>([])
  const [avgHealth, setAvgHealth] = useState(0)
  const [warehouseTotal, setWarehouseTotal] = useState(0)
  const [nodeTotal, setNodeTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [transitProcessId, setTransitProcessId] = useState('')
  const [capacityProcessId, setCapacityProcessId] = useState('')

  useEffect(() => {
    api.get('/api/scd-data').then(({ data }) => {
      const proc = data.processes
      const activity = data.activity
      const wh = data.warehouses
      const dash = data.dashboard

      setNodes(proc.data)
      setNodeTotal(proc.total)
      // Map activity entries: resolve node name from processes
      const nodeMap = new Map(proc.data.map((n: SupplyChainNode) => [n.id, n.name]))
      setRecentActivity(activity.data.map((a: { nodeId: string; eventType: string; time: string }) => ({
        text: nodeMap.has(a.nodeId) ? `${nodeMap.get(a.nodeId)} ${a.eventType}` : a.eventType,
        time: a.time,
      })))
      setWarehouses(wh.data)
      setWarehouseTotal(wh.total)
      // avgHealth from dashboard — computed from ALL objects in DB via SQL
      setAvgHealth(Math.round(dash.avg_health ?? 0))
      // Set default dropdown selections on first load (functional updater preserves any user selection)
      if (proc.data.length > 0) {
        const defaultId = proc.data[6]?.id ?? proc.data[0]?.id ?? ''
        setTransitProcessId(prev => prev || defaultId)
        setCapacityProcessId(prev => prev || defaultId)
      }
    }).catch(err => console.error('[SCD] data fetch error:', err))
      .finally(() => setLoading(false))
  }, [])

  const { activeNodes, disruptedNodes } = useMemo(() => {
    const active: SupplyChainNode[] = []
    const disrupted: SupplyChainNode[] = []
    for (const n of nodes) {
      if (n.status === 'Active') active.push(n)
      else disrupted.push(n)
    }
    return { activeNodes: active, disruptedNodes: disrupted }
  }, [nodes])
  const disruptionCount = disruptedNodes.length

  // Transit stock distribution per warehouse for selected node
  // transitQty is pre-computed in the warehouse SQL query — no object fetch needed
  const transitWarehouses = useMemo(() => {
    const items = warehouses
      .filter(w => w.processId === transitProcessId && w.transitQty > 0)

    const total = items.reduce((s, w) => s + w.transitQty, 0)
    return items
      .map(w => ({ ...w, transitPct: total > 0 ? Math.round((w.transitQty / total) * 100) : 0 }))
      .slice(0, 5)
  }, [transitProcessId, warehouses])

  // Warehouse capacity stats for selected node
  const capacityWarehouses = useMemo(() => {
    return warehouses
      .filter(w => w.processId === capacityProcessId)
      .map(w => ({ ...w, capPct: computeCapacityPercent(w.usedCapacity, w.totalCapacity) }))
      .slice(0, 5)
  }, [capacityProcessId, warehouses])

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      <Sidebar />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* TOP BAR */}
        <div className="flex h-[38px] items-center bg-[#111111] border-b border-[#262626] px-4 gap-1.5 shrink-0">
          <span className="text-[13px] tracking-[-0.03em] text-white font-normal">Supply Chain Dashboard</span>
          <span className="text-[13px] tracking-[-0.03em] text-[#86F398] font-normal">{'{SCD}'}</span>
        </div>

        {/* SUB HEADER */}
        <div className="h-[38px] shrink-0 flex items-center px-4 border-b border-[#262626]">
          <span className="text-[13px] tracking-[-0.03em] text-white">{'Statistical Analysis { Supply Chain }'}</span>
        </div>

        {/* MAIN SCROLLABLE AREA */}
        {loading ? (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left panel skeleton */}
            <div className="flex flex-col flex-[6] min-w-0 p-5 gap-5">
              {/* Stat cards */}
              <div className="flex gap-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="flex-1 bg-[#111111] p-5 flex flex-col gap-3">
                    <div className="sk h-7 w-12" />
                    <div className="sk h-3 w-28" />
                  </div>
                ))}
              </div>
              {/* Activity list skeleton */}
              <div className="bg-[#111111] p-5 flex flex-col gap-4">
                <div className="sk h-4 w-28" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#181818] px-4 py-3">
                    <div className="sk h-3" style={{ width: `${55 + (i % 3) * 15}%` }} />
                    <div className="sk h-3 w-16 ml-4 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
            {/* Right panel skeleton */}
            <div className="hidden lg:flex flex-col flex-[3.5] min-w-[300px] border-l border-[#262626] p-5 gap-5">
              <div className="bg-[#111111] p-5 flex flex-col gap-4">
                <div className="sk h-4 w-32" />
                <div className="sk h-28 w-full" />
              </div>
              <div className="bg-[#111111] p-5 flex flex-col gap-4">
                <div className="sk h-4 w-36" />
                <div className="sk h-44 w-full" />
              </div>
              <div className="bg-[#111111] p-5 flex flex-col gap-4">
                <div className="sk h-4 w-28" />
                <div className="sk h-44 w-full" />
              </div>
            </div>
          </div>
        ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden fade-in">

          {/* LEFT PANEL */}
          <div className="flex flex-col flex-[6] min-w-0 overflow-y-auto scrollbar-hide p-5 gap-5">
            {/* STAT CARDS */}
            <div className="flex gap-2">
              <StatCard bg="bg-[#231f00]" value={padTwo(disruptionCount)} label="Supply Chain Disruptions" />
              <StatCard
                bg="bg-[#111111]"
                value={`${avgHealth >= 0 ? '+' : ''}${avgHealth}%`}
                label="Average Object Health"
                valueClass={avgHealth >= 0 ? 'text-[#86F398]' : 'text-[#F38686]'}
              />
              <StatCard bg="bg-[#111111]" value={padTwo(warehouseTotal)} label="Total Warehouses" />
              <StatCard bg="bg-[#111111]" value={padTwo(nodeTotal)} label="Total Supply Chain Nodes" />
            </div>

            {/* RECENT ACTIVITY */}
            <div className="bg-[#111111] p-5 flex flex-col gap-4">
              <SectionTitle>Recent Activity</SectionTitle>
              <div className="flex flex-col gap-2.5">
                {recentActivity.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#181818] px-4 py-3">
                    <span className="text-[13px] tracking-[-0.03em] text-white">{item.text}</span>
                    <span className="text-[13px] tracking-[-0.03em] text-[#aaaaaa] shrink-0 ml-4">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="hidden lg:flex flex-col flex-[3.5] min-w-[300px] border-l border-[#262626] overflow-y-auto scrollbar-hide p-5 gap-5">

            {/* SUPPLY CHAIN HEALTH */}
            <div className="bg-[#111111] p-5 flex flex-col gap-4">
              <SectionTitle>Supply Chain Health</SectionTitle>

              {/* Sankey flow visualization — click a node to open its warehouses */}
              <SupplyChainFlow nodes={nodes} compact />

              {/* Legend */}
              {disruptedNodes.map(n => (
                <div key={n.id} className="bg-[#0a0a0a] flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-[18px] h-[18px] rounded-[3px] bg-[#ff2929] shrink-0" />
                    <span className="text-[13px] tracking-[-0.03em] text-white">{n.name}</span>
                  </div>
                  <span className="text-[13px] tracking-[-0.03em] text-[#F38686]">Disrupted</span>
                </div>
              ))}
              {activeNodes.length > 0 && (
                <div className="bg-[#0a0a0a] flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-[18px] h-[18px] rounded-[3px] bg-[#5f8fff] shrink-0" />
                    <span className="text-[13px] tracking-[-0.03em] text-white">{activeNodes.length} Active Nodes</span>
                  </div>
                  <span className="text-[13px] tracking-[-0.03em] text-[#86F398]">Active</span>
                </div>
              )}
            </div>

            {/* TRANSIT STOCK DISTRIBUTION */}
            <div className="bg-[#111111] p-5 flex flex-col gap-4">
              <div className="bg-[#0a0a0a] flex items-center justify-between px-4 py-2.5">
                <span className="text-[15px] tracking-[-0.04em] text-white">Transit Stock Distribution</span>
                <NodeDropdown nodes={nodes} value={transitProcessId} onChange={setTransitProcessId} />
              </div>

              {/* Stacked bar */}
              <div className="flex h-[40px] rounded-[3px] overflow-hidden">
                {transitWarehouses.length > 0
                  ? transitWarehouses.map((w, i) => (
                      <div
                        key={w.id}
                        className="h-full transition-all"
                        style={{ width: `${w.transitPct}%`, backgroundColor: TRANSIT_COLORS[i % TRANSIT_COLORS.length], minWidth: w.transitPct > 0 ? 4 : 0 }}
                      />
                    ))
                  : <div className="flex-1 bg-[#1e1e1e] flex items-center justify-center">
                      <span className="text-[11px] text-[#999999]">No transit data</span>
                    </div>
                }
              </div>

              {/* Legend */}
              <div className="flex flex-col gap-2.5">
                {transitWarehouses.map((w, i) => (
                  <div key={w.id} className="bg-[#0a0a0a] flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-[18px] h-[18px] rounded-[3px] shrink-0" style={{ backgroundColor: TRANSIT_COLORS[i % TRANSIT_COLORS.length] }} />
                      <span className="text-[13px] tracking-[-0.03em] text-white">{formatWarehouseName(w.warehouseName, w.id)}</span>
                    </div>
                    <span className="text-[13px] tracking-[-0.03em] text-white">{w.transitPct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* WAREHOUSE CAPACITY STATS */}
            <div className="bg-[#111111] p-5 flex flex-col gap-4">
              <div className="bg-[#0a0a0a] flex items-center justify-between px-4 py-2.5">
                <span className="text-[15px] tracking-[-0.04em] text-white">Warehouse Capacity Stats</span>
                <NodeDropdown nodes={nodes} value={capacityProcessId} onChange={setCapacityProcessId} />
              </div>

              <div className="flex flex-col gap-3">
                {capacityWarehouses.length > 0
                  ? capacityWarehouses.map(w => {
                      const isHigh = w.capPct >= 80
                      return (
                        <div key={w.id} className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] tracking-[-0.03em] text-white">{formatWarehouseName(w.warehouseName, w.id)}</span>
                            <span className={`text-[13px] tracking-[-0.03em] ${isHigh ? 'text-[#F38686]' : 'text-white'}`}>
                              {w.capPct}%
                            </span>
                          </div>
                          <div className="relative h-[12px] bg-[#1e1e1e] rounded-[5px] overflow-hidden">
                            <div
                              className={`absolute top-0 left-0 h-full rounded-[5px] transition-all ${isHigh ? 'bg-[rgba(255,16,16,0.8)]' : 'bg-[#5f8fff]'}`}
                              style={{ width: `${Math.min(w.capPct, 100)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  : <span className="text-[11px] text-[#999999] text-center py-4">No warehouses for this node</span>
                }
              </div>
            </div>
          </div>

        </div>
        )}
      </div>
    </div>
  )
}

// -- Sub-components ---------------------------------------------------------
const StatCard = memo(function StatCard({ bg, value, label, valueClass }: { bg: string; value: string; label: string; valueClass?: string }) {
  return (
    <div className={`flex-1 flex flex-col items-center justify-center ${bg} py-6 px-3`}>
      <span className={`text-[48px] tracking-[-0.04em] font-normal leading-none ${valueClass ?? 'text-white'}`}>
        {value}
      </span>
      <span className="text-[13px] tracking-[-0.03em] text-[#d5d5d5] mt-1 text-center">
        {label}
      </span>
    </div>
  )
})

const SectionTitle = memo(function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#0a0a0a] px-4 py-2.5">
      <span className="text-[15px] tracking-[-0.04em] text-white">{children}</span>
    </div>
  )
})

const NodeDropdown = memo(function NodeDropdown({ nodes, value, onChange }: { nodes: SupplyChainNode[]; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-[#1e1e1e] text-[12px] tracking-[-0.03em] text-white px-3 py-1.5 border-none outline-none cursor-pointer rounded-none"
    >
      {nodes.map(n => (
        <option key={n.id} value={n.id}>{n.name}</option>
      ))}
    </select>
  )
})
