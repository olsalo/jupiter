import { useLayoutEffect, useRef, type RefObject } from "react"
import { createPortal } from "react-dom"

import { CalendarAppointmentCard, type CalendarAppointment } from "~/components/calendar/calendar-appointment"
import type { CalendarBookingReturnMotion } from "~/components/calendar/calendar-booking-preview"
import { animateCalendarBookingReturn } from "~/lib/calendar-booking-return"
import type { FormatPreference } from "~/lib/format-preference"

export function CalendarBookingReturnAnimation({ appointment, from, viewportRef, startMinute, endMinute, formatPreference, onComplete }: {
  appointment: CalendarAppointment
  from: CalendarBookingReturnMotion["bounds"]
  viewportRef: RefObject<HTMLDivElement | null>
  startMinute: number
  endMinute: number
  formatPreference: FormatPreference
  onComplete: () => void
}) {
  const elementRef = useRef<HTMLDivElement>(null)
  const complete = useRef(onComplete)
  complete.current = onComplete

  useLayoutEffect(() => {
    let animation: Animation | undefined
    // Resolve the saved card after scroll restoration and the new booking's render
    const frame = requestAnimationFrame(() => {
      const element = elementRef.current
      if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        complete.current()
        return
      }
      animation = animateCalendarBookingReturn(element, viewportRef.current, appointment, from, () => complete.current())
    })
    return () => {
      cancelAnimationFrame(frame)
      animation?.cancel()
    }
  }, [appointment.id, appointment.day, appointment.memberId, from, viewportRef])

  return createPortal(<div
    aria-hidden={true}
    className="pointer-events-none fixed top-0 left-0 z-[100] will-change-transform"
    data-returning="true"
    data-slot="calendar-return-overlay"
    ref={elementRef}
    style={{ width: from.width, height: from.height, transform: `translate3d(${from.left}px, ${from.top}px, 0)` }}
  >
    <CalendarAppointmentCard appointment={appointment} dragging={false} endMinute={endMinute} floating={true} formatPreference={formatPreference} startMinute={startMinute} />
  </div>, document.body)
}
