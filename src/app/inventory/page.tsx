'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import SupplyChainFlow from '@/components/SupplyChainFlow'
import type { SupplyChainNode } from '@/lib/data/types'

export default function InventoryPage() {
  const [nodes, setNodes] = useState<SupplyChainNode[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/processes')
      .then(r => setNodes(r.data.data))
      .catch(err => console.error('[InventoryPage] fetch error:', err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex h-screen bg-[#080808] overflow-hidden">

      <Sidebar />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="h-[38px] shrink-0 bg-[#111111] flex items-center px-4 gap-1.5 border-b border-[#1e1e1e]">
          <span className="text-[13px] tracking-[-0.03em] text-[#e0e0e0] font-normal">
            Inventory / Warehousing
          </span>
          <span className="text-[13px] tracking-[-0.03em] text-[#86F398] font-normal">
            {'{IW}'}
          </span>
        </header>

        {/* Sub-header: breadcrumb + nav arrows */}
        <div className="h-[38px] shrink-0 flex items-center justify-between px-4 border-b border-[#1e1e1e] bg-[#080808]">
          <span className="text-[13px] tracking-[-0.03em] text-[#e0e0e0]">
            Supply Chain
          </span>
          <div className="flex items-center gap-1.5">
            <Link
              href="/inventory/warehousing"
              className="flex items-center px-2.5 h-7 bg-[#1b1b1b] border border-[#2c2c2c] hover:bg-[#222222] transition-colors text-[12px] tracking-[-0.03em] text-white whitespace-nowrap"
            >
              View All Warehouses
            </Link>
            <button className="w-7 h-7 flex items-center justify-center bg-[#1b1b1b] border border-[#2c2c2c] hover:bg-[#222222] cursor-pointer transition-colors">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/nav-back.svg" alt="Back" width={14} height={14} style={{ width: 14, height: 14 }} className="invert" />
            </button>
            <button className="w-7 h-7 flex items-center justify-center bg-[#1b1b1b] border border-[#2c2c2c] hover:bg-[#222222] cursor-pointer transition-colors">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/nav-forward.svg" alt="Forward" width={14} height={14} style={{ width: 14, height: 14 }} className="invert" />
            </button>
          </div>
        </div>

        {/* Fixed upper section: title + sankey + table header */}
        <div className="shrink-0 px-3 sm:px-5 pt-3 sm:pt-4 flex flex-col gap-3">

          {/* Title */}
          <h1 className="text-[13px] tracking-[-0.03em] text-white font-normal">
            {'{Company A}'} Supply Chain Inventory / Warehousing System
          </h1>

          {/* Sankey — hidden on xs so list gets full height */}
          <div className="hidden sm:block">
            <SupplyChainFlow nodes={nodes} />
          </div>

          {/* Table header */}
          <div className="flex items-center justify-between px-4 h-10 bg-[#181818] mt-3">
            <span className="text-[13px] tracking-[-0.03em] text-white">
              Supply Chain Modules
            </span>
            <span className="text-[13px] tracking-[-0.03em] text-white">
              Branch ID
            </span>
          </div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pb-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-[13px] tracking-[-0.03em] text-[#999999] animate-pulse">Loading processes…</span>
            </div>
          ) : (
          <div className="flex flex-col gap-[4px] pt-[4px]">
            {nodes.map((node) => (
              <Link
                key={node.id}
                href={`/inventory/warehousing?process=${node.id}`}
                className="w-full flex items-center justify-between px-4 h-8 bg-[#111111] hover:bg-[#181818] cursor-pointer transition-colors text-left"
              >
                <span className="text-[13px] tracking-[-0.03em] text-white">
                  {node.name}
                </span>
                <span className="text-[13px] tracking-[-0.03em] text-white">
                  {node.id}
                </span>
              </Link>
            ))}
          </div>
          )}
        </div>

      </div>
    </div>
  )
}