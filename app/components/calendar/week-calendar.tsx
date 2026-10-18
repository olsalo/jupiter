import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { TZDate } from "react-day-picker"
import { useTranslation } from "react-i18next"

import { CalendarBookingDragOverlay } from "~/components/calendar/calendar-booking-drag-overlay"
import { CalendarBookingReturnAnimation } from "~/components/calendar/calendar-booking-return-animation"
import { useCalendarBookingReveal } from "~/components/calendar/use-calendar-booking-reveal"
import { useCalendarBookingDrag } from "~/components/calendar/use-calendar-booking-drag"
import { CalendarDragLane, type CalendarDragSelection } from "~/components/calendar/calendar-drag-selection"
import { CalendarAppointmentCard, type CalendarAppointment } from "~/components/calendar/calendar-appointment"
import { useCalendarBookingPreview } from "~/components/calendar/calendar-booking-preview"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Badge } from "~/components/ui/badge"
import { Spinner } from "~/components/ui/spinner"
import { calendarDateFromValue, calendarDateToValue } from "~/lib/calendar-date"
import { getCalendarBookingConflicts, layoutCalendarAppointments } from "~/lib/calendar-appointments"
import { sortCalendarMembers } from "~/lib/calendar-schedule"
import { getCalendarBookingScrollPosition, getCalendarTodayScrollLeft } from "~/lib/calendar-scroll"
import { formatDateTime, type FormatPreference } from "~/lib/format-preference"
import { cn } from "~/lib/utils"

export type CalendarMember = { id: string; name: string; image?: string | null }
export type CalendarUnavailableDay = { day: string; memberId: string }
export type CalendarUnavailableTime = CalendarUnavailableDay & { startMinute: number; endMinute: number }

type WeekCalendarProps = {
  focusedAppointmentId?: string
  allowSimultaneousBookings?: boolean
  onMoveBooking?: (appointment: CalendarAppointment, selection: CalendarDragSelection, phase: "start" | "drop") => void
  onSelectRange?: (selection: CalendarDragSelection) => void
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
  unavailableTimes?: CalendarUnavailableTime[]
  renderLane?: (day: Date, member: CalendarMember) => ReactNode
  className?: string
  viewMode?: "day" | "week"
  trimTimeEdges?: boolean
}

const hourHeight = 128
const verticalPadding = 8

