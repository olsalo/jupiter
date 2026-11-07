import { useCallback } from "react"

export function useSettingsFooterScroll(open: boolean) {
  return useCallback((panel: HTMLDivElement | null) => {
    const viewport = panel?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
    if (!open || !viewport) return

    let previousHeight = viewport.clientHeight
    const observer = new ResizeObserver(() => {
      const height = viewport.clientHeight
      const lostHeight = previousHeight - height
      const wasAtBottom = viewport.scrollHeight - viewport.scrollTop - previousHeight <= 2
      previousHeight = height
      if (lostHeight <= 0) return

      if (wasAtBottom) {
        viewport.scrollTop += lostHeight
        return
      }

      const focused = document.activeElement
      if (!(focused instanceof HTMLElement) || !viewport.contains(focused)) return
      const field = focused.closest<HTMLElement>('[data-slot="field"]') ?? focused
      const hiddenHeight = field.getBoundingClientRect().bottom - viewport.getBoundingClientRect().bottom
      if (hiddenHeight > 0) viewport.scrollTop += hiddenHeight + 16
    })
    observer.observe(viewport)

    return () => observer.disconnect()
  }, [open])
}
