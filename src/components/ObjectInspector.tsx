import { memo, useMemo } from 'react'

export type ObjectForInspector = {
  objectId: string
  objectCategory: string
  quantity: number
  unit: string
  arrivalTime: string
  transitStatus: string
  objectHealth: string
  warehouseId: string
}

type Props = {
  object: ObjectForInspector
  onClose: () => void
}

function ObjectInspector({ object: o, onClose }: Props) {
  const healthNum = parseFloat(o.objectHealth)
  const healthPos = Math.abs(healthNum) >= 30

  const details = useMemo(() => [
    { label: 'Object ID',       value: o.objectId,       colorClass: '' },
    { label: 'Object Category', value: o.objectCategory, colorClass: '' },
    { label: 'Quantity',        value: String(o.quantity),colorClass: '' },
    { label: 'Unit',            value: o.unit,           colorClass: '' },
    { label: 'Arrival Time',    value: o.arrivalTime,    colorClass: '' },
    {
      label: 'Transit Status',
      value: o.transitStatus,
      colorClass: o.transitStatus === 'In Transit'
        ? 'text-[#60a5fa]'
        : 'text-[#d0d0d0]',
    },
    {
      label: 'Object Health',
      value: o.objectHealth,
      colorClass: healthPos
        ? 'text-[#86F398]'
        : 'text-[#F38686]',
    },
    { label: 'Warehouse ID',   value: o.warehouseId,    colorClass: '' },
  ], [o, healthPos])

  return (
    <>
      {/* Sub-header piece: selected object name */}
      <div className="h-[38px] shrink-0 flex items-center justify-between px-4 border-b border-[#262626]">
        <span className="text-[13px] tracking-[-0.03em] text-white truncate">
          {o.objectCategory} &mdash; {o.objectId}
        </span>
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

        {/* Object Details */}
        <div className="flex flex-col shrink-0">
          <div className="flex h-8 items-center bg-[#111111] pl-4 shrink-0">
            <span className="text-[13px] tracking-[-0.03em] text-white">Object Details</span>
          </div>

          {/* Object illustration — mt-[3px] matches the row gap below */}
          <div className="w-full shrink-0 mt-[3px] bg-black flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/warehousing/object-illustration-light.png"
              alt="Object illustration"
              className="w-[70%] h-auto block saturate-0 invert"
            />
          </div>

          <div className="flex flex-col gap-[3px] mt-[3px]">
            {details.map(({ label, value, colorClass }) => (
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
      </div>
    </>
  )
}

export default memo(ObjectInspector)