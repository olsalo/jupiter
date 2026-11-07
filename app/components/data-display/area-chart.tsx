import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react"
import { createPortal } from "react-dom"

import { localizationDefaults } from "~/lib/localization/defaults"
import { Spinner } from "~/components/ui/spinner"
import { formatDateTime, formatNumber } from "~/lib/localization/format-preference"
import type { FormatPreference } from "~/lib/localization/format-preference"
import { cn } from "~/lib/utils"

// Client-side history survives route remounts and resets on a full page reload.
const chartEntryData = new Map<string, string>()

export type AreaChartDatum = {
  date: string | Date
  value: number
}

type AreaChartProps = {
  data: AreaChartDatum[]
  label: string
  valueLabel: string
  emptyLabel: string
  /** CSS color shared by the line, gradient fill, and tooltip's active-point indicator. */
  color?: CSSProperties["color"]
  formatPreference?: FormatPreference
  language?: "en" | "fi"
  timeZone?: string
  showXAxis?: boolean
  showDotPattern?: boolean
  showTooltipArrow?: boolean
  /** Disable both the chart reveal and tooltip movement animations. */
  disableAnimations?: boolean
  /** Draw once per app session and on data changes, independently of tooltip movement. */
  entryAnimationOnly?: boolean
  /** Stable chart identity across route remounts, defaulting to the chart label. */
  animationKey?: string
  className?: string
}

