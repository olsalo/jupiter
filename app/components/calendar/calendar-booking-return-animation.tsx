import type { CalendarAppointment, CalendarBookingReturnMotion } from "~/lib/calendar/types"
import { useLayoutEffect, useRef, type RefObject } from "react"
import { createPortal } from "react-dom"

import { CalendarAppointmentCard } from "~/components/calendar/calendar-appointment"

import { animateCalendarBookingReturn } from "~/lib/calendar/booking-return"
import type { FormatPreference } from "~/lib/format-preference"

export function CalendarBookingReturnAnimation({ appointment, from, viewportRef, startMinute, endMinute, formatPreference, horizontal = false, onComplete }: {
  appointment: CalendarAppointment
  from: CalendarBookingReturnMotion["bounds"]
  viewportRef: RefObject<HTMLDivElement | null>
  startMinute: number
  endMinute: number
  horizontal?: boolean
  formatPreference: FormatPreference
  onComplete: () => void
}) {
  const elementRef = useRef<HTMLDivElement>(null)
  const boundaryRef = useRef<HTMLDivElement>(null)
  const complete = useRef(onComplete)
  complete.current = onComplete

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const boundary = boundaryRef.current
    const element = elementRef.current
    if (!viewport || !boundary || !element) {
      complete.current()
      return
    }
    const updateBoundary = () => {
      const bounds = viewport.getBoundingClientRect()
      boundary.style.left = `${bounds.left}px`
      boundary.style.top = `${bounds.top}px`
      boundary.style.width = `${bounds.width}px`
      boundary.style.height = `${bounds.height}px`
    }
    updateBoundary()
    const bounds = viewport.getBoundingClientRect()
    element.style.transform = `translate3d(${from.left - bounds.left}px, ${from.top - bounds.top}px, 0)`
    const observer = new ResizeObserver(updateBoundary)
    observer.observe(viewport)
    window.addEventListener("scroll", updateBoundary, true)
    window.addEventListener("resize", updateBoundary)
    let animation: Animation | undefined
    // Resolve the saved card after the panel closes and calendar layout settles
    const frame = requestAnimationFrame(() => {
      const element = elementRef.current
      if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        complete.current()
        return
      }
      animation = animateCalendarBookingReturn(element, viewportRef.current, appointment, from, () => complete.current())
      if (animation) boundary.style.visibility = "visible"
    })
    return () => {
      cancelAnimationFrame(frame)
      animation?.cancel()
      observer.disconnect()
      window.removeEventListener("scroll", updateBoundary, true)
      window.removeEventListener("resize", updateBoundary)
    }
  }, [appointment.id, appointment.day, appointment.memberId, from, viewportRef])

  return createPortal(<div
    aria-hidden={true}
    className="pointer-events-none fixed z-40 overflow-hidden"
    data-slot="calendar-return-boundary"
    ref={boundaryRef}
    style={{ width: 0, height: 0, visibility: "hidden" }}
  ><div
    aria-hidden={true}
    className="pointer-events-none absolute top-0 left-0 will-change-transform"
    data-returning="true"
    data-slot="calendar-return-overlay"
    ref={elementRef}
    style={{ width: from.width, height: from.height }}
  >
    <CalendarAppointmentCard appointment={appointment} horizontal={horizontal} dragging={false} endMinute={endMinute} floating={true} formatPreference={formatPreference} startMinute={startMinute} />
  </div></div>, document.body)
}
