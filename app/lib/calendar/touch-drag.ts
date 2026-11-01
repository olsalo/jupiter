type TouchPosition = { x: number; y: number }

// Touch events keep a long press alive when the browser cancels its pointer stream.
// Listen outside the card so rendering a preview cannot lose the active gesture.
export function startCalendarTouchDrag({ element, origin, activationDelay = 450, onActivate, onMove, onEnd, onCancel }: {
  element: HTMLElement
  origin: TouchPosition
  activationDelay?: number
  onActivate: () => void
  onMove: (position: TouchPosition) => void
  onEnd: (position: TouchPosition) => void
  onCancel: () => void
}) {
  const document = element.ownerDocument
  const window = document.defaultView
  let identifier: number | undefined
  let activated = false
  let finished = false
  let originalTarget: EventTarget | null = null
  const handledEvents = new WeakSet<Event>()
  const options = { capture: true, passive: false }
  const cleanup = () => {
    if (finished) return
    finished = true
    if (timer !== null) clearTimeout(timer)
    originalTarget?.removeEventListener("touchmove", move as EventListener, options)
    originalTarget?.removeEventListener("touchend", end as EventListener, options)
    originalTarget?.removeEventListener("touchcancel", cancel, options)
    originalTarget?.removeEventListener("contextmenu", contextMenu, options)
    originalTarget = null
    document.removeEventListener("touchstart", start, options)
    document.removeEventListener("touchmove", move, options)
    document.removeEventListener("touchend", end, options)
    document.removeEventListener("touchcancel", cancel, options)
    document.removeEventListener("scroll", scroll, options)
    document.removeEventListener("contextmenu", contextMenu, options)
    document.removeEventListener("visibilitychange", visibilityChange)
    window?.removeEventListener("blur", cancel)
  }
  const cancel = () => {
    if (finished) return
    cleanup()
    onCancel()
  }
  const activate = () => {
    if (finished || activated) return
    if (identifier === undefined || !element.isConnected) { cancel(); return }
    activated = true
    onActivate()
  }
  const start = (event: TouchEvent) => {
    if (finished) return
    if (event.touches.length !== 1 || identifier !== undefined) { cancel(); return }
    identifier = event.touches[0].identifier
    // Touch events remain targeted at the original node, even if a resize or
    // service update removes that label from the card during the gesture.
    if (event.target && event.target !== document) {
      originalTarget = event.target
      originalTarget.addEventListener("touchmove", move as EventListener, options)
      originalTarget.addEventListener("touchend", end as EventListener, options)
      originalTarget.addEventListener("touchcancel", cancel, options)
      originalTarget.addEventListener("contextmenu", contextMenu, options)
    }
    if (activationDelay === 0) activate()
  }
  const move = (event: TouchEvent) => {
    if (finished || handledEvents.has(event)) return
    handledEvents.add(event)
    if (event.touches.length !== 1) { cancel(); return }
    const touch = Array.from(event.touches).find((touch) => touch.identifier === identifier)
    if (!touch) { cancel(); return }
    const position = { x: touch.clientX, y: touch.clientY }
    if (!activated) {
      if (!event.cancelable || Math.hypot(position.x - origin.x, position.y - origin.y) >= 8) cancel()
      return
    }
    // A non-cancelable move means native scrolling already won this gesture.
    // Cancel instead of moving the booking and the page at the same time.
    if (!event.cancelable) { cancel(); return }
    event.preventDefault()
    onMove(position)
  }
  const end = (event: TouchEvent) => {
    if (finished || handledEvents.has(event)) return
    handledEvents.add(event)
    const touch = Array.from(event.changedTouches).find((touch) => touch.identifier === identifier)
    if (!touch) return
    const wasActivated = activated
    if (wasActivated && event.cancelable) event.preventDefault()
    cleanup()
    if (wasActivated) onEnd({ x: touch.clientX, y: touch.clientY })
    else onCancel()
  }
  const scroll = (event: Event) => {
    // Scrolls in a separate panel do not interrupt a pending calendar press.
    if (!finished && !activated && (event.target === document || event.target === window || (event.target instanceof Element && event.target.contains(element)))) cancel()
  }
  const contextMenu = (event: Event) => { if (!finished && event.cancelable) event.preventDefault() }
  const visibilityChange = () => { if (document.hidden) cancel() }
  const timer = activationDelay > 0 ? setTimeout(activate, activationDelay) : null
  document.addEventListener("touchstart", start, options)
  document.addEventListener("touchmove", move, options)
  document.addEventListener("touchend", end, options)
  document.addEventListener("touchcancel", cancel, options)
  document.addEventListener("scroll", scroll, options)
  document.addEventListener("contextmenu", contextMenu, options)
  document.addEventListener("visibilitychange", visibilityChange)
  window?.addEventListener("blur", cancel)
  return cleanup
}
