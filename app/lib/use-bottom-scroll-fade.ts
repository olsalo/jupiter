import { useEffect, type RefObject } from "react"

export function useBottomScrollFade(
  viewportRef: RefObject<HTMLDivElement | null>,
  fadeRef: RefObject<HTMLDivElement | null>,
  useTableScroll: boolean,
) {
  useEffect(() => {
    const pageViewport = viewportRef.current
    const fade = fadeRef.current

    if (!pageViewport || !fade) return

    const mobileViewport = window.matchMedia("(max-width: 767px)")
    const resizeObserver = new ResizeObserver(updateFade)
    const observed = new Set<Element>()

    function observe(element: Element | null) {
      if (!element || observed.has(element)) return
      resizeObserver.observe(element)
      observed.add(element)
    }

    function getTableViewport() {
      if (!useTableScroll || !pageViewport) return null

      const tables = pageViewport.querySelectorAll<HTMLElement>('[role="table"]')

      for (const table of tables) {
        if (table.getClientRects().length === 0) continue

        const viewport = table.querySelector<HTMLDivElement>(
          '[data-slot="scroll-area-viewport"]',
        )

        if (!viewport) continue
        observe(viewport)
        observe(viewport.querySelector('[data-slot="scroll-area-content"]'))

        if (
          viewport.getClientRects().length > 0 &&
          ["auto", "scroll"].includes(getComputedStyle(viewport).overflowY) &&
          viewport.scrollHeight > viewport.clientHeight + 1
        ) {
          return viewport
        }
      }

      return null
    }

    function updateFade() {
      if (!pageViewport || !fade) return

      if (mobileViewport.matches) {
        fade.style.opacity = "1"
        return
      }

      const viewport = getTableViewport() ?? pageViewport
      const remaining = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop

      fade.style.opacity = String(Math.min(1, Math.max(0, remaining / 48)))
    }

    observe(pageViewport)
    observe(pageViewport.querySelector('[data-slot="scroll-area-content"]'))

    const mutationObserver = new MutationObserver(updateFade)
    mutationObserver.observe(pageViewport, {
      attributes: true,
      attributeFilter: ["data-active", "hidden"],
      childList: true,
      subtree: true,
    })
    pageViewport.addEventListener("scroll", updateFade, { capture: true, passive: true })
    mobileViewport.addEventListener("change", updateFade)
    updateFade()

    return () => {
      mutationObserver.disconnect()
      resizeObserver.disconnect()
      pageViewport.removeEventListener("scroll", updateFade, true)
      mobileViewport.removeEventListener("change", updateFade)
    }
  }, [viewportRef, fadeRef, useTableScroll])
}