export function WeekCalendar({ focusedAppointmentId, allowSimultaneousBookings = false, onMoveBooking, onSelectRange, days, members, bookingMembers, startMinute, endMinute, timeZone, formatPreference, appointments = [], conflictAppointments = appointments, unavailableDays = [], unavailableTimes = [], renderLane, className, viewMode = "week", trimTimeEdges = false }: WeekCalendarProps) {
  const { t, i18n } = useTranslation()
  const { preview, scrollState, returnMotion, setDragging } = useCalendarBookingPreview()
  const isWeekView = viewMode === "week"
  const orderedMembers = sortCalendarMembers(members)
  const headerRef = useRef<HTMLDivElement>(null)
  const timesRef = useRef<HTMLDivElement>(null)
  const timeGutterRef = useRef<HTMLDivElement>(null)
  const currentTimeRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const horizontalRef = useRef<HTMLDivElement>(null)
  const verticalRef = useRef<HTMLDivElement>(null)
  const initializedRange = useRef<string | null>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [initialPositionReady, setInitialPositionReady] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const width = Math.max(viewportWidth, days.length * Math.max(208, members.length * 160))
  const gridHeight = Math.max(0, endMinute - startMinute) / 60 * hourHeight
  const contentHeight = gridHeight + verticalPadding * 2
  const hours = Array.from({ length: Math.max(0, Math.floor(endMinute / 60) - Math.ceil(startMinute / 60) + 1) }, (_, index) => (Math.ceil(startMinute / 60) + index) * 60)
  const visibleHours = trimTimeEdges ? hours.slice(1, -1) : hours
  const zonedNow = new TZDate(now, timeZone)
  const today = calendarDateToValue(zonedNow)
  const currentMinute = zonedNow.getHours() * 60 + zonedNow.getMinutes()
  const todayIndex = days.findIndex((day) => calendarDateToValue(day) === today)
  const timeEdgeInset = trimTimeEdges ? 5 : 0
  const showCurrentTime = todayIndex !== -1 && currentMinute >= startMinute + timeEdgeInset && currentMinute <= endMinute - timeEdgeInset
  const currentTimeTop = verticalPadding + (currentMinute - startMinute) / 60 * hourHeight
  const visibleDates = days.map(calendarDateToValue).join("/")
  const initialPositionKey = `${viewMode}/${visibleDates}`

  const waitingForInitialPosition = !initialPositionReady && !preview && (!isWeekView || days.some((day) => calendarDateToValue(day) === today))
  const dayColumns = { width, gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }
  const laneColumns = { gridTemplateColumns: `repeat(${Math.max(1, members.length)}, minmax(0, 1fr))` }
  const formatTime = (minute: number) => {
    const date = new Date(Date.UTC(2026, 0, 1, 0, minute))
    return formatDateTime(date, { formatPreference, language, timeZone: "UTC", includeDate: false })
  }
  const syncHorizontal = (left: number) => {
    for (const element of [headerRef.current, contentRef.current, horizontalRef.current]) {
      if (element && element.scrollLeft !== left) element.scrollLeft = left
    }
    const header = headerRef.current
    if (header) {
      header.style.setProperty("--scroll-area-overflow-x-start", `${Math.max(0, header.scrollLeft)}px`)
      header.style.setProperty("--scroll-area-overflow-x-end", `${Math.max(0, header.scrollWidth - header.clientWidth - header.scrollLeft)}px`)
    }
  }
  const syncVertical = (top: number) => {
    for (const element of [contentRef.current, verticalRef.current]) {
      if (element && element.scrollTop !== top) element.scrollTop = top
    }
    if (timesRef.current) timesRef.current.style.transform = `translateY(${-top}px)`
    if (currentTimeRef.current) currentTimeRef.current.style.transform = `translateY(${-top}px)`
    const viewport = contentRef.current
    const gutter = timeGutterRef.current
    if (viewport && gutter) {
      gutter.style.setProperty("--scroll-area-overflow-y-start", `${Math.max(0, viewport.scrollTop)}px`)
      gutter.style.setProperty("--scroll-area-overflow-y-end", `${Math.max(0, viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop)}px`)
    }
  }
  useCalendarBookingReveal(contentRef, focusedAppointmentId, syncHorizontal)
  const bookingDrag = useCalendarBookingDrag({ appointments, conflictAppointments, startMinute, endMinute, timeZone, allowSimultaneousBookings, members: bookingMembers ?? members, viewportRef: contentRef, returnMotion, onDraggingChange: setDragging, scrollTo: ({ left, top }) => { syncHorizontal(left); syncVertical(top) }, onMove: onMoveBooking, unavailableTimes: [...unavailableTimes, ...unavailableDays.map((day) => ({ ...day, startMinute, endMinute }))] })
  useEffect(() => {
    const updateNow = () => setNow(new Date())
    const interval = setInterval(updateNow, 60_000)
    window.addEventListener("focus", updateNow)
    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", updateNow)
    }
  }, [])

  useLayoutEffect(() => {
    const viewport = contentRef.current
    if (!viewport) return
    let wheelAxis: "x" | "y" | null = null
    let releaseTimeout: ReturnType<typeof setTimeout> | undefined
    const onScrollEnd = () => {
      clearTimeout(releaseTimeout)
      releaseTimeout = setTimeout(() => {
        wheelAxis = null
      }, 10)
    }
    const onWheel = (event: WheelEvent) => {
      const horizontal = horizontalRef.current
      if (!horizontal || event.ctrlKey) return
      const deltaX = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX
      const deltaY = event.shiftKey ? 0 : event.deltaY
      if (!deltaX && !deltaY) return
      const axis = wheelAxis ?? (Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y")
      event.preventDefault()
      if (axis === "x") {
        const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? horizontal.clientWidth : 1
        const next = Math.max(0, Math.min(horizontal.scrollWidth - horizontal.clientWidth, horizontal.scrollLeft + deltaX * multiplier))
        if (next !== horizontal.scrollLeft) {
          clearTimeout(releaseTimeout)
          wheelAxis = axis
        }
        syncHorizontal(next)
      } else {
        const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1
        const next = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, viewport.scrollTop + deltaY * multiplier))
        if (next !== viewport.scrollTop) {
          clearTimeout(releaseTimeout)
          wheelAxis = axis
        }
        syncVertical(next)
      }
    }
    // Release the active axis 10ms after the browser reports scrolling has ended
    const elements = [viewport, headerRef.current, horizontalRef.current, verticalRef.current].filter((element) => element !== null)
    for (const element of elements) element.addEventListener("wheel", onWheel, { passive: false })
    viewport.addEventListener("scrollend", onScrollEnd)
    const observer = new ResizeObserver(() => {
      setViewportWidth(viewport.clientWidth)
      syncHorizontal(viewport.scrollLeft)
      syncVertical(viewport.scrollTop)
    })
    observer.observe(viewport)
    setViewportWidth(viewport.clientWidth)
    return () => {
      clearTimeout(releaseTimeout)
      observer.disconnect()
      for (const element of elements) element.removeEventListener("wheel", onWheel)
      viewport.removeEventListener("scrollend", onScrollEnd)
    }
  }, [])

  useLayoutEffect(() => {
    syncHorizontal(contentRef.current?.scrollLeft ?? 0)
    syncVertical(contentRef.current?.scrollTop ?? 0)
  }, [width, contentHeight, showCurrentTime])

  useLayoutEffect(() => {
    const viewport = contentRef.current
    if (!viewport || !scrollState) return
    return scrollState.attach({
      read: () => ({ left: viewport.scrollLeft, top: viewport.scrollTop }),
      restore: ({ left, top }) => {
        syncHorizontal(left)
        syncVertical(top)

      },
    })
  }, [scrollState])

  useLayoutEffect(() => {
    if (preview) return
    const viewport = contentRef.current
    if (!viewport) return
    // Restore a booking preview before applying a new range's default position
    const restore = () => {
      if (!viewport.clientWidth || !viewport.clientHeight) return
      if (scrollState?.restore()) {
        initializedRange.current = initialPositionKey
      } else if (initializedRange.current !== initialPositionKey) {
        if (isWeekView) {
          const left = getCalendarTodayScrollLeft(visibleDates.split("/"), today, width, viewport.clientWidth)
          syncHorizontal(left ?? 0)
        }
        if (showCurrentTime) syncVertical(Math.max(0, Math.min(contentHeight - viewport.clientHeight, currentTimeTop - viewport.clientHeight / 2)))
        initializedRange.current = initialPositionKey
      }
      setInitialPositionReady(true)
    }
    const observer = new ResizeObserver(restore)
    observer.observe(viewport)
    restore()
    return () => {
      observer.disconnect()
    }
  }, [preview, scrollState, width, contentHeight, initialPositionKey, visibleDates, isWeekView, today, showCurrentTime, currentTimeTop])

  const draft = appointments.find((appointment) => appointment.draft)
  useEffect(() => {
    if (preview?.preserveScroll) return
    const viewport = contentRef.current
    const card = viewport?.querySelector<HTMLElement>('[data-draft="true"]')
    if (!viewport || !card) return
    let frame: number | null = null
    const centerDraft = () => {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = null
        if (!viewport.clientWidth || !viewport.clientHeight) return
        const target = card.getBoundingClientRect()
        const lane = card.parentElement?.getBoundingClientRect() ?? target
        const { left, top } = getCalendarBookingScrollPosition(viewport, lane, target)
        // Native smooth scrolling is interrupted when the companion scrollbars
        // echo intermediate scroll positions back into this viewport
        syncHorizontal(left)
        syncVertical(top)
      })
    }
    const observer = new ResizeObserver(centerDraft)
    observer.observe(viewport)
    observer.observe(card)
    if (card.parentElement) observer.observe(card.parentElement)
    centerDraft()
    return () => {
      observer.disconnect()
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [preview?.preserveScroll, draft?.day, draft?.memberId, draft?.startMinute, draft?.endMinute, width, contentHeight])

  return <section aria-busy={waitingForInitialPosition || undefined} aria-label={t(isWeekView ? "calendarGrid.week" : "calendarGrid.day")} className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background", waitingForInitialPosition && "invisible", className)} data-slot={isWeekView ? "week-calendar" : "day-calendar"}>
    {waitingForInitialPosition ? <div className="visible absolute inset-0 z-20 flex items-center justify-center bg-background"><Spinner aria-label={t("loading")} /></div> : null}
    {!isWeekView && days[0] ? <div className="flex shrink-0 border-b">
      <div aria-hidden={true} className="w-20 shrink-0 border-r bg-muted/15" />
      <div className="min-w-0 flex-1"><CalendarDateHeading day={days[0]} formatPreference={formatPreference} relative={true} timeZone={timeZone} today={today} /></div>
      <div aria-hidden={true} className="w-5 shrink-0 border-l bg-muted/15" />
    </div> : null}
    <div className="flex shrink-0 border-b" data-slot="calendar-header">
      <div aria-hidden={true} className="w-20 shrink-0 border-r bg-muted/15" />
      <div className="min-w-0 flex-1 overflow-hidden mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start,0px)))] mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end,0px)))] [--fade-size:1.5rem]" ref={headerRef}>
        <div className="grid" style={dayColumns}>
          {days.map((day) => {
            const value = calendarDateToValue(day)
            return <div className="min-w-0 border-r last:border-r-0" key={value}>
              {isWeekView ? <CalendarDateHeading day={day} formatPreference={formatPreference} relative={false} timeZone={timeZone} today={today} /> : null}
              <div className={cn("grid h-9 bg-muted/15", isWeekView && "border-t")} style={laneColumns}>
                {orderedMembers.map((member) => <div className="flex min-w-0 items-center justify-center border-r px-2 text-xs text-muted-foreground last:border-r-0" key={member.id} title={member.name}>
                  <span className="truncate">{member.name}</span>
                </div>)}
              </div>
            </div>
          })}
        </div>
      </div>
      <div aria-hidden={true} className="w-5 shrink-0 border-l bg-muted/15" />
    </div>
    <div className="flex min-h-0 flex-1 overflow-hidden" data-slot="calendar-body">
      <div className="relative z-20 w-20 shrink-0 border-r bg-muted/15" data-slot="calendar-time-gutter">
        <div className="absolute inset-0 overflow-hidden mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start,0px)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end,0px)))] [--fade-size:1.5rem]" ref={timeGutterRef}>
          <div className="relative will-change-transform" ref={timesRef} style={{ height: contentHeight }}>
            {visibleHours.map((minute) => <div className="absolute inset-x-0 -translate-y-1/2 pr-3 text-right text-xs text-muted-foreground tabular-nums" key={minute} style={{ top: verticalPadding + (minute - startMinute) / 60 * hourHeight }}>{formatTime(minute)}</div>)}
          </div>
        </div>
        {showCurrentTime && !isWeekView ? <div
          className="pointer-events-none absolute inset-x-0 z-10 -translate-y-1/2 pr-1.5 text-right text-xs font-medium text-red-500 tabular-nums will-change-transform"
          data-slot="calendar-current-time-label"
          ref={currentTimeRef}
          style={{ top: currentTimeTop }}
        >
          <time className="relative rounded bg-background px-1 py-0.5" dateTime={`${now.toISOString().slice(0, 16)}Z`}>{formatTime(currentMinute)}</time>
          <span aria-hidden={true} className="absolute top-1/2 -right-px size-2 translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500" />
        </div> : null}
      </div>
      <ScrollArea
        className="min-w-0 flex-1"
        overscrollContain={true}
        scrollFade={true}
        scrollbarClassName="hidden"
        viewportProps={{
          ref: contentRef,
          "aria-label": t("calendarGrid.times"),
          onScroll: (event) => {
            syncVertical(event.currentTarget.scrollTop)
            syncHorizontal(event.currentTarget.scrollLeft)
          },
        }}
      >
        <div {...bookingDrag.gridProps} className="relative" data-slot="calendar-grid" style={{ width, height: contentHeight }}>
          <div className="absolute inset-0 grid" style={dayColumns}>
            {days.map((day) => <div className="grid min-w-0 border-r last:border-r-0" key={calendarDateToValue(day)} style={laneColumns}>
              {orderedMembers.map((member) => <div className="grid min-w-0 border-r border-border/50 last:border-r-0" key={member.id}>
                <CalendarDragLane onDraggingChange={setDragging} timeZone={timeZone} day={day} member={member} startMinute={startMinute} endMinute={endMinute} formatPreference={formatPreference} onSelect={onSelectRange} blocked={[
                  ...unavailableDays.filter((range) => range.day === calendarDateToValue(day) && range.memberId === member.id).map(() => ({ startMinute, endMinute })),
                  ...unavailableTimes.filter((range) => range.day === calendarDateToValue(day) && range.memberId === member.id),
                  ...getCalendarBookingConflicts(conflictAppointments, allowSimultaneousBookings).filter((appointment) => appointment.day === calendarDateToValue(day) && appointment.memberId === member.id),
                ]}>
                {[
                  ...unavailableDays.map((unavailable) => ({ ...unavailable, startMinute, endMinute })),
                  ...unavailableTimes,
                ].filter((unavailable) => unavailable.day === calendarDateToValue(day) && unavailable.memberId === member.id && unavailable.endMinute > startMinute && unavailable.startMinute < endMinute).map((unavailable, index) => <div
                  aria-label={`${member.name} · ${t("calendarGrid.unavailable")}`}
                  className="absolute inset-0 flex items-center justify-center overflow-hidden bg-muted/15 px-1.5"
                  data-slot="calendar-unavailable-lane"
                  key={index}
                  role="note"
                  style={{
                    top: `calc(${(Math.max(startMinute, unavailable.startMinute) - startMinute) / (endMinute - startMinute) * 100}% - ${unavailable.startMinute <= startMinute ? verticalPadding : 0}px)`,
                    bottom: "auto",
                    height: `calc(${(Math.min(endMinute, unavailable.endMinute) - Math.max(startMinute, unavailable.startMinute)) / (endMinute - startMinute) * 100}% + ${(unavailable.startMinute <= startMinute ? verticalPadding : 0) + (unavailable.endMinute >= endMinute ? verticalPadding : 0)}px)`,
                    backgroundImage: "repeating-linear-gradient(135deg, transparent 0px, transparent 5px, color-mix(in srgb, var(--muted-foreground) 8%, transparent) 5px, color-mix(in srgb, var(--muted-foreground) 8%, transparent) 6px)",
                  }}
                >
                  {Math.min(endMinute, unavailable.endMinute) - Math.max(startMinute, unavailable.startMinute) >= 30 ? <Badge className="max-w-full border-border bg-background/90 px-1.5 text-[10px] text-muted-foreground" variant="outline">{t("calendarGrid.unavailable")}</Badge> : null}
                </div>)}
                {layoutCalendarAppointments(appointments.filter((appointment) => appointment.day === calendarDateToValue(day) && appointment.memberId === member.id)).map((appointment) => <CalendarAppointmentCard hidden={bookingDrag.dragged?.appointment.id === appointment.id || bookingDrag.returningPreviews.some((item) => item.appointment.id === appointment.id)} canDrag={Boolean(onMoveBooking && appointment.movable)} appointment={appointment} endMinute={endMinute} formatPreference={formatPreference} key={appointment.id} startMinute={startMinute} />)}
                {renderLane?.(day, member)}
                </CalendarDragLane>
              </div>)}
            </div>)}
          </div>
          {visibleHours.map((minute) => <div aria-hidden={true} className="pointer-events-none absolute inset-x-0 border-t border-border/70" data-slot="calendar-hour-line" key={minute} style={{ top: verticalPadding + (minute - startMinute) / 60 * hourHeight }} />)}
          {showCurrentTime ? <div
            className="pointer-events-none absolute z-10 h-0.5 -translate-y-1/2 bg-red-500"
            data-slot="calendar-current-time"
            style={{
              top: currentTimeTop,
              left: `${todayIndex / days.length * 100}%`,
              width: `${100 / days.length}%`,
            }}
          >
            {isWeekView ? <>
              <time
                className="absolute top-1/2 right-full mr-1.5 -translate-y-1/2 whitespace-nowrap rounded bg-background px-1 py-0.5 text-xs font-medium text-red-500 tabular-nums"
                data-slot="calendar-current-time-label"
                dateTime={`${now.toISOString().slice(0, 16)}Z`}
              >{formatTime(currentMinute)}</time>
              <span aria-hidden={true} className="absolute top-1/2 left-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500" />
            </> : null}
          </div> : null}
        </div>
      </ScrollArea>
      <div className="w-5 shrink-0 border-l bg-muted/15" data-slot="calendar-vertical-scroll">
        <ScrollArea
          overscrollContain={true}
          scrollbarClassName="data-[orientation=vertical]:opacity-100 data-[orientation=vertical]:m-1 data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:hidden"
          viewportProps={{ ref: verticalRef, "aria-label": t("calendarGrid.scrollTimes"), onScroll: (event) => syncVertical(event.currentTarget.scrollTop) }}
        >
          <div aria-hidden={true} style={{ width: 1, height: contentHeight }} />
        </ScrollArea>
      </div>
    </div>
    <div className="flex h-5 shrink-0 border-t bg-muted/15" data-slot="calendar-horizontal-scroll">
      <div aria-hidden={true} className="w-20 shrink-0 border-r" />
      <ScrollArea
        className="min-w-0 flex-1"
        overscrollContain={true}
        scrollbarClassName="data-[orientation=horizontal]:opacity-100 data-[orientation=horizontal]:m-1 data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:hidden"
        viewportProps={{ ref: horizontalRef, "aria-label": t(isWeekView ? "calendarGrid.scrollDates" : "calendarGrid.scrollMembers"), onScroll: (event) => syncHorizontal(event.currentTarget.scrollLeft) }}
      >
        <div aria-hidden={true} style={{ width, height: 1 }} />
      </ScrollArea>
      <div aria-hidden={true} className="w-5 shrink-0 border-l" />
    </div>
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

  return <div className="flex h-14 min-w-0 items-center justify-center gap-2 px-3" data-slot="calendar-date-row">
    {!relative ? <span className="shrink-0 text-xs font-medium text-muted-foreground">{t(`calendarGrid.weekdays.${day.getDay()}`)}</span> : null}
    <time aria-current={value === today ? "date" : undefined} className={cn("min-w-0 truncate rounded-md px-2 py-1 text-sm font-semibold tabular-nums", !relative && value === today && "bg-primary text-primary-foreground")} dateTime={value}>
      {relative && relativeLabel ? relativeLabel : formatDateTime(day, { formatPreference, language: i18n.resolvedLanguage === "fi" ? "fi" : "en", timeZone, includeTime: false, includeYear: false, includeWeekday: relative })}
    </time>
  </div>
}
