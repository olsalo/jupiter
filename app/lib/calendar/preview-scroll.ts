export type CalendarScrollPosition = { left: number; top: number }

type CalendarScrollViewport = {
  read: () => CalendarScrollPosition
  restore: (position: CalendarScrollPosition) => void
}

export function createCalendarPreviewScrollState() {
  let viewport: CalendarScrollViewport | null = null
  let position: CalendarScrollPosition | null = null
  let pendingRestore = false
  let closingViewport: CalendarScrollViewport | null = null

  return {
    attach(next: CalendarScrollViewport) {
      viewport = next
      return () => {
        if (viewport !== next) return
        if (!pendingRestore) position = next.read()
        viewport = null
      }
    },
    startPreview() {
      position = viewport?.read() ?? position
      pendingRestore = false
      closingViewport = null
    },
    finishPreview() {
      if (pendingRestore) return
      position = viewport?.read() ?? position
      closingViewport = viewport
      pendingRestore = position !== null
    },
    restore() {
      if (!pendingRestore || !position || !viewport) return false
      // A mounted grid already owns its position, including native resize clamping
      if (viewport !== closingViewport) viewport.restore(position)
      position = null
      pendingRestore = false
      closingViewport = null
      return true
    },
  }
}

export type CalendarPreviewScrollState = ReturnType<typeof createCalendarPreviewScrollState>
