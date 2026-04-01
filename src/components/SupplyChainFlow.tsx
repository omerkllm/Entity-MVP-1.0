'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { SupplyChainNode } from '@/lib/data/types'
import { FLOW_PIECES } from './supply-chain/flow-pieces'
import FlowPiece from './supply-chain/FlowPiece'

export default function SupplyChainFlow({ nodes = [], compact = false }: { nodes?: SupplyChainNode[]; compact?: boolean }) {
  const router = useRouter()
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const nodeMap = useMemo(() => {
    const map = new Map<string, SupplyChainNode>()
    for (const n of nodes) map.set(n.id, n)
    return map
  }, [nodes])

  const handleClick = useCallback(
    (node: SupplyChainNode) => {
      router.push(`/inventory/warehousing?process=${encodeURIComponent(node.id)}`)
    },
    [router],
  )

  return (
    <div className="w-full">
      <div
        className={`relative w-full ${compact ? 'h-[110px]' : 'h-[155px] lg:h-[185px] xl:h-[210px]'}`}
      >
        {FLOW_PIECES.map(piece => {
          const node = nodeMap.get(piece.nodeId)
          if (!node) return null
          return (
            <FlowPiece
              key={node.id}
              piece={piece}
              node={node}
              isHovered={hoveredId === node.id}
              onHover={setHoveredId}
              onClick={handleClick}
            />
          )
        })}
      </div>
    </div>
  )
}
