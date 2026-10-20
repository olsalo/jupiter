import { CalendarAvailability } from "~/components/calendar/calendar-availability"

export const handle = { overlay: true }

export default function CalendarExtraAvailabilityRoute() {
  return <CalendarAvailability initialKind="extraHours" />
}
