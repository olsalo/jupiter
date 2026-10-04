import { useEffect, useId, useMemo, useRef, useState } from "react"
import type { KeyboardEvent, PointerEvent } from "react"

import { Spinner } from "~/components/ui/spinner"
import { defaultTimeZone, formatDateTime, formatNumber } from "~/lib/format-preference"
import type { FormatPreference } from "~/lib/format-preference"
import { cn } from "~/lib/utils"

export type AreaChartDatum = {
  date: string | Date
  value: number
}

type AreaChartProps = {
  data: AreaChartDatum[]
  label: string
  valueLabel: string
  emptyLabel: string
  formatPreference?: FormatPreference
  language?: "en" | "fi"
  timeZone?: string
  showXAxis?: boolean
  className?: string
}

export default function AreaChart({
  data,
  label,
  valueLabel,
  emptyLabel,
  formatPreference = "eu",
  language = "en",
  timeZone = defaultTimeZone,
  showXAxis = true,
  className,
}: AreaChartProps) {
  const id = useId().replace(/:/g, "")
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number, height: number } | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const normalizedData = useMemo(() => data
    .map((datum) => ({ date: new Date(datum.date), value: datum.value }))
    .filter((datum) => Number.isFinite(datum.date.getTime()) && Number.isFinite(datum.value) && datum.value >= 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime()), [data])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const { width, height } = size ?? { width: 0, height: 0 }
  const margin = { top: 24, right: 18, bottom: showXAxis ? 36 : 16, left: 40 }
  const plotWidth = Math.max(1, width - margin.left - margin.right)
  const plotHeight = Math.max(1, height - margin.top - margin.bottom)
  const baseline = margin.top + plotHeight
  const maxValue = normalizedData.reduce((max, datum) => Math.max(max, datum.value), 0)
  // Integer ticks keep small response counts readable, including an all-zero series.
  const roughStep = Math.max(1, maxValue / 4)
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const tickStep = [1, 2, 5, 10].find((step) => step * magnitude >= roughStep)! * magnitude
  const yMax = Math.max(1, Math.ceil(maxValue / tickStep)) * tickStep
  const yTicks = Array.from({ length: Math.round(yMax / tickStep) + 1 }, (_, index) => index * tickStep)
  const start = normalizedData[0]?.date.getTime() ?? 0
  const end = normalizedData.at(-1)?.date.getTime() ?? start
  const points = normalizedData.map((datum) => ({
    ...datum,
    x: margin.left + (end === start ? plotWidth / 2 : (datum.date.getTime() - start) / (end - start) * plotWidth),
    y: baseline - datum.value / yMax * plotHeight,
  }))
  const line = points.map((point, index) => {
    if (index === 0) return `M${point.x},${point.y}`
    const previous = points[index - 1]
    const middleX = (previous.x + point.x) / 2
    // Horizontal control points soften the line without overshooting daily counts.
    return `C${middleX},${previous.y} ${middleX},${point.y} ${point.x},${point.y}`
  }).join(" ")
  const area = points.length > 1 ? `${line} L${points.at(-1)!.x},${baseline} L${points[0].x},${baseline} Z` : ""
  const active = activeIndex === null ? null : points[activeIndex]
  const dateLabel = (date: Date, includeYear = false) => formatDateTime(date, {
    formatPreference, language, timeZone, includeTime: false, includeYear,
  })
  const tickCount = Math.min(points.length, width < 480 ? 3 : 6)
  const xTicks = Array.from({ length: tickCount }, (_, index) => points[
    tickCount === 1 ? 0 : Math.round(index * (points.length - 1) / (tickCount - 1))
  ])

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!points.length || !event.isPrimary) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width * width
    const nearest = points.reduce((closest, point, index) =>
      Math.abs(point.x - x) < Math.abs(points[closest].x - x) ? index : closest, 0)
    setActiveIndex(nearest)
  }

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!event.isPrimary) return
    if (event.pointerType !== "mouse") {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    handlePointerMove(event)
  }

  const handlePointerEnd = (event: PointerEvent<SVGSVGElement>) => {
    if (!event.isPrimary) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (event.pointerType !== "mouse" || event.type === "pointercancel") {
      setActiveIndex(null)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!points.length) return
    if (!["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(event.key)) return
    event.preventDefault()
    if (event.key === "Escape") setActiveIndex(null)
    else if (event.key === "Home") setActiveIndex(0)
    else if (event.key === "End") setActiveIndex(points.length - 1)
    else setActiveIndex((index) => Math.max(0, Math.min(points.length - 1,
      (index ?? points.length - 1) + (event.key === "ArrowRight" ? 1 : -1))))
  }

  return (
    <div
      aria-label={label}
      aria-busy={points.length > 0 && size === null}
      aria-roledescription="chart"
      className={cn("keyboard-focusable relative h-64 w-full rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring md:h-72", className)}
      onBlur={() => setActiveIndex(null)}
      onFocus={() => setActiveIndex(points.length ? points.length - 1 : null)}
      onKeyDown={handleKeyDown}
      ref={containerRef}
      role="group"
      tabIndex={points.length && size ? 0 : undefined}
    >
      {points.length ? (
        <>
          {size ? (
            <>
              <svg
                aria-hidden={true}
                className="block size-full touch-none overflow-visible select-none text-sky-500 dark:text-sky-400"
                onPointerDown={handlePointerDown}
                onPointerCancel={handlePointerEnd}
                onPointerUp={handlePointerEnd}
                onLostPointerCapture={() => setActiveIndex(null)}
                onPointerLeave={(event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId)) setActiveIndex(null)
                }}
                onPointerMove={handlePointerMove}
                viewBox={`0 0 ${width} ${height}`}
              >
                <defs>
                  <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0.015} />
                  </linearGradient>
                </defs>
                {yTicks.map((value) => {
                  const y = baseline - value / yMax * plotHeight
                  return (
                    <g key={value}>
                      <line className="stroke-border" strokeDasharray="3 5" x1={margin.left} x2={width - margin.right} y1={y} y2={y} />
                      <text className="fill-muted-foreground text-[11px]" dominantBaseline="middle" textAnchor="end" x={margin.left - 12} y={y}>
                        {formatNumber(value, formatPreference, { notation: "compact" })}
                      </text>
                    </g>
                  )
                })}
                <path d={area} fill={`url(#${id}-fill)`} />
                <path d={line} fill="none" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round" strokeWidth={2.5} />
                {points.length === 1 ? <circle cx={points[0].x} cy={points[0].y} fill="currentColor" r={4} /> : null}
                {showXAxis ? xTicks.map((point, index) => (
                  <text className="fill-muted-foreground text-[11px]" key={index} textAnchor={index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle"} x={point.x} y={height - 8}>
                    {dateLabel(point.date)}
                  </text>
                )) : null}
                {active ? (
                  <g>
                    <line stroke="currentColor" strokeDasharray="4 4" strokeOpacity={0.35} x1={active.x} x2={active.x} y1={margin.top} y2={baseline} />
                    <circle className="stroke-card" cx={active.x} cy={active.y} fill="currentColor" r={5} strokeWidth={3} />
                  </g>
                ) : null}
              </svg>
              {active ? (
                <div
                  className="pointer-events-none absolute top-0 z-10 w-40 rounded-xl border bg-popover px-3 py-2.5 text-popover-foreground shadow-lg"
                  style={{ left: Math.max(0, Math.min(width - 160, active.x - 80)) }}
                >
                  <p className="mb-1 text-xs text-muted-foreground">{dateLabel(active.date, true)}</p>
                  <p className="flex items-center gap-2 text-sm font-semibold tabular-nums">
                    {formatNumber(active.value, formatPreference)} <span className="font-normal text-muted-foreground">{valueLabel}</span>
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <div aria-hidden={true} className="absolute inset-0 flex items-center justify-center">
              <Spinner className="size-6 text-muted-foreground" />
            </div>
          )}
          <span aria-live="polite" className="sr-only top-0">
            {active ? `${dateLabel(active.date, true)}: ${formatNumber(active.value, formatPreference)} ${valueLabel}` : ""}
          </span>
          <div className="sr-only top-0">
            <table>
              <caption>{label}</caption>
              <tbody>{points.map((point, index) => (
                <tr key={index}><th scope="row">{dateLabel(point.date, true)}</th><td>{formatNumber(point.value, formatPreference)} {valueLabel}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </>
      ) : <p className="flex h-full items-center justify-center text-sm text-muted-foreground">{emptyLabel}</p>}
    </div>
  )
}
