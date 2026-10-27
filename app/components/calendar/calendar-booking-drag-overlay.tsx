import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react"

import { CalendarAppointmentCard } from "~/components/calendar/calendar-appointment"
import type { CalendarBookingDragPreview, CalendarBookingDragPreviewStore } from "~/lib/calendar/booking-drag-preview"
import { calendarBookingReturnDuration, calendarBookingReturnEasing } from "~/lib/calendar/booking-return"
import type { FormatPreference } from "~/lib/localization/format-preference"

// Keep lift and tilt on a child so the pointer position and drop geometry stay exact
function CalendarDragLift({ dragged, children }: { dragged: CalendarBookingDragPreview; children: ReactNode }) {
  const element = useRef<HTMLDivElement>(null)
  const latest = useRef(dragged)
  latest.current = dragged

  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0
    let lastTime = performance.now()
    let previous = latest.current
    let lastMovement = lastTime
    let targetTilt = 0
    let tilt = 0
    let tiltVelocity = 0
    let lift = 0
    let liftVelocity = 0
    const tick = (now: number) => {
      const current = latest.current
      const elapsed = Math.max(1, now - lastTime)
      const delta = current.left - previous.left
      if (delta !== 0) {
        targetTilt = Math.max(-2.5, Math.min(2.5, delta / elapsed * 2))
        lastMovement = now
      }
      if (now - lastMovement > 80) targetTilt = 0
      const raised = !media.matches && !current.returning && !current.resizing
      const targetLift = raised ? 1 : 0
      const rotation = raised ? targetTilt : 0
      // Small substeps keep the spring stable when a frame is delayed
      let remaining = Math.min(elapsed / 1000, 0.064)
      while (remaining > 0) {
        const step = Math.min(remaining, 1 / 120)
        liftVelocity += ((targetLift - lift) * 420 - liftVelocity * 32) * step
        lift += liftVelocity * step
        tiltVelocity += ((rotation - tilt) * 360 - tiltVelocity * 28) * step
        tilt += tiltVelocity * step
        remaining -= step
      }
      if (element.current) element.current.style.transform = media.matches
        ? "none"
        : `rotate(${tilt}deg) scale(${1 + lift * 0.04})`
      previous = current
      lastTime = now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return <div className="absolute inset-0 will-change-transform" data-slot="calendar-drag-lift" ref={element}>{children}</div>
}

export function CalendarBookingDragOverlay({ store, startMinute, endMinute, formatPreference, horizontal = false }: {
  horizontal?: boolean
  store: CalendarBookingDragPreviewStore
  startMinute: number
  endMinute: number
  formatPreference: FormatPreference
}) {
  const dragged = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
  if (!dragged) return null

  return <div
    aria-hidden={true}
    className="pointer-events-none fixed z-[100] overflow-hidden"
    data-slot="calendar-drag-boundary"
    style={{ left: dragged.viewport.left, top: dragged.viewport.top, width: dragged.viewport.width, height: dragged.viewport.height }}
  ><div
    aria-hidden={true}
    className="pointer-events-none absolute top-0 left-0 will-change-transform"
    data-slot="calendar-drag-overlay"
    data-returning={dragged.returning ? "true" : "false"}
    style={{
      width: dragged.width,
      height: dragged.height,
      transform: `translate3d(${dragged.left - dragged.viewport.left}px, ${dragged.top - dragged.viewport.top}px, 0)`,
      transition: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? undefined
        : dragged.returning
          ? `transform ${calendarBookingReturnDuration}ms ${calendarBookingReturnEasing}, width ${calendarBookingReturnDuration}ms ${calendarBookingReturnEasing}, height ${calendarBookingReturnDuration}ms ${calendarBookingReturnEasing}`
          : dragged.resizing ? undefined : "transform 80ms ease-out, width 80ms ease-out, height 80ms ease-out",
    }}
  >
    <CalendarDragLift dragged={dragged}>
      <CalendarAppointmentCard appointment={dragged.appointment} horizontal={horizontal} dragging={!dragged.returning} endMinute={endMinute} floating={true} formatPreference={formatPreference} startMinute={startMinute} />
    </CalendarDragLift>
  </div></div>
}
