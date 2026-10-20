export function attachCalendarWheelScroll(viewport: HTMLElement, elements: HTMLElement[], scrollTo: (position: { left: number; top: number }) => void) {
  let wheelAxis: "x" | "y" | null = null
  let releaseTimeout: ReturnType<typeof setTimeout> | undefined
  const onScrollEnd = () => {
    clearTimeout(releaseTimeout)
    releaseTimeout = setTimeout(() => { wheelAxis = null }, 10)
  }
  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey) return
    const deltaX = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX
    const deltaY = event.shiftKey ? 0 : event.deltaY
    if (!deltaX && !deltaY) return
    const axis = wheelAxis ?? (Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y")
    event.preventDefault()
    const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? axis === "x" ? viewport.clientWidth : viewport.clientHeight : 1
    const left = viewport.scrollLeft
    const top = viewport.scrollTop
    const nextLeft = axis === "x" ? Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, left + deltaX * multiplier)) : left
    const nextTop = axis === "y" ? Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, top + deltaY * multiplier)) : top
    if (left !== nextLeft || top !== nextTop) {
      clearTimeout(releaseTimeout)
      wheelAxis = axis
    }
    // Update scrolling and labels in the same frame instead of trailing native wheel scrolling
    scrollTo({ left: nextLeft, top: nextTop })
  }
  for (const element of elements) element.addEventListener("wheel", onWheel, { passive: false })
  viewport.addEventListener("scrollend", onScrollEnd)
  return () => {
    clearTimeout(releaseTimeout)
    for (const element of elements) element.removeEventListener("wheel", onWheel)
    viewport.removeEventListener("scrollend", onScrollEnd)
  }
}