export default function AreaChart({
  data,
  label,
  valueLabel,
  emptyLabel,
  color,
  formatPreference = "eu",
  language = "en",
  timeZone = localizationDefaults.timezone,
  showXAxis = true,
  showDotPattern = false,
  showTooltipArrow = true,
  disableAnimations = false,
  entryAnimationOnly = true,
  animationKey = label,
  className,
}: AreaChartProps) {
  const id = useId().replace(/:/g, "")
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const lineRef = useRef<SVGPathElement>(null)
  const fillRevealRef = useRef<SVGRectElement>(null)
  const plotVisibilityRef = useRef<SVGRectElement>(null)
  const pointerFocusRef = useRef(false)
  const drawAnimationRef = useRef<{ dataKey: string, geometryKey: string, startedAt: number, complete: boolean } | null>(null)
  const animatedPositionRef = useRef<{ length: number, line: string } | null>(null)
  const [animatedPoint, setAnimatedPoint] = useState<{ x: number, y: number } | null>(null)
  const [size, setSize] = useState<{ width: number, height: number } | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [isDirectPointer, setIsDirectPointer] = useState(false)
  const [revealedDataKey, setRevealedDataKey] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number, top: number, arrowLeft: number } | null>(null)
  const normalizedData = useMemo(() => data
    .map((datum) => ({ date: new Date(datum.date), value: datum.value }))
    .filter((datum) => Number.isFinite(datum.date.getTime()) && Number.isFinite(datum.value) && datum.value >= 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime()), [data])
  const dataKey = useMemo(() => JSON.stringify(normalizedData.map((datum) => [datum.date.getTime(), datum.value])), [normalizedData])

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
  const geometryKey = `${width}:${height}:${showXAxis}`
  const margin = { top: 24, right: 18, bottom: showXAxis ? 36 : 16, left: 40 }
  const plotWidth = Math.max(1, width - margin.left - margin.right)
  const plotHeight = Math.max(1, height - margin.top - margin.bottom)
  const dotPatternWidth = Math.max(1, plotWidth - 2) / Math.max(1, Math.round((plotWidth - 2) / 12))
  const dotPatternHeight = Math.max(1, plotHeight - 2) / Math.max(1, Math.round((plotHeight - 2) / 12))
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
  const active = activeIndex === null || revealedDataKey !== dataKey ? null : points[activeIndex]
  const indicator = active ? isDirectPointer ? active : animatedPoint ?? active : null

  useLayoutEffect(() => {
    const path = lineRef.current
    const reveal = fillRevealRef.current
    if (!path || !reveal) return

    const totalLength = path.getTotalLength()
    const updateReveal = (progress: number) => {
      // Rounded dash caps can remain visible at the endpoints with zero progress.
      path.style.visibility = progress > 0 ? "visible" : "hidden"
      path.style.strokeDashoffset = String(1 - progress)
      const tip = path.getPointAtLength(totalLength * progress)
      reveal.setAttribute("width", String(Math.max(0, tip.x - margin.left)))
    }

    const previous = drawAnimationRef.current
    const alreadyEntered = entryAnimationOnly && !previous && chartEntryData.get(animationKey) === dataKey

    if (disableAnimations
      || alreadyEntered
      || (previous?.dataKey === dataKey && previous.complete
        && (entryAnimationOnly || previous.geometryKey !== geometryKey))
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (entryAnimationOnly) chartEntryData.set(animationKey, dataKey)
      drawAnimationRef.current = { dataKey, geometryKey, startedAt: performance.now(), complete: true }
      updateReveal(1)
      setRevealedDataKey(dataKey)
      return
    }

    setRevealedDataKey(null)
    let frame: number | undefined
    let observer: IntersectionObserver | undefined
    const startAnimation = () => {
      observer?.disconnect()
      if (entryAnimationOnly) chartEntryData.set(animationKey, dataKey)
      // Preserve progress on resize and effect replay, restarting only for changed data.
      const startedAt = previous?.dataKey === dataKey && !previous.complete ? previous.startedAt : performance.now()
      const animation = { dataKey, geometryKey, startedAt, complete: false }
      drawAnimationRef.current = animation
      const animate = (now: number) => {
        const progress = Math.max(0, Math.min(1, (now - startedAt) / 2000))
        // Use the drawing tip's position so the fill follows the line on steep curves too.
        updateReveal(progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2)
        if (progress < 1) frame = requestAnimationFrame(animate)
        else {
          animation.complete = true
          setRevealedDataKey(dataKey)
        }
      }
      animate(performance.now())
    }

    if (previous?.dataKey === dataKey && !previous.complete) startAnimation()
    else {
      updateReveal(0)
      // Observe the plotting area so card headings and axis labels don't delay the reveal.
      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 1) startAnimation()
      }, { threshold: 1 })
      if (plotVisibilityRef.current) observer.observe(plotVisibilityRef.current)
    }
    return () => {
      observer?.disconnect()
      if (frame !== undefined) cancelAnimationFrame(frame)
    }
  }, [line, dataKey, geometryKey, disableAnimations, entryAnimationOnly, animationKey])

  useLayoutEffect(() => {
    const path = lineRef.current
    // Direct manipulation should track the finger immediately, without curve sampling or easing.
    if (!active || !path || isDirectPointer) {
      animatedPositionRef.current = null
      setAnimatedPoint(null)
      return
    }

    // Find the active point's distance along the same SVG curve we render.
    const totalLength = path.getTotalLength()
    let low = 0
    let high = totalLength
    for (let index = 0; index < 24; index++) {
      const middle = (low + high) / 2
      if (path.getPointAtLength(middle).x < active.x) low = middle
      else high = middle
    }
    const targetLength = (low + high) / 2
    const previous = animatedPositionRef.current
    const updatePoint = (length: number, finished = false) => {
      const point = finished || totalLength === 0 ? active : path.getPointAtLength(length)
      animatedPositionRef.current = { length, line }
      setAnimatedPoint({ x: point.x, y: point.y })
    }

    if (disableAnimations || !previous || previous.line !== line || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      updatePoint(targetLength, true)
      return
    }

    const startedAt = performance.now()
    let frame: number
    const animate = (now: number) => {
      // A frame's timestamp can precede a layout effect started within that frame.
      const progress = Math.max(0, Math.min(1, (now - startedAt) / 100))
      const eased = 1 - (1 - progress) ** 3
      updatePoint(previous.length + (targetLength - previous.length) * eased, progress === 1)
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [active?.x, active?.y, line, disableAnimations, isDirectPointer])

  useLayoutEffect(() => {
    if (!indicator || !width || !height) {
      setTooltipPosition(null)
      return
    }

    const updatePosition = () => {
      const bounds = svgRef.current?.getBoundingClientRect()
      if (!bounds) return
      const tooltipWidth = Math.min(160, window.innerWidth - 16)
      const pointX = bounds.left + indicator.x / width * bounds.width
      const left = Math.max(8, Math.min(window.innerWidth - tooltipWidth - 8, pointX - tooltipWidth / 2))
      setTooltipPosition({
        left,
        top: bounds.top + indicator.y / height * bounds.height - 20,
        arrowLeft: Math.max(12, Math.min(tooltipWidth - 14, pointX - left - 1)),
      })
    }

    updatePosition()
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)
    return () => {
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [indicator?.x, indicator?.y, width, height])

  const dateLabel = (date: Date, includeYear = false) => formatDateTime(date, {
    formatPreference, language, timeZone, includeTime: false, includeYear,
  })
  const tickCount = Math.min(points.length, width < 480 ? 3 : 6)
  const xTicks = Array.from({ length: tickCount }, (_, index) => points[
    tickCount === 1 ? 0 : Math.round(index * (points.length - 1) / (tickCount - 1))
  ])

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!points.length || !event.isPrimary) return
    setIsDirectPointer(event.pointerType !== "mouse")
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width * width
    const nearest = points.reduce((closest, point, index) =>
      Math.abs(point.x - x) < Math.abs(points[closest].x - x) ? index : closest, 0)
    setActiveIndex(nearest)
  }

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!event.isPrimary) return
    if (event.pointerType !== "mouse") {
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
    pointerFocusRef.current = false
    if (!points.length) return
    if (!["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(event.key)) return
    event.preventDefault()
    setIsDirectPointer(false)
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
      className={cn("relative h-64 w-full rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring md:h-72", className)}
      onBlur={() => {
        pointerFocusRef.current = false
        setActiveIndex(null)
      }}
      onFocus={() => {
        // Touch browsers can focus after pointerup has already cleared the active point.
        if (!pointerFocusRef.current) {
          setActiveIndex((index) => index ?? (points.length ? points.length - 1 : null))
        }
      }}
      onKeyDown={handleKeyDown}
      onPointerDownCapture={() => { pointerFocusRef.current = true }}
      ref={containerRef}
      role="group"
      tabIndex={points.length && size ? -1 : undefined}
    >
      {points.length ? (
        <>
          {size ? (
            <>
              <svg
                ref={svgRef}
                aria-hidden={true}
                className="block size-full touch-pan-y overflow-visible select-none text-sky-500 dark:text-sky-400"
                style={{ color }}
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
                  <clipPath id={`${id}-fill-reveal`} clipPathUnits="userSpaceOnUse">
                    <rect ref={fillRevealRef} x={margin.left} y={0} width={0} height={height} />
                  </clipPath>
                  <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0.015} />
                  </linearGradient>
                  {showDotPattern ? (
                    <pattern height={dotPatternHeight} id={`${id}-dots`} patternUnits="userSpaceOnUse" width={dotPatternWidth} x={margin.left} y={margin.top}>
                      <circle className="fill-muted-foreground" cx={1} cy={1} opacity={0.2} r={1} />
                    </pattern>
                  ) : null}
                </defs>
                <rect
                  ref={plotVisibilityRef}
                  fill="none"
                  height={plotHeight}
                  pointerEvents="none"
                  width={plotWidth}
                  x={margin.left}
                  y={margin.top}
                />
                {showDotPattern ? (
                  <rect
                    fill={`url(#${id}-dots)`}
                    height={plotHeight}
                    pointerEvents="none"
                    width={plotWidth}
                    x={margin.left}
                    y={margin.top}
                  />
                ) : null}
                {yTicks.map((value) => {
                  const y = baseline - value / yMax * plotHeight
                  return (
                    <g key={value}>
                      <text className="fill-muted-foreground text-[11px]" dominantBaseline="middle" textAnchor="end" x={margin.left - 12} y={y}>
                        {formatNumber(value, formatPreference, { notation: "compact" })}
                      </text>
                    </g>
                  )
                })}
                <path
                  clipPath={`url(#${id}-fill-reveal)`}
                  d={area}
                  fill={`url(#${id}-fill)`}
                />
                <path
                  ref={lineRef}
                  d={line}
                  fill="none"
                  pathLength={1}
                  stroke="currentColor"
                  strokeDasharray="1 2"
                  strokeDashoffset={1}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeWidth={2.5}
                  visibility="hidden"
                />
                {points.length === 1 ? <circle cx={points[0].x} cy={points[0].y} fill="currentColor" r={4} /> : null}
                {showXAxis ? xTicks.map((point, index) => (
                  <text className="fill-muted-foreground text-[11px]" key={index} textAnchor={index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle"} x={point.x} y={height - 8}>
                    {dateLabel(point.date)}
                  </text>
                )) : null}
                {indicator ? (
                  <g>
                    <line stroke="currentColor" strokeDasharray="4 4" strokeOpacity={0.35} x1={indicator.x} x2={indicator.x} y1={margin.top} y2={baseline} />
                    <circle className="stroke-muted" cx={indicator.x} cy={indicator.y} fill="none" r={6.5} strokeWidth={1} />
                    <circle className="stroke-card" cx={indicator.x} cy={indicator.y} fill="currentColor" r={5} strokeWidth={3} />
                  </g>
                ) : null}
              </svg>
              {active && tooltipPosition ? createPortal(
                <div
                  aria-hidden={true}
                  className="pointer-events-none fixed z-50 w-40 max-w-[calc(100vw-1rem)] -translate-y-full rounded-xl border border-foreground bg-foreground px-3 py-2.5 text-background shadow-lg not-dark:bg-clip-padding"
                  style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
                >
                  {showTooltipArrow ? (
                    <svg
                      aria-hidden={true}
                      className="absolute top-full -mt-px h-1.5 w-5 -translate-x-1/2 fill-foreground"
                      style={{ left: tooltipPosition.arrowLeft }}
                      viewBox="0 0 16 4"
                    >
                      <path d="M0 0H16C12.5 0 10 4 8 4S3.5 0 0 0Z" />
                    </svg>
                  ) : null}
                  <p className="mb-1 text-xs text-background/70">{dateLabel(active.date, true)}</p>
                  <p className="flex items-center gap-2 text-sm font-semibold tabular-nums">
                    {formatNumber(active.value, formatPreference)} <span className="font-normal text-background/70">{valueLabel}</span>
                  </p>
                </div>,
                document.body,
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
