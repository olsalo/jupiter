import { useLayoutEffect, useRef, type RefObject } from "react"

import { getCalendarBookingRevealScrollPosition } from "~/lib/calendar/scroll"

export function useCalendarBookingReveal(viewportRef: RefObject<HTMLDivElement | null>, appointmentId: string | undefined, scrollTo: (position: { left: number; top: number }) => void, insets = { left: 0, top: 0 }) {
  const latest = useRef({ appointmentId, scrollTo, insets })
  latest.current = { appointmentId, scrollTo, insets }
  const reveal = useRef<() => void>(() => {})

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    let previousLayout: string | null = null
    let observedCard: HTMLElement | null = null
    const observer = new ResizeObserver(() => reveal.current())
    reveal.current = () => {
      const id = latest.current.appointmentId
      const card = id ? viewport.querySelector<HTMLElement>(`[data-slot="calendar-appointment"][data-appointment-id="${CSS.escape(id)}"]:not([aria-hidden="true"])`) : null
      if (card !== observedCard) {
        if (observedCard) observer.unobserve(observedCard)
        observedCard = card
        if (card) observer.observe(card)
      }
      if (!card || !viewport.clientWidth || !viewport.clientHeight) {
        previousLayout = null
        return
      }
      const bounds = card.getBoundingClientRect()
      const visible = viewport.getBoundingClientRect()
      const { left, top } = latest.current.insets
      // Content coordinates stay unchanged during manual scrolling. Only a new
      // selection or actual layout change should request another reveal
      const layout = JSON.stringify([id, viewport.clientWidth, viewport.clientHeight,
        Math.round(bounds.left - visible.left + viewport.scrollLeft),
        Math.round(bounds.top - visible.top + viewport.scrollTop), bounds.width, bounds.height, left, top])
      if (layout === previousLayout) return
      previousLayout = layout
      const to = getCalendarBookingRevealScrollPosition(viewport, { left: bounds.left - left, top: bounds.top - top, width: bounds.width + left, height: bounds.height + top })
      if (Math.abs(to.left - viewport.scrollLeft) >= 1 || Math.abs(to.top - viewport.scrollTop) >= 1) latest.current.scrollTo(to)
    }
    observer.observe(viewport)
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild)
    // A drag temporarily hides the grid card, and loading can replace it after
    // the panel has already resized the viewport
    const mutations = new MutationObserver(() => reveal.current())
    mutations.observe(viewport, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-hidden", "data-appointment-id"] })
    return () => {
      observer.disconnect()
      mutations.disconnect()
      reveal.current = () => {}
    }
  }, [viewportRef])

  useLayoutEffect(() => { reveal.current() })
}
