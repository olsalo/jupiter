import type { CalendarAppointment } from "~/components/calendar/calendar-appointment"
import type { CalendarBookingReturnMotion } from "~/components/calendar/calendar-booking-preview"

export function animateCalendarBookingReturn(
  element: HTMLElement,
  viewport: HTMLElement | null,
  appointment: Pick<CalendarAppointment, "id" | "day" | "memberId">,
  from: CalendarBookingReturnMotion["bounds"],
  onComplete: () => void,
) {
  const lane = viewport?.querySelector<HTMLElement>(`[data-slot="calendar-member-lane"][data-day="${CSS.escape(appointment.day)}"][data-member-id="${CSS.escape(appointment.memberId)}"]`)
  const target = lane?.querySelector<HTMLElement>(`[data-appointment-id="${CSS.escape(appointment.id)}"]:not([data-draft="true"])`)
  const to = target?.getBoundingClientRect()
  if (!to?.width || !to.height) {
    onComplete()
    return
  }
  const animation = element.animate([
    { transform: `translate3d(${from.left}px, ${from.top}px, 0)`, width: `${from.width}px`, height: `${from.height}px` },
    { transform: `translate3d(${to.left}px, ${to.top}px, 0)`, width: `${to.width}px`, height: `${to.height}px` },
  ], { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" })
  animation.onfinish = onComplete
  return animation
}
