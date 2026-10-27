import type { CalendarAppointment, CalendarBookingReturnMotion } from "./types.ts"

export const calendarBookingReturnDuration = 320
export const calendarBookingReturnEasing = "cubic-bezier(0.22, 1.12, 0.36, 1)"

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
  const bounds = viewport?.getBoundingClientRect()
  if (!bounds?.width || !bounds.height) {
    onComplete()
    return
  }
  const animation = element.animate([
    { transform: `translate3d(${from.left - bounds.left}px, ${from.top - bounds.top}px, 0)`, width: `${to.width}px`, height: `${from.height}px` },
    { transform: `translate3d(${to.left - bounds.left}px, ${to.top - bounds.top}px, 0)`, width: `${to.width}px`, height: `${to.height}px` },
  ], { duration: calendarBookingReturnDuration, easing: calendarBookingReturnEasing, fill: "forwards" })
  animation.onfinish = onComplete
  return animation
}
