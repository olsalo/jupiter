import type { CalendarAppointment, CalendarDragSelection, CalendarMember, CalendarUnavailableDay, CalendarUnavailableTime } from "~/lib/calendar/types"
import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react"
import { TZDate } from "react-day-picker"
import { useTranslation } from "react-i18next"

import { CalendarBookingDragOverlay } from "~/components/calendar/calendar-booking-drag-overlay"
import { CalendarBookingReturnAnimation } from "~/components/calendar/calendar-booking-return-animation"
import { useCalendarBookingReveal } from "~/components/calendar/use-calendar-booking-reveal"
import { useCalendarBookingDrag } from "~/components/calendar/use-calendar-booking-drag"
import { CalendarTimelineLane } from "~/components/calendar/calendar-timeline-lane"
import { useCalendarBookingPreview } from "~/components/calendar/calendar-booking-preview"
import { UserAvatar } from "~/components/user-avatar"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Spinner } from "~/components/ui/spinner"
import { calendarDateFromValue, calendarDateToValue } from "~/lib/calendar/date"
import { calendarTimelineHourHeight, calendarTimelinePadding, getCalendarTimelineLayout } from "~/lib/calendar/timeline-layout"
import type { CalendarBookingDragPhase } from "~/lib/calendar/booking-drag"
import { attachCalendarWheelScroll } from "~/lib/calendar/wheel-scroll"
import { calendarIntervalMinutes, calendarMinDurationMinutes } from "~/lib/calendar/time-step"
import { sortCalendarMembers } from "~/lib/calendar/schedule"
import { isCalendarCurrentTimeVisible, subscribeCalendarClock } from "~/lib/calendar/clock"
import { getCalendarBookingRevealScrollPosition, getCalendarBookingScrollPosition, getCalendarTodayScrollLeft } from "~/lib/calendar/scroll"
import { formatDateTime, type FormatPreference } from "~/lib/format-preference"
import { cn } from "~/lib/utils"

const calendarDateColumnClassName = "pr-px last:pr-0"

export type CalendarTimelineProps = {
  getDraftService?: (length: number) => CalendarAppointment["service"] | undefined
  serviceDurations?: readonly number[]
  intervalMinutes?: number
  minDurationMinutes?: number
  getBookingIssues?: (appointment: CalendarAppointment) => CalendarAppointment["availabilityIssues"]
  expandToContent?: boolean
  initialNow: number
  focusedAppointmentId?: string
  allowSimultaneousBookings?: boolean
  onMoveBooking?: (appointment: CalendarAppointment, selection: CalendarDragSelection, phase: CalendarBookingDragPhase) => void
  onSelectRange?: (selection: CalendarDragSelection) => void
  onSelectRangeStart?: () => void
  onSelectRangeUpdate?: (selection: CalendarDragSelection) => void
  onSelectRangeCancel?: () => void
  days: Date[]
  members: CalendarMember[]
  bookingMembers?: CalendarMember[]
  startMinute: number
  endMinute: number
  timeZone: string
  formatPreference: FormatPreference
  appointments?: CalendarAppointment[]
  conflictAppointments?: CalendarAppointment[]
  unavailableDays?: CalendarUnavailableDay[]
  breaks?: CalendarUnavailableTime[]
  unavailableTimes?: CalendarUnavailableTime[]
  className?: string
  viewMode?: "day" | "week"
  fullWidthTimeLine?: boolean
  trimTimeEdges?: boolean
}

const emptyAppointments: CalendarAppointment[] = []
const emptyUnavailableDays: CalendarUnavailableDay[] = []
const emptyUnavailableTimes: CalendarUnavailableTime[] = []

