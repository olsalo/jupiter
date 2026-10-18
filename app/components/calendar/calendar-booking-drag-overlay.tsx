import { memo, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

import { CalendarAppointmentCard } from "~/components/calendar/calendar-appointment"
import type { CalendarBookingDragPreviewStore } from "~/lib/calendar-booking-drag-preview"
import type { FormatPreference } from "~/lib/format-preference"

const DraggedAppointmentCard = memo(CalendarAppointmentCard)

export function CalendarBookingDragOverlay({ store, startMinute, endMinute, formatPreference }: {
  store: CalendarBookingDragPreviewStore
  startMinute: number
  endMinute: number
  formatPreference: FormatPreference
}) {
  const dragged = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
  if (!dragged) return null

  return createPortal(<div
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
      transition: dragged.returning && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "transform 260ms cubic-bezier(0.22, 1, 0.36, 1), width 260ms ease, height 260ms ease"
        : undefined,
    }}
  >
    <DraggedAppointmentCard appointment={dragged.appointment} dragging={!dragged.returning} endMinute={endMinute} floating={true} formatPreference={formatPreference} startMinute={startMinute} />
  </div></div>, document.body)
}
