import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { TZDate } from "react-day-picker"
import { useTranslation } from "react-i18next"

import { CalendarBreakCard } from "~/components/calendar/calendar-break"
import { CalendarAppointmentCard } from "~/components/calendar/calendar-appointment"
import { CalendarBookingDragOverlay } from "~/components/calendar/calendar-booking-drag-overlay"
import { useCalendarBookingPreview } from "~/components/calendar/calendar-booking-preview"
import { CalendarBookingReturnAnimation } from "~/components/calendar/calendar-booking-return-animation"
import { CalendarDragLane } from "~/components/calendar/calendar-drag-selection"
import type { CalendarTimelineProps } from "~/components/calendar/calendar-timeline"
import { useCalendarBookingDrag } from "~/components/calendar/use-calendar-booking-drag"
import { useCalendarBookingReveal } from "~/components/calendar/use-calendar-booking-reveal"
import { Badge } from "~/components/ui/badge"
import { Spinner } from "~/components/ui/spinner"
import { UserAvatar } from "~/components/user-avatar"
import { ScrollArea } from "~/components/ui/scroll-area"
import { calendarDateToValue } from "~/lib/calendar/date"
import { isCalendarCurrentTimeVisible, subscribeCalendarClock } from "~/lib/calendar/clock"
import { getCalendarTimeScrollLeft } from "~/lib/calendar/scroll"
import { attachCalendarWheelScroll } from "~/lib/calendar/wheel-scroll"
import { calendarIntervalMinutes, calendarMinDurationMinutes } from "~/lib/calendar/time-step"
import { sortCalendarMembers } from "~/lib/calendar/schedule"
import { calendarTimelinePadding, getCalendarTimelineLayout } from "~/lib/calendar/timeline-layout"
import { formatDateTime } from "~/lib/format-preference"
import { cn } from "~/lib/utils"

const empty: never[] = []
const horizontalFade = "linear-gradient(to right, transparent var(--calendar-scroll-left, 0px), #000 calc(var(--calendar-scroll-left, 0px) + min(1.5rem, var(--calendar-scroll-left, 0px))), #000 calc(var(--calendar-scroll-left, 0px) + var(--calendar-time-viewport-width, 100%) - min(1.5rem, var(--calendar-scroll-right, 0px))), transparent calc(var(--calendar-scroll-left, 0px) + var(--calendar-time-viewport-width, 100%)))"
const verticalFade = "linear-gradient(to bottom, transparent var(--calendar-scroll-top, 0px), #000 calc(var(--calendar-scroll-top, 0px) + min(1.5rem, var(--calendar-scroll-top, 0px))), #000 calc(var(--calendar-scroll-top, 0px) + var(--calendar-member-viewport-height, 100%) - min(1.5rem, var(--calendar-scroll-bottom, 0px))), transparent calc(var(--calendar-scroll-top, 0px) + var(--calendar-member-viewport-height, 100%)))"

