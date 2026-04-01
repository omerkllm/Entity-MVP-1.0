'use client'

import type { Dispatch, SetStateAction } from 'react'

// ─── Checkbox Filter Section ────────────────────────────────────────
type CheckboxFilterProps = {
  categories: readonly { key: string; label: string }[]
  getOptions: (key: string) => { value: string; label?: string }[]
  activeFilters: Record<string, Set<string>>
  expanded: Set<string>
  setExpanded: Dispatch<SetStateAction<Set<string>>>
  getCount: (catKey: string, optValue: string) => number
  onToggle: (key: string, value: string) => void
}

export function CheckboxFilterSections({
  categories,
  getOptions,
  activeFilters,
  expanded,
  setExpanded,
  getCount,
  onToggle,
}: CheckboxFilterProps) {
  return (
    <>
      {categories.map(cat => {
        const options = getOptions(cat.key)
        if (options.length <= 1) return null
        const activeSet = activeFilters[cat.key]
        const isExpanded = expanded.has(cat.key)
        const visibleOptions = isExpanded ? options : options.slice(0, 3)
        const hasMore = options.length > 3

        return (
          <div key={cat.key} className="flex flex-col gap-1.5">
            <span className="text-[14px] tracking-[-0.03em] text-[#d5d5d5] leading-tight">
              {cat.label}
            </span>
            <div className="flex flex-col gap-[5px]">
              {visibleOptions.map(opt => {
                const isChecked = activeSet?.has(opt.value) ?? false
                const dynCount = getCount(cat.key, opt.value)
                return (
                  <div
                    key={opt.value}
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => onToggle(cat.key, opt.value)}
                  >
                    <div className="flex items-center gap-1.5">
                      {isChecked ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src="/icons/filter-checked.svg" alt="" style={{ width: 11, height: 11 }} className="shrink-0" />
                      ) : (
                        <div className="shrink-0 bg-[#1b1b1b] rounded-[1px]" style={{ width: 11, height: 11 }} />
                      )}
                      <span className="text-[13px] tracking-[-0.03em] text-white">{opt.label ?? opt.value}</span>
                    </div>
                    <span className="text-[13px] tracking-[-0.03em] text-[#d0d0d0]">{dynCount}</span>
                  </div>
                )
              })}
              {hasMore && (
                <button
                  onClick={() =>
                    setExpanded(prev => {
                      const next = new Set(prev)
                      if (next.has(cat.key)) next.delete(cat.key)
                      else next.add(cat.key)
                      return next
                    })
                  }
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
      })}
    </>
  )
}

// ─── Range Filter Inputs ────────────────────────────────────────────
type RangeFilterProps = {
  label: string
  minVal: string
  maxVal: string
  onMinChange: (v: string) => void
  onMaxChange: (v: string) => void
}

export function RangeFilter({ label, minVal, maxVal, onMinChange, onMaxChange }: RangeFilterProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[14px] tracking-[-0.03em] text-[#d5d5d5] leading-tight">{label}</span>
      <div className="flex items-center gap-2">
        {[
          { val: minVal, onChange: onMinChange, ph: 'Min' },
          { val: maxVal, onChange: onMaxChange, ph: 'Max' },
        ].map(({ val, onChange, ph }) => (
          <div
            key={ph}
            className="flex items-center flex-1 min-w-0 h-[28px] border border-[#262626] rounded-[4px] bg-[#0a0a0a] overflow-hidden"
          >
            <input
              type="number"
              placeholder={ph}
              value={val}
              onChange={e => onChange(e.target.value)}
              className="w-full h-full px-2 text-[13px] tracking-[-0.03em] text-white bg-transparent outline-none placeholder:text-[#888] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[12px] text-[#999] pr-2 shrink-0">%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Delete All Filters Button ──────────────────────────────────────
type DeleteFiltersButtonProps = {
  onClick: () => void
}

export function DeleteFiltersButton({ onClick }: DeleteFiltersButtonProps) {
  return (
    <div className="flex flex-col shrink-0 border-t border-[#262626]">
      <button
        onClick={onClick}
        className="flex items-center justify-center gap-1.5 mx-2 my-2 py-1.5 rounded-[3px] bg-[#111111] text-[13px] tracking-[-0.03em] text-[#F38686] hover:bg-[#1a0e0e] transition-colors cursor-pointer"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/filter-trash-del.svg" alt="" style={{ width: 11, height: 11 }} />
        Delete All Filters
      </button>
    </div>
  )
}
