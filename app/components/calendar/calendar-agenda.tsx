import { useLayoutEffect, useMemo, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { TZDate } from "react-day-picker"
import { useTranslation } from "react-i18next"
import { Link, useLocation, useMatch } from "react-router"

import { CalendarBookingIssueMarker } from "~/components/calendar/calendar-booking-issues"
import { CalendarView } from "~/components/calendar/calendar-view"
import { useCalendarBookingPreview } from "~/components/calendar/calendar-booking-preview"
import { useCalendarState } from "~/components/calendar/use-calendar-state"
import Icon from "~/components/icons"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { ScrollArea } from "~/components/ui/scroll-area"
import { CalendarLoading } from "~/components/calendar/calendar-loading"
import { UserAvatar } from "~/components/data-display/user-avatar"
import { getCalendarAppointments } from "~/lib/calendar/appointments"
import { calendarDateToValue, getCalendarBookingRange } from "~/lib/calendar/date"
import { calendarBookingsQueryOptions } from "~/lib/calendar/query-options"
import type { CalendarAppointment, CalendarMember } from "~/lib/calendar/types"
import { formatDateTime, type FormatPreference } from "~/lib/localization/format-preference"
import { useMediaQuery } from "~/lib/hooks"
import { useTRPC } from "~/lib/trpc/client"
import { cn } from "~/lib/utils"

export function CalendarAgenda() {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const state = useCalendarState()
  const { organization, staff, selectedMember, days, timeZone, formatPreference, now } = state
  const { preview } = useCalendarBookingPreview()
  const { pathname } = useLocation()
  const range = getCalendarBookingRange(state, timeZone)
  const interacting = Boolean(preview || pathname !== "/calendar")
  const bookings = useQuery({ ...trpc.appointment.list.queryOptions({ ...range, includeCancelled: false }), ...calendarBookingsQueryOptions(interacting) })
  const appointments = useMemo(() => {
    const visible = selectedMember ? bookings.data?.filter((booking) => booking.staffMember?.id === selectedMember.id) : bookings.data
    return getCalendarAppointments(visible ?? [], days, timeZone)
  }, [bookings.data, selectedMember?.id, days, timeZone])
  const queries = [organization, staff, bookings]
  const loadError = queries.some((query) => query.isError && query.data === undefined)
  const refreshError = queries.some((query) => query.isError && query.data !== undefined)
  const isFetching = queries.some((query) => query.isFetching)
  const retry = () => void Promise.all(queries.map((query) => query.refetch()))

  if (loadError) return <CalendarView list={true} alerts={<Alert variant="error">
    <AlertTitle>{t("calendarGrid.loadError")}</AlertTitle>
    <AlertDescription>{t("retryDescription")}</AlertDescription>
    <AlertAction><Button disabled={isFetching} onClick={retry} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction>
  </Alert>} />

  if (organization.data === undefined || staff.data === undefined || bookings.data === undefined) return <CalendarView list={true}><CalendarLoading /></CalendarView>

  return <CalendarView list={true} alerts={refreshError ? <Alert variant="warning">
    <AlertTitle>{t("calendarGrid.refreshError")}</AlertTitle>
    <AlertDescription>{t("calendarAgenda.staleDescription")}</AlertDescription>
    <AlertAction><Button disabled={isFetching} onClick={retry} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction>
  </Alert> : null}>
    <CalendarAgendaContent appointments={appointments} days={days} formatPreference={formatPreference} key={`${range.from.toISOString()}/${selectedMember?.id ?? "team"}`} members={staff.data} now={now} timeZone={timeZone} />
  </CalendarView>
}

type CalendarAgendaContentProps = {
  appointments: CalendarAppointment[]
  days: Date[]
  members: CalendarMember[]
  now: number
  timeZone: string
  formatPreference: FormatPreference
}

export function CalendarAgendaContent({ appointments, days, members, now, timeZone, formatPreference }: CalendarAgendaContentProps) {
  const { t, i18n } = useTranslation()
  const isMobile = useMediaQuery("max-768px")
  const { search } = useLocation()
  const editMatch = useMatch("/calendar/:appointmentId/edit")
  const viewMatch = useMatch("/calendar/:appointmentId")
  const selectedId = editMatch?.params.appointmentId ?? viewMatch?.params.appointmentId
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const today = calendarDateToValue(new TZDate(now, timeZone))
  const formatTime = (minute: number) => formatDateTime(new Date(Date.UTC(2000, 0, 1, 0, minute)), { formatPreference, language, timeZone: "UTC", includeDate: false })
  const memberMap = new Map(members.map((member) => [member.id, member]))
  const groups = useMemo(() => {
    const byDay = new Map<string, CalendarAppointment[]>()
    for (const appointment of appointments) {
      const group = byDay.get(appointment.day) ?? []
      group.push(appointment)
      byDay.set(appointment.day, group)
    }
    return days.map((date) => {
      const day = calendarDateToValue(date)
      return { date, day, bookings: (byDay.get(day) ?? []).sort((a, b) => a.startMinute - b.startMinute || a.id.localeCompare(b.id)) }
    })
  }, [appointments, days])

  const agendaRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const todayRef = useRef<HTMLElement>(null)
  const positioned = useRef<{ key: string; viewport: HTMLElement } | null>(null)
  const rangeKey = groups.map((group) => group.day).join("/")
  const hasAppointments = appointments.length > 0
  useLayoutEffect(() => {
    const agenda = agendaRef.current
    const section = todayRef.current
    const viewport = isMobile ? agenda?.closest<HTMLElement>(".app-page-scroll") : viewportRef.current
    const key = `${rangeKey}/${today}`
    if (!agenda || !section || !viewport || (positioned.current?.key === key && positioned.current.viewport === viewport)) return
    let cancelled = false
    const position = () => {
      if (cancelled || !section.isConnected || !viewport.clientHeight || (positioned.current?.key === key && positioned.current.viewport === viewport)) return
      let top = section.getBoundingClientRect().top
      // Use the final route position while its entrance animation is running.
      for (let element = section.parentElement; element && element !== viewport; element = element.parentElement) {
        const transform = getComputedStyle(element).transform
        if (transform !== "none") top -= new DOMMatrixReadOnly(transform).m42
      }
      viewport.scrollTop = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, viewport.scrollTop + top - viewport.getBoundingClientRect().top - viewport.clientTop))
      positioned.current = { key, viewport }
      observer.disconnect()
    }
    const observer = new ResizeObserver(position)
    observer.observe(viewport)
    observer.observe(agenda)
    // Let the workspace restore its scroll position before applying the default.
    queueMicrotask(position)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [isMobile, rangeKey, today, hasAppointments])

  if (appointments.length === 0) return <Empty data-slot="calendar-agenda-empty">
    <EmptyHeader>
      <EmptyMedia variant="icon"><Icon aria-hidden={true} name="calendar" /></EmptyMedia>
      <EmptyTitle>{t("calendarAgenda.emptyWeek")}</EmptyTitle>
      <EmptyDescription>{t("calendarAgenda.emptyDescription")}</EmptyDescription>
    </EmptyHeader>
  </Empty>

  const content = <>
    {groups.map(({ date, day, bookings }) => <section aria-labelledby={`agenda-${day}`} className="md:border-t md:border-(--calendar-divider) md:first:border-t-0" key={day} ref={day === today ? todayRef : undefined}>
      <h2 className="sticky top-0 z-10 flex min-h-12 items-center justify-between gap-3 rounded-xl bg-(--calendar-chrome) px-4 py-3 text-sm font-medium @min-2xl/agenda:min-h-11 @min-2xl/agenda:py-2 md:rounded-none md:border-b md:px-5" id={`agenda-${day}`}>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {day === today ? <span className="text-primary">{t("calendarGrid.today")}<span aria-hidden={true} className="ml-2 text-muted-foreground">·</span></span> : null}
          <time className="first-letter:uppercase" dateTime={day}>{formatDateTime(date, { formatPreference, language, timeZone, includeTime: false, includeYear: false, includeWeekday: true })}</time>
        </span>
        <span className="shrink-0 text-xs font-normal text-muted-foreground">{t("calendarAgenda.bookingCount", { count: bookings.length })}</span>
      </h2>
      {bookings.length === 0 ? <Empty><EmptyHeader><EmptyTitle className="font-sans text-base font-normal text-muted-foreground sm:text-sm">{t("calendarAgenda.noBookings")}</EmptyTitle></EmptyHeader></Empty> : <ul className="space-y-2 py-3 md:bg-muted/25 md:p-3 @min-2xl/agenda:space-y-0 @min-2xl/agenda:divide-y @min-2xl/agenda:divide-border/70 @min-2xl/agenda:bg-transparent @min-2xl/agenda:p-0">
        {bookings.map((appointment) => {
          const muted = appointment.status === "CANCELLED" || appointment.status === "NO_SHOW"
          const member = memberMap.get(appointment.memberId)
          return <li key={appointment.id}>
            <Link
              draggable={false}
              aria-current={selectedId === appointment.id ? "true" : undefined}
              className={cn("relative grid min-h-24 touch-manipulation grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 overflow-hidden rounded-xl px-5 py-3.5 text-sm transition-colors md:border md:bg-background md:shadow-xs duration-150 ease-out [@media(hover:hover)]:hover:bg-accent/50 [@media(hover:none)]:active:bg-accent/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none @min-2xl/agenda:min-h-18 @min-2xl/agenda:grid-cols-[9rem_minmax(0,1fr)_minmax(6rem,0.6fr)] @min-2xl/agenda:gap-x-5 @min-2xl/agenda:rounded-none @min-2xl/agenda:border-0 @min-2xl/agenda:py-3 @min-2xl/agenda:shadow-none md:px-5", muted && "text-muted-foreground", selectedId === appointment.id && "md:bg-accent/60")}
              data-appointment-id={appointment.id}
              data-slot="calendar-agenda-booking"
              data-status={appointment.status}
              preventScrollReset={true}
              to={`/calendar/${encodeURIComponent(appointment.id)}/edit${search}`}
            >
              <span aria-hidden={true} className={cn("absolute inset-y-3 left-2 w-0.5 rounded-full @min-2xl/agenda:inset-y-4", muted && "opacity-40")} style={{ backgroundColor: appointment.service.color }} />
              <span className="row-span-2 flex flex-col gap-1 self-start pt-0.5 text-sm tabular-nums @min-2xl/agenda:row-span-1 @min-2xl/agenda:flex-row @min-2xl/agenda:items-center @min-2xl/agenda:self-center @min-2xl/agenda:pt-0">
                <span className="font-semibold @min-2xl/agenda:font-medium">{formatTime(appointment.startMinute)}</span>
                <span className="sr-only @min-2xl/agenda:not-sr-only">–</span>
                <span className="text-xs text-muted-foreground @min-2xl/agenda:text-sm">{formatTime(appointment.endMinute)}</span>
              </span>
              <span className="flex min-w-0 flex-col gap-1 @min-2xl/agenda:gap-0.5">
                <span className="flex min-w-0 items-center gap-2"><span className="truncate font-semibold @min-2xl/agenda:font-medium">{appointment.customerName}</span><CalendarBookingIssueMarker issues={appointment.availabilityIssues} /></span>
                <span className="truncate text-xs text-muted-foreground">{appointment.service.name}</span>
              </span>
              <span className="col-start-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 @min-2xl/agenda:contents">
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground @min-2xl/agenda:gap-2 @min-2xl/agenda:text-sm">
                  {member ? <UserAvatar className={cn("size-5 shrink-0 text-[9px] @min-2xl/agenda:size-6 @min-2xl/agenda:text-[10px]", muted && "opacity-60")} decorative={true} name={member.name} src={member.image} stableId={member.id} /> : null}
                  <span className="truncate">{member?.name ?? t("calendarGrid.unassigned")}</span>
                </span>
              </span>
            </Link>
          </li>
        })}
      </ul>}
    </section>)}
  </>

  return <div aria-label={t("calendarAgenda.label")} className="@container/agenda flex min-h-0 min-w-0 flex-1 flex-col [--calendar-chrome:color-mix(in_srgb,var(--background)_97%,var(--foreground))] [--calendar-divider:color-mix(in_srgb,var(--foreground)_16%,transparent)]" data-slot="calendar-agenda" ref={agendaRef} role="region">
    {isMobile ? content : <ScrollArea
      className="relative min-h-0 flex-1 after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-[19px] after:border-l after:bg-(--calendar-chrome) max-md:h-auto max-md:[&>[data-slot=scroll-area-viewport]]:h-auto max-md:[&>[data-slot=scroll-area-viewport]]:overflow-visible! max-md:after:hidden"
      overscrollContain={true}
      scrollbarClassName="[&_[data-slot=scroll-area-thumb]]:bg-foreground/15 z-20 data-[orientation=vertical]:opacity-100 data-[orientation=vertical]:m-1 data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:hidden"
      viewportProps={{
        ref: viewportRef,
        "aria-label": t("calendarAgenda.label"),
        className: "md:mr-[19px] md:mask-b-from-[calc(100%-min(1.5rem,var(--scroll-area-overflow-y-end,0px)))] [overflow-anchor:none]",
      }}
    >{content}</ScrollArea>}
  </div>
}