export function CalendarMemberRows({ initialNow, focusedAppointmentId, days, members, bookingMembers, startMinute, endMinute, timeZone, formatPreference, appointments = empty, conflictAppointments = appointments, unavailableDays = empty, unavailableTimes = empty, breaks = empty, allowSimultaneousBookings = false, onMoveBooking, onSelectRange, onSelectRangeStart, onSelectRangeUpdate, onSelectRangeCancel, className, getBookingIssues, getDraftService, serviceDurations, intervalMinutes = calendarIntervalMinutes, minDurationMinutes = calendarMinDurationMinutes }: CalendarTimelineProps) {
  const { t, i18n } = useTranslation()
  const { preview, scrollState, returnMotion, setDragging, liveDragPreview } = useCalendarBookingPreview()
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const horizontalRef = useRef<HTMLDivElement>(null)
  const verticalRef = useRef<HTMLDivElement>(null)
  const scrollBounds = useRef({ maxLeft: 0, maxTop: 0 })
  const initializedDate = useRef<string | null>(null)
  const [positionedDate, setPositionedDate] = useState<string | null>(null)
  const [scrollSize, setScrollSize] = useState({ width: 0, height: 0 })
  const [now, setNow] = useState(() => new Date(initialNow))
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const orderedMembers = useMemo(() => sortCalendarMembers(members), [members])
  const layout = useMemo(() => getCalendarTimelineLayout({ days: days.slice(0, 1), members: orderedMembers, appointments, conflictAppointments, unavailableDays, unavailableTimes, breaks, startMinute, endMinute, allowSimultaneousBookings, excludeDraftConflicts: Boolean(onSelectRangeStart) }), [days, orderedMembers, appointments, conflictAppointments, unavailableDays, unavailableTimes, breaks, startMinute, endMinute, allowSimultaneousBookings, onSelectRangeStart])
  const rowMinimumHeights = layout[0]?.lanes.map((lane) => Math.max(96, ...lane.appointments.map((appointment) => (appointment.columns ?? 1) * 84))) ?? []
  const rowTracks = rowMinimumHeights.map((height) => `minmax(${height}px, 1fr)`).join(" ")
  const minimumContentHeight = 44 + rowMinimumHeights.reduce((total, height) => total + height, 0)
  const zonedNow = new TZDate(now, timeZone)
  const minute = zonedNow.getHours() * 60 + zonedNow.getMinutes()
  const date = days[0] ? calendarDateToValue(days[0]) : ""
  const showCurrentTime = date === calendarDateToValue(zonedNow) && isCalendarCurrentTimeVisible(minute, startMinute, endMinute)
  const waitingForInitialPosition = positionedDate !== date
  const duration = Math.max(1, endMinute - startMinute)
  const percent = (minute: number) => (minute - startMinute) / duration * 100
  const hours = Array.from({ length: Math.max(0, Math.floor(endMinute / 60) - Math.ceil(startMinute / 60) + 1) }, (_, index) => (Math.ceil(startMinute / 60) + index) * 60)
  const formatTime = (minute: number) => formatDateTime(new Date(Date.UTC(2000, 0, 1, 0, minute)), { formatPreference, language, timeZone: "UTC", includeDate: false })
  const scrollTo = ({ left, top }: { left: number; top: number }) => {
    const viewport = viewportRef.current
    for (const element of [viewport, horizontalRef.current]) {
      if (element && element.scrollLeft !== left) element.scrollLeft = left
    }
    for (const element of [viewport, verticalRef.current]) {
      if (element && element.scrollTop !== top) element.scrollTop = top
    }
    const content = contentRef.current
    if (viewport && content) {
      const currentLeft = viewport.scrollLeft
      const currentTop = viewport.scrollTop
      const { maxLeft, maxTop } = scrollBounds.current
      content.style.setProperty("--calendar-scroll-left", `${currentLeft}px`)
      content.style.setProperty("--calendar-scroll-right", `${Math.max(0, maxLeft - currentLeft)}px`)
      content.style.setProperty("--calendar-scroll-top", `${currentTop}px`)
      content.style.setProperty("--calendar-scroll-bottom", `${Math.max(0, maxTop - currentTop)}px`)
    }
  }
  useCalendarBookingReveal(viewportRef, focusedAppointmentId, scrollTo, { left: 176, top: 44 })
  const drag = useCalendarBookingDrag({ getDraftService, serviceDurations, intervalMinutes, minDurationMinutes, getBookingIssues, liveDragPreview, horizontal: true, appointments, conflictAppointments, members: bookingMembers ?? members, unavailableTimes: [...unavailableTimes, ...unavailableDays.map((day) => ({ ...day, startMinute, endMinute }))], startMinute, endMinute, timeZone, allowSimultaneousBookings, viewportRef, scrollTo, onMove: onMoveBooking, returnMotion, onDraggingChange: setDragging })
  const hiddenIds = new Set([...drag.returningPreviews.map((item) => item.appointment.id), ...(drag.dragged ? [drag.dragged.appointment.id] : [])])

  useEffect(() => {
    let stop = subscribeCalendarClock(setNow)
    const restart = () => {
      stop()
      stop = subscribeCalendarClock(setNow)
    }
    window.addEventListener("focus", restart)
    document.addEventListener("visibilitychange", restart)
    return () => {
      stop()
      window.removeEventListener("focus", restart)
      document.removeEventListener("visibilitychange", restart)
    }
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const elements = [viewport, horizontalRef.current, verticalRef.current].filter((element) => element !== null)
    return attachCalendarWheelScroll(viewport, elements, scrollTo)
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return
    const updateSize = () => {
      const viewportWidth = viewport.clientWidth
      const viewportHeight = viewport.clientHeight
      const contentWidth = content.clientWidth
      const scrollWidth = viewport.scrollWidth
      const scrollHeight = viewport.scrollHeight
      const width = Math.max(0, scrollWidth - 176)
      const height = Math.max(0, scrollHeight - 44)
      scrollBounds.current = { maxLeft: Math.max(0, scrollWidth - viewportWidth), maxTop: Math.max(0, scrollHeight - viewportHeight) }
      content.style.setProperty("--calendar-grid-width", `${Math.max(0, contentWidth - 176 - calendarTimelinePadding * 2)}px`)
      content.style.setProperty("--calendar-time-viewport-width", `${Math.max(0, viewportWidth - 176)}px`)
      content.style.setProperty("--calendar-member-viewport-height", `${Math.max(0, viewportHeight - 44)}px`)
      setScrollSize((current) => current.width === width && current.height === height ? current : { width, height })
      scrollTo({ left: viewport.scrollLeft, top: viewport.scrollTop })
    }
    const observer = new ResizeObserver(updateSize)
    observer.observe(viewport)
    observer.observe(content)
    updateSize()
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (viewport) scrollTo({ left: viewport.scrollLeft, top: viewport.scrollTop })
  }, [scrollSize])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !scrollState) return
    return scrollState.attach({ read: () => ({ left: viewport.scrollLeft, top: viewport.scrollTop }), restore: scrollTo })
  }, [scrollState])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const grid = viewport?.querySelector<HTMLElement>('[data-slot="calendar-grid"]')
    if (!viewport || !grid || window.matchMedia("(width < 768px)").matches) return
    const position = () => {
      if (viewport.clientWidth <= 176 || viewport.clientHeight <= 44 || !grid.clientWidth) return
      if (scrollState?.restore()) {
        initializedDate.current = date
      } else if (initializedDate.current !== date) {
        if (!preview?.preserveScroll && !focusedAppointmentId) {
          // The route's clock snapshot can predate switching to the rows layout
          const currentTime = new TZDate(Date.now(), timeZone)
          const currentMinute = currentTime.getHours() * 60 + currentTime.getMinutes()
          scrollTo({
            left: getCalendarTimeScrollLeft({ minute: currentMinute, startMinute, endMinute, gridWidth: grid.clientWidth, viewportWidth: viewport.clientWidth - 176, padding: calendarTimelinePadding }),
            top: viewport.scrollTop,
          })
        }
        initializedDate.current = date
      }
      setPositionedDate(date)
    }
    const observer = new ResizeObserver(position)
    observer.observe(viewport)
    observer.observe(grid)
    position()
    return () => observer.disconnect()
  }, [date, timeZone, startMinute, endMinute, scrollState, preview?.preserveScroll, focusedAppointmentId])

  return <section aria-busy={waitingForInitialPosition || undefined} aria-label={t("calendarGrid.day")} className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background", waitingForInitialPosition && "invisible", className)} data-layout="rows" data-presentation="desktop" data-slot="day-calendar">
    {waitingForInitialPosition ? <div className="visible absolute inset-0 z-50 flex items-center justify-center bg-background"><Spinner aria-label={t("loading")} /></div> : null}
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <ScrollArea className="min-h-0 min-w-0 flex-1" fill={true} overscrollContain={true} scrollbarClassName="hidden" viewportProps={{ ref: viewportRef, "aria-label": t("calendarGrid.times"), className: "[overflow-anchor:none]", onScroll: (event) => scrollTo({ left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop }) }}>
        <div className="relative isolate flex h-full flex-col" ref={contentRef} style={{ minWidth: 176 + duration / 60 * 360 + calendarTimelinePadding * 2, minHeight: minimumContentHeight }}>
          <div className="sticky top-0 z-40 flex h-11 shrink-0 shadow-[inset_0_-1px_0_var(--border)]" data-slot="calendar-header">
            <div aria-hidden={true} className="sticky left-0 z-50 w-44 shrink-0 border-r" />
            <div className="relative flex-1 bg-[color-mix(in_srgb,var(--muted)_20%,var(--background))] shadow-[inset_0_-1px_0_var(--border)]" data-slot="calendar-time-header" style={{ maskImage: horizontalFade }}>
              <div className="relative h-full" style={{ marginInline: calendarTimelinePadding }}>
                {hours.map((hour) => <time className={cn("absolute top-1/2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums", hour === startMinute ? "translate-x-2" : hour === endMinute ? "-translate-x-[calc(100%+8px)]" : "-translate-x-1/2")} key={hour} style={{ left: `${percent(hour)}%` }}>{formatTime(hour)}</time>)}
                {showCurrentTime ? <div aria-hidden={true} className="pointer-events-none absolute top-1/2 -bottom-px w-px -translate-x-1/2 bg-red-500" data-slot="calendar-current-time-connector" style={{ left: `${percent(minute)}%` }} /> : null}
                {showCurrentTime ? <time className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums" data-slot="calendar-current-time-label" dateTime={now.toISOString()} style={{ left: `${percent(minute)}%` }}>{formatTime(minute)}</time> : null}
              </div>
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1">
            <div className="sticky left-0 z-30 w-44 shrink-0 border-r bg-[color-mix(in_srgb,var(--muted)_20%,var(--background))]">
              <div className="grid h-full" style={{ maskImage: verticalFade, gridTemplateRows: rowTracks }}>
                {layout[0]?.lanes.map((lane, index) => <div className={cn("flex min-w-0 items-center gap-2 px-4 text-sm font-medium", index > 0 && "border-t")} data-slot="calendar-member-heading" key={lane.member.id}>
                  <UserAvatar className="size-5 shrink-0 text-[9px]" decorative={true} name={lane.member.name} src={lane.member.image} stableId={lane.member.id} />
                  <span className="truncate">{lane.member.name}</span>
                </div>)}
              </div>
            </div>
            <div className="relative min-w-0 flex-1" style={{ maskImage: `${horizontalFade}, ${verticalFade}`, maskComposite: "intersect" }}>
              <div {...drag.gridProps} className="relative grid h-full" data-slot="calendar-grid" style={{ marginInline: calendarTimelinePadding, gridTemplateRows: rowTracks }}>
                {layout[0]?.lanes.map((lane, index) => <div className={cn("relative", index > 0 && "border-t")} key={lane.member.id}>
                  <CalendarDragLane getDraftService={getDraftService} serviceDurations={serviceDurations} intervalMinutes={intervalMinutes} minDurationMinutes={minDurationMinutes} blocked={lane.blocked} day={lane.day} endMinute={endMinute} formatPreference={formatPreference} horizontal={true} member={lane.member} onDraggingChange={setDragging} onSelect={onSelectRange} onSelectCancel={onSelectRangeCancel} onSelectStart={onSelectRangeStart} onSelectUpdate={onSelectRangeUpdate} startMinute={startMinute} timeZone={timeZone}>
                    {lane.unavailableTimes.map((range, index) => {
                      const start = Math.max(startMinute, range.startMinute)
                      const end = Math.min(endMinute, range.endMinute)
                      const leftPadding = range.startMinute <= startMinute ? calendarTimelinePadding : 0
                      const rightPadding = range.endMinute >= endMinute ? calendarTimelinePadding : 0
                      return <div
                        aria-label={`${lane.member.name} · ${range.title || t("calendarGrid.unavailable")}`}
                        className="pointer-events-none absolute inset-y-0 overflow-hidden bg-foreground/2"
                        data-slot="calendar-unavailable-lane"
                        key={index}
                        role="note"
                        style={{
                          left: `calc(${percent(start)}% - ${leftPadding}px)`,
                          width: `calc(${(end - start) / duration * 100}% + ${leftPadding + rightPadding}px)`,
                          backgroundImage: "repeating-linear-gradient(135deg, transparent 0px, transparent 5px, color-mix(in srgb, var(--muted-foreground) 8%, transparent) 5px, color-mix(in srgb, var(--muted-foreground) 8%, transparent) 6px)",
                        }}
                      >
                        {end - start >= 30 ? <Badge
                          className="absolute top-1/2 left-1/2 z-40 max-w-[calc(100%-0.75rem)] -translate-x-1/2 -translate-y-1/2 border-border/50 bg-background/80 px-1.5 text-[10px] text-muted-foreground dark:bg-background/80"
                          data-slot="calendar-unavailable-badge"
                          variant="outline"
                        >{range.title || t("calendarGrid.unavailable")}</Badge> : null}
                      </div>
                    })}
                    {lane.breaks.map((period, index) => <CalendarBreakCard endMinute={endMinute} formatPreference={formatPreference} horizontal={true} key={index} period={period} startMinute={startMinute} />)}
                    {lane.appointments.map((appointment) => <CalendarAppointmentCard appointment={appointment} canDrag={Boolean(onMoveBooking && appointment.movable)} endMinute={endMinute} formatPreference={formatPreference} hidden={hiddenIds.has(appointment.id)} horizontal={true} key={appointment.id} startMinute={startMinute} />)}
                  </CalendarDragLane>
                </div>)}
                {hours.filter((hour) => hour > startMinute && hour < endMinute).map((hour) => <div aria-hidden={true} className="pointer-events-none absolute inset-y-0 border-l border-border/60" data-slot="calendar-hour-line" key={hour} style={{ left: `${percent(hour)}%` }} />)}
                {showCurrentTime ? <div aria-hidden={true} className="pointer-events-none absolute inset-y-0 z-20 w-px -translate-x-1/2 bg-red-500" data-slot="calendar-current-time" style={{ left: `${percent(minute)}%` }} /> : null}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
      <div className="flex w-[19px] shrink-0 flex-col border-l" data-slot="calendar-vertical-scroll">
        <div aria-hidden={true} className="h-11 shrink-0 border-b" />
        <ScrollArea className="min-h-0 flex-1" overscrollContain={true} scrollbarClassName="[&_[data-slot=scroll-area-thumb]]:bg-foreground/15 data-[orientation=vertical]:opacity-100 data-[orientation=vertical]:m-1 data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:hidden" viewportProps={{ ref: verticalRef, className: "[overflow-anchor:none]", "aria-label": t("calendarGrid.scrollMembers"), onScroll: (event) => scrollTo({ left: viewportRef.current?.scrollLeft ?? 0, top: event.currentTarget.scrollTop }) }}>
          <div aria-hidden={true} style={{ width: 1, height: scrollSize.height }} />
        </ScrollArea>
      </div>
    </div>
    <div className="flex h-[19px] shrink-0 border-t" data-slot="calendar-horizontal-scroll">
      <div aria-hidden={true} className="w-44 shrink-0 border-r" />
      <ScrollArea className="min-w-0 flex-1" overscrollContain={true} scrollbarClassName="[&_[data-slot=scroll-area-thumb]]:bg-foreground/15 data-[orientation=horizontal]:opacity-100 data-[orientation=horizontal]:m-1 data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:hidden" viewportProps={{ ref: horizontalRef, className: "[overflow-anchor:none]", "aria-label": t("calendarGrid.scrollTimes"), onScroll: (event) => scrollTo({ left: event.currentTarget.scrollLeft, top: viewportRef.current?.scrollTop ?? 0 }) }}>
        <div aria-hidden={true} style={{ width: scrollSize.width, height: 1 }} />
      </ScrollArea>
      <div aria-hidden={true} className="w-[19px] shrink-0 border-l" />
    </div>
    <CalendarBookingDragOverlay endMinute={endMinute} formatPreference={formatPreference} horizontal={true} startMinute={startMinute} store={drag.dragPreview} />
    {drag.returningPreviews.map(({ appointment, from }) => <CalendarBookingReturnAnimation appointment={appointment} endMinute={endMinute} formatPreference={formatPreference} from={from} horizontal={true} key={appointment.id} onComplete={() => drag.finishPreviewReturn(appointment.id)} startMinute={startMinute} viewportRef={viewportRef} />)}
  </section>
}
