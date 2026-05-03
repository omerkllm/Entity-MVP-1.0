'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchObjectsByWarehouse } from '@/lib/api/endpoints'
import type { ObjectRecord } from '@/lib/data/types'
import type { ChartConfig } from '@/components/ui/chart'

const TRANSIT_COLORS = ['#a855f7', '#c084fc', '#d8b4fe', '#7e22ce', '#9333ea'] as const

type ChartArg = {
  warehouseId: string
  totalCapacity: number
  usedCapacity: number
}

type Slice = { name: string; value: number; color: string }

/**
 * Owns the objects fetch for one warehouse and derives every chart dataset
 * the inspector renders (bar config + 2 donut configs). Pulling this out of
 * `WarehouseInspector` reduces the component to layout + map + JSX.
 */
export function useWarehouseCharts({ warehouseId, totalCapacity, usedCapacity }: ChartArg) {
  const [objects, setObjects] = useState<ObjectRecord[]>([])

  useEffect(() => {
    fetchObjectsByWarehouse(warehouseId)
      .then(res => setObjects(res.data ?? []))
      .catch(() => setObjects([]))
  }, [warehouseId])

  const { allocatedData, transitData } = useMemo(() => {
    // Non-transit objects grouped by category
    const nonTransit = objects.filter(o => o.transitStatus !== 'In Transit')
    const catTotals = new Map<string, number>()
    for (const o of nonTransit) {
      catTotals.set(o.objectCategory, (catTotals.get(o.objectCategory) ?? 0) + o.quantity)
    }
    let majorName = 'Major'
    let majorQty = 0
    for (const [cat, qty] of catTotals) {
      if (qty > majorQty) { majorName = cat; majorQty = qty }
    }
    const otherQty = nonTransit.reduce((s, o) => s + o.quantity, 0) - majorQty

    // Transit objects grouped by category, sorted by quantity desc
    const transitObjects = objects.filter(o => o.transitStatus === 'In Transit')
    const transitCatTotals = new Map<string, number>()
    for (const o of transitObjects) {
      transitCatTotals.set(o.objectCategory, (transitCatTotals.get(o.objectCategory) ?? 0) + o.quantity)
    }
    const transitTotalQty = transitObjects.reduce((s, o) => s + o.quantity, 0)

    // Free space based on all used
    const freeQty = totalCapacity - (majorQty + otherQty + transitTotalQty)
    const exceeded = freeQty < 0
    let freeColor: string
    if (exceeded) {
      freeColor = '#eab308'
    } else {
      const freePct = totalCapacity > 0 ? (freeQty / totalCapacity) * 100 : 100
      freeColor = freePct < 25 ? '#dc2626' : '#16a34a'
    }

    const allocatedData: Slice[] = [
      { name: majorName, value: majorQty, color: '#60a5fa' },
      { name: 'Other', value: otherQty, color: '#3b82f6' },
      { name: 'In Transit', value: transitTotalQty, color: '#1d4ed8' },
      { name: exceeded ? 'Exceeded' : 'Free', value: Math.abs(freeQty), color: freeColor },
    ]
    const transitData: Slice[] = Array.from(transitCatTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], idx) => ({ name, value, color: TRANSIT_COLORS[idx % TRANSIT_COLORS.length] }))

    return { allocatedData, transitData }
  }, [objects, totalCapacity])

  const allocatedDonutData = useMemo(
    () => allocatedData.filter(d => d.name !== 'Free' && d.name !== 'Exceeded' && d.value > 0),
    [allocatedData],
  )

  // Bar chart config + transformed data
  const { barChartConfig, barChartData, barActiveIndex } = useMemo(() => {
    const config: ChartConfig = { value: { label: 'Quantity' } }
    const data: { category: string; value: number; fill: string }[] = []
    let activeIdx = 0
    let maxVal = 0
    allocatedData.forEach((d, i) => {
      const key = d.name.toLowerCase().replace(/\s+/g, '-')
      config[key] = { label: d.name, color: d.color }
      data.push({ category: key, value: d.value, fill: `var(--color-${key})` })
      if (d.value > maxVal) { maxVal = d.value; activeIdx = i }
    })
    return { barChartConfig: config, barChartData: data, barActiveIndex: activeIdx }
  }, [allocatedData])

  const { allocDonutConfig, allocDonutChartData, allocDonutTotal } = useMemo(() => {
    const config: ChartConfig = { value: { label: 'Quantity' } }
    const data: { category: string; value: number; fill: string }[] = []
    let total = 0
    if (allocatedDonutData.length === 0) {
      config['empty'] = { label: 'Empty', color: '#222' }
      data.push({ category: 'empty', value: 1, fill: 'var(--color-empty)' })
    } else {
      for (const d of allocatedDonutData) {
        const key = d.name.toLowerCase().replace(/\s+/g, '-')
        config[key] = { label: d.name, color: d.color }
        data.push({ category: key, value: d.value, fill: `var(--color-${key})` })
        total += d.value
      }
    }
    return { allocDonutConfig: config, allocDonutChartData: data, allocDonutTotal: total }
  }, [allocatedDonutData])

  const { transitDonutConfig, transitDonutChartData, transitDonutTotal } = useMemo(() => {
    const config: ChartConfig = { value: { label: 'Quantity' } }
    const data: { category: string; value: number; fill: string }[] = []
    let total = 0
    for (const d of transitData) {
      const key = d.name.toLowerCase().replace(/\s+/g, '-')
      config[key] = { label: d.name, color: d.color }
      data.push({ category: key, value: d.value, fill: `var(--color-${key})` })
      total += d.value
    }
    return { transitDonutConfig: config, transitDonutChartData: data, transitDonutTotal: total }
  }, [transitData])

  // Live used capacity — sum of object quantities, falls back to stored value while loading
  const liveUsedCapacity = objects.length > 0
    ? objects.reduce((s, o) => s + o.quantity, 0)
    : usedCapacity

  return {
    allocatedData,
    transitData,
    barChartConfig, barChartData, barActiveIndex,
    allocDonutConfig, allocDonutChartData, allocDonutTotal,
    transitDonutConfig, transitDonutChartData, transitDonutTotal,
    liveUsedCapacity,
  }
}
