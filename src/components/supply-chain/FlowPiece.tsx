'use client'

import type { SupplyChainNode } from '@/lib/data/types'
import type { FlowPieceData } from './flow-pieces'
import { FRAME_W, FRAME_H, FLOW_COLOR_ACTIVE, FLOW_COLOR_DISRUPTED } from './constants'

interface FlowPieceProps {
  piece: FlowPieceData
  node: SupplyChainNode
  isHovered: boolean
  onHover: (id: string | null) => void
  onClick: (node: SupplyChainNode) => void
}

export default function FlowPiece({ piece, node, isHovered, onHover, onClick }: FlowPieceProps) {
  const fill = node.status !== 'Active' ? FLOW_COLOR_DISRUPTED : FLOW_COLOR_ACTIVE

  return (
    <button
      type="button"
      onClick={() => onClick(node)}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      className="absolute cursor-pointer hover:brightness-125 transition-[filter] duration-150 p-0 bg-transparent border-0"
      style={{
        left:   `${(piece.x / FRAME_W) * 100}%`,
        top:    `${(piece.y / FRAME_H) * 100}%`,
        width:  `${(piece.w / FRAME_W) * 100}%`,
        height: `${(piece.h / FRAME_H) * 100}%`,
      }}
    >
      <svg
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        overflow="visible"
        style={{ display: 'block' }}
        viewBox={piece.viewBox}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={piece.d} fill={fill} />
      </svg>
      {isHovered && (
        <span
          className="pointer-events-none absolute z-50 whitespace-nowrap bg-[#151515] px-3 py-1 text-[12px] tracking-[-0.03em] text-white"
          style={{ bottom: '110%', left: '50%', transform: 'translateX(-50%)', boxShadow: '0 0 8px 2px rgba(0,0,0,0.18)' }}
        >
          {node.name}
        </span>
      )}
    </button>
  )
}