export function CalendarTimeline({ expandToContent = false, initialNow, focusedAppointmentId, allowSimultaneousBookings = false, onMoveBooking, onSelectRange, onSelectRangeStart, onSelectRangeUpdate, onSelectRangeCancel, days, members, bookingMembers, startMinute, endMinute, timeZone, formatPreference, appointments = emptyAppointments, conflictAppointments = appointments, unavailableDays = emptyUnavailableDays, unavailableTimes = emptyUnavailableTimes, breaks = emptyUnavailableTimes, className, viewMode = "week", fullWidthTimeLine = false, trimTimeEdges = false, getBookingIssues, getDraftService, serviceDurations, intervalMinutes = calendarIntervalMinutes, minDurationMinutes = calendarMinDurationMinutes }: CalendarTimelineProps) {
  const { t, i18n } = useTranslation()
  const { preview, scrollState, returnMotion, setDragging, liveDragPreview } = useCalendarBookingPreview()
  const isWeekView = viewMode === "week"
  const isMobileView = expandToContent && !isWeekView
  const timeGutterWidth = isMobileView ? (formatPreference === "us" ? 64 : 48) : 80
  const orderedMembers = useMemo(() => sortCalendarMembers(members), [members])
  const excludeDraftConflicts = Boolean(onSelectRangeStart)
  const timelineLayout = useMemo(() => getCalendarTimelineLayout({ days, members: orderedMembers, appointments, conflictAppointments, unavailableDays, unavailableTimes, breaks, startMinute, endMinute, allowSimultaneousBookings, excludeDraftConflicts }), [days, orderedMembers, appointments, conflictAppointments, unavailableDays, unavailableTimes, breaks, startMinute, endMinute, allowSimultaneousBookings, excludeDraftConflicts])
  const headerRef = useRef<HTMLDivElement>(null)
  const dateDividerViewportRef = useRef<HTMLDivElement>(null)
  const dateDividersRef = useRef<HTMLDivElement>(null)
  const timesRef = useRef<HTMLDivElement>(null)
  const timeGutterRef = useRef<HTMLDivElement>(null)
  const currentTimeRef = useRef<HTMLDivElement>(null)
  const currentTimeLineRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const horizontalRef = useRef<HTMLDivElement>(null)
  const verticalRef = useRef<HTMLDivElement>(null)
  const initializedRange = useRef<string | null>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [positionedRange, setPositionedRange] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date(initialNow))
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const minimumWidth = isMobileView ? 0 : days.length * Math.max(208, members.length * 160)
  const width = Math.max(viewportWidth, minimumWidth)
  const showHorizontalScroll = viewportWidth > 0 && minimumWidth > viewportWidth
  const gridHeight = Math.max(0, endMinute - startMinute) / 60 * calendarTimelineHourHeight
  const contentHeight = gridHeight + calendarTimelinePadding * 2
  const hours = Array.from({ length: Math.max(0, Math.floor(endMinute / 60) - Math.ceil(startMinute / 60) + 1) }, (_, index) => (Math.ceil(startMinute / 60) + index) * 60)
  const visibleHours = trimTimeEdges && !isMobileView ? hours.slice(1, -1) : hours
  const zonedNow = new TZDate(now, timeZone)
  const today = calendarDateToValue(zonedNow)
  const currentMinute = zonedNow.getHours() * 60 + zonedNow.getMinutes()
  const todayIndex = days.findIndex((day) => calendarDateToValue(day) === today)
  const showCurrentTime = todayIndex !== -1 && isCalendarCurrentTimeVisible(currentMinute, startMinute, endMinute)
  const currentTimeTop = calendarTimelinePadding + (currentMinute - startMinute) / 60 * calendarTimelineHourHeight
  const visibleDates = days.map(calendarDateToValue).join("/")
  const initialPositionKey = `${expandToContent ? "page" : "grid"}/${viewMode}/${visibleDates}`

  const waitingForInitialPosition = !expandToContent && positionedRange !== initialPositionKey && !preview
  const gridWidth = { width: "100%", minWidth: minimumWidth }
  const dayColumns = { ...gridWidth, gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }
  const laneColumns = { gridTemplateColumns: `repeat(${Math.max(1, members.length)}, minmax(0, 1fr))` }
  const formatTime = (minute: number) => {
    const date = new Date(Date.UTC(2026, 0, 1, 0, minute))
    return formatDateTime(date, { formatPreference, language, timeZone: "UTC", includeDate: false })
  }
  const syncHorizontal = (left: number) => {
    for (const element of [headerRef.current, contentRef.current, horizontalRef.current]) {
      if (element && element.scrollLeft !== left) element.scrollLeft = left
    }
    if (dateDividersRef.current) dateDividersRef.current.style.transform = `translateX(${-(contentRef.current?.scrollLeft ?? left)}px)`
    const header = headerRef.current
    for (const element of [header, dateDividerViewportRef.current]) {
      if (!element || !header) continue
      element.style.setProperty("--scroll-area-overflow-x-start", `${Math.max(0, header.scrollLeft)}px`)
      element.style.setProperty("--scroll-area-overflow-x-end", `${Math.max(0, header.scrollWidth - header.clientWidth - header.scrollLeft)}px`)
    }
  }
  const syncVertical = (top: number) => {
    for (const element of [contentRef.current, verticalRef.current]) {
      if (element && element.scrollTop !== top) element.scrollTop = top
    }
    if (timesRef.current) timesRef.current.style.transform = `translateY(${-top}px)`
    if (currentTimeRef.current) currentTimeRef.current.style.transform = `translateY(${-top}px)`
    if (currentTimeLineRef.current) currentTimeLineRef.current.style.transform = `translateY(${-top}px)`
    const viewport = contentRef.current
    const gutter = timeGutterRef.current
    if (viewport) {
      viewport.style.setProperty("--calendar-view-top", `${viewport.scrollTop}px`)
      viewport.style.setProperty("--calendar-view-bottom", `${viewport.scrollTop + viewport.clientHeight}px`)
    }
    if (viewport && gutter) {
      gutter.style.setProperty("--scroll-area-overflow-y-start", `${Math.max(0, viewport.scrollTop)}px`)
      gutter.style.setProperty("--scroll-area-overflow-y-end", `${Math.max(0, viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop)}px`)
    }
  }
  useCalendarBookingReveal(contentRef, focusedAppointmentId, ({ left, top }) => { syncHorizontal(left); syncVertical(top) })
  const bookingDrag = useCalendarBookingDrag({ getDraftService, serviceDurations, intervalMinutes, minDurationMinutes, getBookingIssues, liveDragPreview, appointments, conflictAppointments, startMinute, endMinute, timeZone, allowSimultaneousBookings, members: bookingMembers ?? members, viewportRef: contentRef, returnMotion, onDraggingChange: setDragging, scrollTo: ({ left, top }) => { syncHorizontal(left); syncVertical(top) }, onMove: onMoveBooking, unavailableTimes: [...unavailableTimes, ...unavailableDays.map((day) => ({ ...day, startMinute, endMinute }))] })
  const hiddenAppointmentIds = useMemo(() => new Set([
    ...(bookingDrag.dragged ? [bookingDrag.dragged.appointment.id] : []),
    ...bookingDrag.returningPreviews.map((item) => item.appointment.id),
  ]), [bookingDrag.dragged?.appointment.id, bookingDrag.returningPreviews])
  useEffect(() => {
    let stopClock = subscribeCalendarClock(setNow)
    const restartClock = () => {
      stopClock()
      stopClock = subscribeCalendarClock(setNow)
    }
    window.addEventListener("focus", restartClock)
    document.addEventListener("visibilitychange", restartClock)
    return () => {
      stopClock()
      window.removeEventListener("focus", restartClock)
      document.removeEventListener("visibilitychange", restartClock)
    }
  }, [])

  useLayoutEffect(() => {
    const viewport = contentRef.current
    if (viewport && viewport.clientWidth !== viewportWidth) setViewportWidth(viewport.clientWidth)
  })

  useLayoutEffect(() => {
    const viewport = contentRef.current
    if (!viewport) return
    const elements = [viewport, headerRef.current, horizontalRef.current, verticalRef.current].filter((element) => element !== null)
    const stopWheelScroll = expandToContent ? () => {} : attachCalendarWheelScroll(viewport, elements, ({ left, top }) => {
      syncHorizontal(left)
      syncVertical(top)
    })
    const observer = new ResizeObserver(() => {
      setViewportWidth(viewport.clientWidth)
      syncHorizontal(viewport.scrollLeft)
      syncVertical(viewport.scrollTop)
    })
    observer.observe(viewport)
    setViewportWidth(viewport.clientWidth)
    return () => {
      stopWheelScroll()
      observer.disconnect()
    }
  }, [expandToContent])

  useLayoutEffect(() => {
    syncHorizontal(contentRef.current?.scrollLeft ?? 0)
    syncVertical(contentRef.current?.scrollTop ?? 0)
  }, [width, contentHeight, showCurrentTime])

  useLayoutEffect(() => {
    const viewport = contentRef.current
    if (!viewport || !scrollState) return
    const pageViewport = expandToContent ? viewport.closest<HTMLElement>(".app-page-scroll") : null
    return scrollState.attach({
      read: () => ({ left: viewport.scrollLeft, top: pageViewport?.scrollTop ?? viewport.scrollTop }),
      restore: ({ left, top }) => {
        syncHorizontal(left)
        if (pageViewport) pageViewport.scrollTop = top
        else syncVertical(top)
      },
    })
  }, [scrollState, expandToContent])

  useLayoutEffect(() => {
    if (preview) return
    const viewport = contentRef.current
    if (!viewport) return
    // Hydration first uses the server layout before the responsive state updates
    if (expandToContent !== window.matchMedia("(width < 768px)").matches) return
    if (viewportWidth !== viewport.clientWidth) return
    const pageViewport = expandToContent ? viewport.closest<HTMLElement>(".app-page-scroll") : null
    if (expandToContent && !pageViewport) return
    // Keep the latest scroll position when closing a booking, including after grid remounts
    const restore = () => {
      if (!viewport.clientWidth || !viewport.clientHeight) return
      if (pageViewport && !pageViewport.clientHeight) return
      if (scrollState?.restore()) {
        initializedRange.current = initialPositionKey
      } else if (initializedRange.current !== initialPositionKey) {
        if (isWeekView) {
          const left = getCalendarTodayScrollLeft(visibleDates.split("/"), today, width, viewport.clientWidth)
          syncHorizontal(left ?? 0)
        }
        if (showCurrentTime && !expandToContent) syncVertical(Math.max(0, Math.min(contentHeight - viewport.clientHeight, currentTimeTop - viewport.clientHeight / 2)))
        if (showCurrentTime && pageViewport) {
          pageViewport.scrollTop = Math.max(0, Math.min(
            pageViewport.scrollHeight - pageViewport.clientHeight,
            pageViewport.scrollTop + viewport.getBoundingClientRect().top - pageViewport.getBoundingClientRect().top + currentTimeTop - pageViewport.clientHeight / 2,
          ))
        }
        initializedRange.current = initialPositionKey
      }
      setPositionedRange(initialPositionKey)
    }
    const observer = new ResizeObserver(restore)
    observer.observe(viewport)
    if (pageViewport) observer.observe(pageViewport)
    restore()
    return () => {
      observer.disconnect()
    }
  }, [preview, scrollState, width, contentHeight, initialPositionKey, visibleDates, isWeekView, today, showCurrentTime, currentTimeTop, expandToContent, viewportWidth])

  const draft = appointments.find((appointment) => appointment.draft)
  useLayoutEffect(() => {
    if (!preview || preview.preserveScroll) return
    const viewport = contentRef.current
    const card = viewport?.querySelector<HTMLElement>('[data-draft="true"]')
    if (!viewport || !card) return
    let frame: number | null = null
    let active = true
    const stopScrolling = () => {
      active = false
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null
    }
    const centerDraft = () => {
      if (!active) return
      if (frame !== null) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = null
        if (!active || !card.isConnected || !viewport.contains(card) || !viewport.clientWidth || !viewport.clientHeight) return
        const target = card.getBoundingClientRect()
        const lane = card.parentElement?.getBoundingClientRect() ?? target
        const { left, top } = preview.appointmentId ? getCalendarBookingRevealScrollPosition(viewport, target) : getCalendarBookingScrollPosition(viewport, lane, target)
        // Native smooth scrolling is interrupted when the companion scrollbars
        // echo intermediate scroll positions back into this viewport
        const fromLeft = viewport.scrollLeft
        const fromTop = viewport.scrollTop
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          syncHorizontal(left)
          syncVertical(top)
          return
        }
        if (Math.abs(left - fromLeft) < 1 && Math.abs(top - fromTop) < 1) return
        const startedAt = performance.now()
        const animate = (now: number) => {
          frame = null
          if (!active || !card.isConnected || !viewport.contains(card)) return
          const progress = Math.min(1, (now - startedAt) / 300)
          const eased = 1 - (1 - progress) ** 3
          syncHorizontal(fromLeft + (left - fromLeft) * eased)
          syncVertical(fromTop + (top - fromTop) * eased)
          if (progress < 1) frame = requestAnimationFrame(animate)
        }
        frame = requestAnimationFrame(animate)
      })
    }
    const observer = new ResizeObserver(centerDraft)
    observer.observe(viewport)
    observer.observe(card)
    if (card.parentElement) observer.observe(card.parentElement)
    viewport.addEventListener("wheel", stopScrolling, { passive: true })
    viewport.addEventListener("pointerdown", stopScrolling)
    viewport.addEventListener("keydown", stopScrolling)
    centerDraft()
    return () => {
      stopScrolling()
      observer.disconnect()
      viewport.removeEventListener("wheel", stopScrolling)
      viewport.removeEventListener("pointerdown", stopScrolling)
      viewport.removeEventListener("keydown", stopScrolling)
    }
  }, [Boolean(preview), preview?.preserveScroll, draft?.day, draft?.memberId, draft?.startMinute, draft?.endMinute, width, contentHeight])

  return <section aria-busy={waitingForInitialPosition || undefined} aria-label={t(isWeekView ? "calendarGrid.week" : "calendarGrid.day")} className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background", waitingForInitialPosition && "invisible", expandToContent && "flex-none", isMobileView && "rounded-none border-0", !isMobileView && "[--calendar-divider:color-mix(in_srgb,var(--background)_86%,var(--foreground))]", className)} data-slot={isWeekView ? "week-calendar" : "day-calendar"} data-presentation={isMobileView ? "mobile" : "desktop"}>
    {waitingForInitialPosition ? <div className="visible absolute inset-0 z-20 flex items-center justify-center bg-background"><Spinner aria-label={t("loading")} /></div> : null}
    {!isMobileView && !isWeekView && days[0] ? <div className="flex shrink-0">
      <div aria-hidden={true} className="w-20 shrink-0 border-r" />
      <div className="min-w-0 flex-1 border-b"><CalendarDateHeading day={days[0]} formatPreference={formatPreference} relative={true} timeZone={timeZone} today={today} /></div>
      <div aria-hidden={true} className="w-[19px] shrink-0 border-l" />
    </div> : null}
    {!isMobileView ? <div className="flex shrink-0" data-slot="calendar-header">
      <div aria-hidden={true} className="w-20 shrink-0 border-r border-b" />
      <div className="min-w-0 flex-1 overflow-hidden border-b mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start,0px)))] mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end,0px)))] [--fade-size:1.5rem]" ref={headerRef}>
        <div className="grid" style={dayColumns}>
          {days.map((day) => {
            const value = calendarDateToValue(day)
            return <div className={cn("min-w-0", isWeekView && calendarDateColumnClassName, isWeekView && value === today && "bg-[color-mix(in_srgb,var(--foreground)_2%,var(--background))]")} data-today={value === today ? "true" : undefined} key={value}>
              {isWeekView ? <CalendarDateHeading day={day} formatPreference={formatPreference} relative={false} timeZone={timeZone} today={today} /> : null}
              <div className={cn("grid h-9", isWeekView && value === today ? "bg-[color-mix(in_srgb,var(--foreground)_2%,var(--background))]" : "bg-[color-mix(in_srgb,var(--muted)_20%,var(--background))]", isWeekView && "border-t")} style={laneColumns}>
                {orderedMembers.map((member) => <div className="flex min-w-0 items-center justify-center gap-1.5 border-r px-2 text-xs text-muted-foreground last:border-r-0" data-slot="calendar-member-heading" key={member.id}>
                  <UserAvatar className="size-5 shrink-0 text-[9px]" decorative={true} name={member.name} src={member.image} stableId={member.id} />
                  <span className="truncate">{member.name}</span>
                </div>)}
              </div>
            </div>
          })}
        </div>
      </div>
      <div aria-hidden={true} className="w-[19px] shrink-0 border-b border-l" />
    </div> : null}
    <div className="relative flex min-h-0 flex-1 overflow-hidden" data-slot="calendar-body" style={expandToContent ? { height: contentHeight, flex: "none" } : undefined}>
      <div className={cn("relative z-20 shrink-0", !isMobileView && "w-20 bg-[color-mix(in_srgb,var(--muted)_20%,var(--background))] before:pointer-events-none before:absolute before:inset-y-0 before:right-0 before:border-r before:border-border")} data-slot="calendar-time-gutter" style={isMobileView ? { width: timeGutterWidth } : undefined}>
        <div className="absolute inset-0 overflow-hidden mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start,0px)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end,0px)))] [--fade-size:1.5rem]" ref={timeGutterRef}>
          <div className="relative will-change-transform" ref={timesRef} style={{ height: contentHeight }}>
            {visibleHours.map((minute) => <div className={cn("absolute inset-x-0 -translate-y-1/2 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums", isMobileView ? "pr-2" : "pr-3")} key={minute} style={{ top: calendarTimelinePadding + (minute - startMinute) / 60 * calendarTimelineHourHeight }}>{formatTime(minute)}</div>)}
          </div>
        </div>
        {showCurrentTime ? <div
          className={cn("pointer-events-none absolute inset-x-0 z-30 -translate-y-1/2 text-right text-xs font-medium text-red-500 tabular-nums will-change-transform", !isWeekView && "flex h-5 items-center justify-end", isMobileView ? "pr-1" : "pr-1.5")}
          data-slot="calendar-current-time-label"
          ref={currentTimeRef}
          style={{ top: currentTimeTop }}
        >
          <time className="relative z-10 inline-flex h-5 items-center rounded-full bg-red-500 px-1 text-[11px] leading-none font-semibold whitespace-nowrap text-white tabular-nums" dateTime={`${now.toISOString().slice(0, 16)}Z`}>{formatTime(currentMinute)}</time>
        </div> : null}
      </div>
      <ScrollArea
        className="min-w-0 flex-1"
        overscrollContain={!isMobileView}
        scrollFade={!isMobileView}
        scrollbarClassName="hidden"
        viewportProps={{
          ref: contentRef,
          className: "[overflow-anchor:none]",
          "aria-label": t("calendarGrid.times"),
          onScroll: (event) => {
            syncVertical(event.currentTarget.scrollTop)
            syncHorizontal(event.currentTarget.scrollLeft)
          },
        }}
      >
        <div {...bookingDrag.gridProps} className={cn("relative", bookingDrag.dragged?.resizing && !bookingDrag.dragged.returning && "cursor-ns-resize [&_*]:cursor-ns-resize!")} data-slot="calendar-grid" style={{ ...gridWidth, height: contentHeight }}>
          <div className="absolute inset-0 grid" style={dayColumns}>
            {timelineLayout.map(({ date, lanes }) => {
              return <div className={cn("relative grid min-w-0", !isMobileView && isWeekView && calendarDateColumnClassName, !isMobileView && isWeekView && date === today && "bg-[color-mix(in_srgb,var(--foreground)_2%,var(--background))]")} data-today={date === today ? "true" : undefined} key={date} style={laneColumns}>
                {lanes.map((lane) => <CalendarTimelineLane
                  getDraftService={getDraftService}
                  serviceDurations={serviceDurations}
                  intervalMinutes={intervalMinutes}
                  minDurationMinutes={minDurationMinutes}
                  canMoveBookings={Boolean(onMoveBooking)}
                  endMinute={endMinute}
                  formatPreference={formatPreference}
                  hiddenAppointmentIds={hiddenAppointmentIds}
                  key={lane.member.id}
                  lane={lane}
                  mobile={isMobileView}
                  onDraggingChange={setDragging}
                  onSelect={onSelectRange}
                  onSelectCancel={onSelectRangeCancel}
                  onSelectStart={onSelectRangeStart}
                  onSelectUpdate={onSelectRangeUpdate}
                  startMinute={startMinute}
                  timeZone={timeZone}
                />)}
              </div>
            })}
          </div>
          {visibleHours.map((minute) => <div aria-hidden={true} className="pointer-events-none absolute inset-x-0 border-t border-border/70" data-slot="calendar-hour-line" key={minute} style={{ top: calendarTimelinePadding + (minute - startMinute) / 60 * calendarTimelineHourHeight }} />)}
          {showCurrentTime && isWeekView && !fullWidthTimeLine ? <div
            className="pointer-events-none absolute z-10 h-px -translate-y-1/2 bg-red-500"
            data-slot="calendar-current-time"
            style={{
              top: currentTimeTop,
              left: `${todayIndex / days.length * 100}%`,
              width: `${100 / days.length}%`,
            }}
          /> : null}
        </div>
      </ScrollArea>
      {showCurrentTime && (!isWeekView || fullWidthTimeLine) ? <div
        className={cn("pointer-events-none absolute z-30 h-px -translate-y-1/2 bg-red-500 will-change-transform", isMobileView ? "right-0" : "right-[19px]")}
        data-slot="calendar-current-time"
        ref={currentTimeLineRef}
        style={{ top: currentTimeTop, left: timeGutterWidth - (isMobileView ? 4 : 6) }}
      /> : null}
      {!isMobileView ? <div className="w-[19px] shrink-0 border-l" data-slot="calendar-vertical-scroll">
        <ScrollArea
          overscrollContain={true}
          scrollbarClassName="[&_[data-slot=scroll-area-thumb]]:bg-foreground/15 data-[orientation=vertical]:opacity-100 data-[orientation=vertical]:m-1 data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:hidden"
          viewportProps={{ ref: verticalRef, className: "[overflow-anchor:none]", "aria-label": t("calendarGrid.scrollTimes"), onScroll: (event) => syncVertical(event.currentTarget.scrollTop) }}
        >
          <div aria-hidden={true} style={{ width: 1, height: contentHeight }} />
        </ScrollArea>
      </div> : null}
    </div>
    {!isMobileView ? <div className={cn("h-[19px] shrink-0 border-t", showHorizontalScroll ? "flex" : "hidden")} data-slot="calendar-horizontal-scroll">
      <div aria-hidden={true} className="w-20 shrink-0 border-r" />
      <ScrollArea
        className="min-w-0 flex-1"
        overscrollContain={true}
        scrollbarClassName="[&_[data-slot=scroll-area-thumb]]:bg-foreground/15 data-[orientation=horizontal]:opacity-100 data-[orientation=horizontal]:m-1 data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:hidden"
        viewportProps={{ ref: horizontalRef, className: "[overflow-anchor:none]", "aria-label": t(isWeekView ? "calendarGrid.scrollDates" : "calendarGrid.scrollMembers"), onScroll: (event) => syncHorizontal(event.currentTarget.scrollLeft) }}
      >
        <div aria-hidden={true} style={{ width, height: 1 }} />
      </ScrollArea>
      <div aria-hidden={true} className="w-[19px] shrink-0 border-l" />
    </div> : null}
    {!isMobileView && isWeekView && days.length > 1 ? <div
      aria-hidden={true}
      className="pointer-events-none absolute top-0 right-[19px] left-20 z-20 overflow-hidden mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start,0px)))] mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end,0px)))] [--fade-size:1.5rem]"
      data-slot="calendar-date-dividers"
      ref={dateDividerViewportRef}
      style={{ bottom: showHorizontalScroll ? 19 : 0 }}
    >
      <div className="grid h-full will-change-transform" ref={dateDividersRef} style={dayColumns}>
        {days.map((day, index) => <div className="border-r border-(--calendar-divider) last:border-r-0" data-slot={index < days.length - 1 ? "calendar-date-divider" : undefined} key={calendarDateToValue(day)} />)}
      </div>
    </div> : null}
    {bookingDrag.returningPreviews.map((motion) => <CalendarBookingReturnAnimation
      appointment={motion.appointment}
      endMinute={endMinute}
      formatPreference={formatPreference}
      from={motion.from}
      key={motion.appointment.id}
      onComplete={() => bookingDrag.finishPreviewReturn(motion.appointment.id)}
      startMinute={startMinute}
      viewportRef={contentRef}
    />)}
    <CalendarBookingDragOverlay endMinute={endMinute} formatPreference={formatPreference} startMinute={startMinute} store={bookingDrag.dragPreview} />
  </section>
}

