export type BusinessForInspector = {
  businessId: string
  objectCategory: string
  region: string
  coordinates: string
  linkType: 'Supplier' | 'Customer' | null
  linkedWarehouseIds: string[]
}

type Props = {
  business: BusinessForInspector
  onClose: () => void
  showMap?: boolean
  onWarehouseClick?: (warehouseId: string) => void
}

export default function BusinessInspector({ business: b, onClose, showMap: _showMap = true, onWarehouseClick }: Props) {
  const linkTypeColor =
    b.linkType === 'Supplier'
      ? 'text-[#86F398]'
      : b.linkType === 'Customer'
      ? 'text-[#7aaaff]'
      : ''

  return (
    <>
      {/* Sub-header */}
      <div className="h-[38px] shrink-0 flex items-center justify-between px-4 border-b border-[#262626]">
        <span className="text-[13px] tracking-[-0.03em] text-white truncate">{b.objectCategory} ({b.region})</span>
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

        {/* Business Details */}
        <div className="flex flex-col shrink-0">
          <div className="flex h-8 items-center bg-[#111111] pl-4 shrink-0">
            <span className="text-[13px] tracking-[-0.03em] text-white">Business Details</span>
          </div>

          {/* Business illustration — light mode image, inverted for dark mode */}
          <div
            className="relative w-full shrink-0 overflow-hidden mt-[3px] bg-[#0c0c0c]"
            style={{ aspectRatio: '3 / 2' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/warehousing/business-illustration-light.png"
              alt="Business illustration"
              className="absolute inset-0 w-full h-full object-cover invert"
            />
          </div>

          <div className="flex flex-col gap-[3px] mt-[3px]">
            {[
              { label: 'Business ID',     value: b.businessId,                    colorClass: '' },
              { label: 'Object Category', value: b.objectCategory,                colorClass: '' },
              { label: 'Region',          value: b.region,                        colorClass: '' },
              { label: 'Coordinates',     value: b.coordinates,                   colorClass: '' },
              { label: 'Link Type',       value: b.linkType ?? '—',               colorClass: linkTypeColor },
              { label: 'Linked Warehouses', value: `${b.linkedWarehouseIds.length}`, colorClass: '' },
            ].map(({ label, value, colorClass }) => (
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

        {/* Linked Warehouses table */}
        <div className="flex flex-col shrink-0">
          <div className="flex h-8 items-center bg-[#111111] pl-4 shrink-0">
            <span className="text-[13px] tracking-[-0.03em] text-white">Linked Warehouses</span>
          </div>
          <div className="flex flex-col gap-[3px] mt-[3px]">
            {b.linkedWarehouseIds.length === 0 ? (
              <div className="bg-[#0c0c0c] h-16 flex items-center justify-center px-[5px] shrink-0">
                <span className="text-[13px] text-[#d0d0d0] italic">No linked warehouses</span>
              </div>
            ) : (
              b.linkedWarehouseIds.map((whId) => (
                <button
                  key={whId}
                  onClick={() => onWarehouseClick?.(whId)}
                  className="bg-[#0c0c0c] h-7 flex items-center px-[5px] shrink-0 w-full text-left hover:bg-[#161616] transition-colors cursor-pointer"
                >
                  <div className="flex items-center px-2 h-full w-full min-w-0 gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2969FF] shrink-0" />
                    <span className="text-[13px] tracking-[-0.03em] text-[#7aaaff] truncate">{whId}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

      </div>
    </>
  )
}
