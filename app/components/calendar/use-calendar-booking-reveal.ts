import { useLayoutEffect, useRef, type RefObject } from "react"

import { getCalendarBookingRevealScrollPosition } from "~/lib/calendar/scroll"

export function useCalendarBookingReveal(viewportRef: RefObject<HTMLDivElement | null>, appointmentId: string | undefined, scrollTo: (position: { left: number; top: number }) => void, insets = { left: 0, top: 0 }) {
  const latest = useRef({ appointmentId, scrollTo, insets })
  latest.current = { appointmentId, scrollTo, insets }
  const reveal = useRef<() => void>(() => {})

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    let previousWidth = viewport.clientWidth
    reveal.current = () => {
      const id = latest.current.appointmentId
      if (!id) return
      const card = viewport.querySelector<HTMLElement>(`[data-slot="calendar-appointment"][data-appointment-id="${CSS.escape(id)}"]:not([aria-hidden="true"])`)
      if (!card) return
      const bounds = card.getBoundingClientRect()
      const { left, top } = latest.current.insets
      const to = getCalendarBookingRevealScrollPosition(viewport, { left: bounds.left - left, top: bounds.top - top, width: bounds.width + left, height: bounds.height + top })
      if (Math.abs(to.left - viewport.scrollLeft) >= 1 || Math.abs(to.top - viewport.scrollTop) >= 1) latest.current.scrollTo(to)
    }
    const observer = new ResizeObserver(() => {
      const width = viewport.clientWidth
      if (width < previousWidth) reveal.current()
      previousWidth = width
    })
    observer.observe(viewport)
    return () => {
      observer.disconnect()
      reveal.current = () => {}
    }
  }, [viewportRef])

  useLayoutEffect(() => { reveal.current() }, [appointmentId])
}
