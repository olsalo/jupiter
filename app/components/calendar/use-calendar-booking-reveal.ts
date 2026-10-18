import { useLayoutEffect, useRef, type RefObject } from "react"

import { getCalendarBookingRevealScrollLeft } from "~/lib/calendar-scroll"

export function useCalendarBookingReveal(viewportRef: RefObject<HTMLDivElement | null>, appointmentId: string | undefined, scrollTo: (left: number) => void) {
  const latest = useRef({ appointmentId, scrollTo })
  latest.current = { appointmentId, scrollTo }
  const animation = useRef<number | null>(null)
  const pending = useRef<number | null>(null)
  const reveal = useRef<() => void>(() => {})

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    let previousWidth = viewport.clientWidth
    const cancel = () => {
      if (animation.current !== null) cancelAnimationFrame(animation.current)
      if (pending.current !== null) cancelAnimationFrame(pending.current)
      animation.current = null
      pending.current = null
    }
    reveal.current = () => {
      cancel()
      if (!latest.current.appointmentId) return
      pending.current = requestAnimationFrame(() => {
        pending.current = null
        const id = latest.current.appointmentId
        if (!id) return
        const card = viewport.querySelector<HTMLElement>(`[data-slot="calendar-appointment"][data-appointment-id="${CSS.escape(id)}"]:not([aria-hidden="true"])`)
        if (!card) return
        const from = viewport.scrollLeft
        const to = getCalendarBookingRevealScrollLeft(viewport, card.getBoundingClientRect())
        if (Math.abs(to - from) < 1) return
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          latest.current.scrollTo(to)
          return
        }
        let started: number | null = null
        const step = (time: number) => {
          started ??= time
          const progress = Math.min(1, (time - started) / 220)
          latest.current.scrollTo(from + (to - from) * (1 - (1 - progress) ** 3))
          animation.current = progress < 1 ? requestAnimationFrame(step) : null
        }
        animation.current = requestAnimationFrame(step)
      })
    }
    const observer = new ResizeObserver(() => {
      const width = viewport.clientWidth
      if (width < previousWidth) reveal.current()
      else if (width > previousWidth) cancel()
      previousWidth = width
    })
    observer.observe(viewport)
    const region = viewport.closest("section")
    region?.addEventListener("pointerdown", cancel, { passive: true })
    region?.addEventListener("wheel", cancel, { passive: true })
    return () => {
      cancel()
      observer.disconnect()
      region?.removeEventListener("pointerdown", cancel)
      region?.removeEventListener("wheel", cancel)
      reveal.current = () => {}
    }
  }, [viewportRef])

  useLayoutEffect(() => { reveal.current() }, [appointmentId])
}
