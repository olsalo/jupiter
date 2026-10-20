import type { CalendarDragSelection } from "~/lib/calendar/types"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router"

import { CalendarSidePanel } from "~/components/calendar/calendar-side-panel"

import { CalendarBookingForm } from "~/components/calendar/calendar-booking-form"
import { useCalendarBookingPreview } from "~/components/calendar/calendar-booking-preview"
import { useCalendarState } from "~/components/calendar/use-calendar-state"
import { getCalendarBookingDragSelection } from "~/lib/calendar/booking-drag-selection"
import { calendarDateFromValue } from "~/lib/calendar/date"
import { formatDateTime } from "~/lib/format-preference"

export default function NewAppointmentRoute() {
  const { t, i18n } = useTranslation()
  const { dragUpdate } = useCalendarBookingPreview()

  const location = useLocation()
  const initialSelection = (location.state as { dragSelection?: CalendarDragSelection } | null)?.dragSelection
  const dragSelection = getCalendarBookingDragSelection(dragUpdate, initialSelection ? { selection: initialSelection } : undefined)
  const [selectedDay, setSelectedDay] = useState<string | null>(dragSelection?.day ?? null)
  const [selectedTime, setSelectedTime] = useState("")
  const { timeZone, formatPreference } = useCalendarState()
  const { search } = useLocation()
  const returnTo = useRef(`/calendar${search}`).current
  const title = t("routeTitles.newAppointment")

  const subtitle = selectedTime || (selectedDay ? formatDateTime(calendarDateFromValue(selectedDay, timeZone), {
    formatPreference, timeZone, language: i18n.resolvedLanguage === "fi" ? "fi" : "en", includeTime: false, includeWeekday: true,
  }) : t("bookingForm.noDaySelected"))

  return <CalendarSidePanel returnTo={returnTo} subtitle={subtitle} title={title}>
    <title>{title}</title>
    <CalendarBookingForm dragSelection={dragSelection} onSelectedDayChange={setSelectedDay} onSelectedTimeChange={setSelectedTime} returnTo={returnTo} selectedDay={selectedDay} />
  </CalendarSidePanel>
}
