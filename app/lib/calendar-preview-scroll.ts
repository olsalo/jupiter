export type CalendarScrollPosition = { left: number; top: number }

type CalendarScrollViewport = {
  read: () => CalendarScrollPosition
  restore: (position: CalendarScrollPosition) => void
}

export function createCalendarPreviewScrollState() {
  let viewport: CalendarScrollViewport | null = null
  let original: CalendarScrollPosition | null = null
  let pendingRestore = false

  return {
    attach(next: CalendarScrollViewport) {
      viewport = next
      return () => { if (viewport === next) viewport = null }
    },
    startPreview() {
      original ??= viewport?.read() ?? null
      pendingRestore = false
    },
    finishPreview() {
      pendingRestore = original !== null
    },
    restore() {
      if (!pendingRestore || !original || !viewport) return false
      viewport.restore(original)
      original = null
      pendingRestore = false
      return true
    },
  }
}

export type CalendarPreviewScrollState = ReturnType<typeof createCalendarPreviewScrollState>
