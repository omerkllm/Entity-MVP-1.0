'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

type Edge = 'left' | 'right'

type Props = {
  children: ReactNode
  /** Which edge has the drag handle */
  edge: Edge
  /** Default width in px */
  defaultWidth: number
  /** Minimum width in px */
  minWidth?: number
  /** Maximum width in px */
  maxWidth?: number
  /** Extra classes on the outer wrapper */
  className?: string
}

export default function ResizablePanel({
  children,
  edge,
  defaultWidth,
  minWidth = 180,
  maxWidth = 600,
  className = '',
}: Props) {
  const [width, setWidth] = useState(defaultWidth)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true
      startX.current = e.clientX
      startW.current = width
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [width],
  )

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      const newW = edge === 'right'
        ? startW.current + delta
        : startW.current - delta
      setWidth(Math.min(maxWidth, Math.max(minWidth, newW)))
    }

    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      if (dragging.current) {
        dragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [edge, minWidth, maxWidth])

  const onDoubleClick = useCallback(() => {
    setWidth(defaultWidth)
  }, [defaultWidth])

  const handle = (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      className={`absolute top-0 bottom-0 w-[4px] z-10 cursor-col-resize hover:bg-[#2969FF]/30 active:bg-[#2969FF]/40 transition-colors ${
        edge === 'left' ? 'left-0' : 'right-0'
      }`}
    />
  )

  return (
    <div
      className={`relative shrink-0 flex flex-col ${className}`}
      style={{ width }}
    >
      {handle}
      {children}
    </div>
  )
}
