"use client"

import * as React from "react"
import { ResponsiveContainer, Tooltip } from "recharts"

// ── Chart config type ─────────────────────────────────────────────
export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    color?: string
    icon?: React.ComponentType
  }
>

// ── Context ───────────────────────────────────────────────────────
type ChartContextValue = { config: ChartConfig }
const ChartContext = React.createContext<ChartContextValue | null>(null)

function useChart() {
  const ctx = React.useContext(ChartContext)
  if (!ctx) throw new Error("useChart must be used within a <ChartContainer />")
  return ctx
}

// ── ChartContainer ────────────────────────────────────────────────
export interface ChartContainerProps extends React.ComponentProps<"div"> {
  config: ChartConfig
  children: React.ComponentProps<typeof ResponsiveContainer>["children"]
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ id, className, children, config, ...props }, ref) => {
    const chartId = React.useId()
    const uniqueId = id ?? chartId

    /* Build CSS custom-properties from config */
    const cssVars = React.useMemo(() => {
      const vars: Record<string, string> = {}
      for (const [key, value] of Object.entries(config)) {
        if (value.color) {
          vars[`--color-${key}`] = value.color
        }
      }
      return vars
    }, [config])

    return (
      <ChartContext.Provider value={{ config }}>
        <div
          ref={ref}
          data-chart={uniqueId}
          className={`flex justify-center text-xs [&_.recharts-cartesian-axis_tick_text]:fill-[#888] [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-[#333]/20 [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-[#888]/10 [&_.recharts-reference-line_line[stroke='#ccc']]:stroke-[#333]/30 ${className ?? ""}`}
          style={cssVars as React.CSSProperties}
          {...props}
        >
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      </ChartContext.Provider>
    )
  },
)
ChartContainer.displayName = "ChartContainer"

// ── ChartTooltip ──────────────────────────────────────────────────
const ChartTooltip = Tooltip

// ── ChartTooltipContent ───────────────────────────────────────────
interface ChartTooltipContentProps {
  active?: boolean
  payload?: Array<{
    name?: string
    value?: number | string
    dataKey?: string | number
    payload?: Record<string, unknown>
    color?: string
    fill?: string
  }>
  label?: string
  hideLabel?: boolean
  hideIndicator?: boolean
  indicator?: "line" | "dot" | "dashed"
  nameKey?: string
  labelKey?: string
  labelFormatter?: (value: string, payload: ChartTooltipContentProps["payload"]) => React.ReactNode
  className?: string
}

const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  (
    {
      active,
      payload,
      label,
      hideLabel = false,
      hideIndicator = false,
      indicator = "dot",
      nameKey,
      labelKey,
      labelFormatter,
      className,
    },
    ref,
  ) => {
    const { config } = useChart()

    if (!active || !payload?.length) return null

    const tooltipLabel = hideLabel
      ? null
      : labelFormatter
        ? labelFormatter(label ?? "", payload)
        : labelKey
          ? config[labelKey as string]?.label ?? label
          : label

    return (
      <div
        ref={ref}
        className={`rounded-lg border border-[#333] bg-[#1a1a1a] px-2.5 py-1.5 text-xs shadow-xl ${className ?? ""}`}
      >
        {tooltipLabel && (
          <div className="mb-1 font-medium text-white">{tooltipLabel}</div>
        )}
        <div className="flex flex-col gap-1">
          {payload.map((item, i) => {
            const key = nameKey
              ? String(item.payload?.[nameKey] ?? item.name)
              : String(item.dataKey ?? item.name)
            const itemConfig = config[key] ?? {}
            const indicatorColor =
              item.payload?.fill ??
              item.fill ??
              item.color ??
              (itemConfig as { color?: string }).color

            return (
              <div key={i} className="flex items-center gap-2">
                {!hideIndicator && (
                  <div
                    className={`shrink-0 rounded-[2px] ${
                      indicator === "line"
                        ? "w-2.5 h-[2px]"
                        : indicator === "dashed"
                          ? "w-2.5 h-[2px] border-t border-dashed"
                          : "h-2.5 w-2.5"
                    }`}
                    style={{ backgroundColor: indicator !== "dashed" ? (indicatorColor as string) : undefined, borderColor: indicator === "dashed" ? (indicatorColor as string) : undefined }}
                  />
                )}
                <span className="text-[#aaa]">
                  {itemConfig.label ?? item.name ?? key}
                </span>
                <span className="ml-auto font-mono font-medium text-white">
                  {typeof item.value === "number"
                    ? item.value.toLocaleString()
                    : item.value}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  },
)
ChartTooltipContent.displayName = "ChartTooltipContent"

export { ChartContainer, ChartTooltip, ChartTooltipContent, useChart }