function CalendarDateHeading({ day, formatPreference, relative, timeZone, today }: {
  day: Date
  formatPreference: FormatPreference
  relative: boolean
  timeZone: string
  today: string
}) {
  const { t, i18n } = useTranslation()
  const value = calendarDateToValue(day)
  const tomorrow = calendarDateFromValue(today, timeZone)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const yesterday = calendarDateFromValue(today, timeZone)
  yesterday.setDate(yesterday.getDate() - 1)
  const relativeLabel = value === today ? t("calendarGrid.today") : value === calendarDateToValue(tomorrow) ? t("calendarGrid.tomorrow") : value === calendarDateToValue(yesterday) ? t("calendarGrid.yesterday") : null

  return <div className="flex h-11 min-w-0 items-center justify-center gap-2 px-3" data-slot="calendar-date-row">
    {!relative ? <span className="shrink-0 text-xs font-medium text-muted-foreground">{t(`calendarGrid.weekdays.${day.getDay()}`)}</span> : null}
    <time aria-current={value === today ? "date" : undefined} className={cn("min-w-0 truncate rounded-md px-2 py-1 text-sm font-semibold tabular-nums", !relative && value === today && "bg-primary text-primary-foreground")} dateTime={value}>
      {relative && relativeLabel ? relativeLabel : formatDateTime(day, { formatPreference, language: i18n.resolvedLanguage === "fi" ? "fi" : "en", timeZone, includeTime: false, includeYear: false, includeWeekday: relative })}
    </time>
  </div>
}
