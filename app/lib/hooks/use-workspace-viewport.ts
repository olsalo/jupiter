import { useLayoutEffect } from "react"

// Keep the app shell inside the visible area when the onscreen keyboard opens
export function useWorkspaceViewport() {
  useLayoutEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement
    const style = root.style
    let fullHeight = Math.max(root.clientHeight, viewport.height)
    let width = viewport.width
    const update = () => {
      // Pinch zoom must not resize the underlying app layout
      if (viewport.scale !== 1) return
      style.setProperty("--workspace-viewport-height", `${viewport.height}px`)
      style.setProperty("--workspace-viewport-top", `${viewport.offsetTop}px`)
      if (viewport.width !== width) {
        width = viewport.width
        fullHeight = Math.max(root.clientHeight, viewport.height)
      }
      const focused = document.activeElement
      const editing = focused instanceof HTMLElement && (focused.isContentEditable || focused.matches('textarea, input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([readonly]):not([disabled])'))
      const obscured = Math.max(fullHeight, root.clientHeight) - viewport.height > 120
      // Keep navigation hidden during keyboard dismissal, even after focus leaves
      root.toggleAttribute("data-workspace-keyboard-open", obscured && (editing || root.hasAttribute("data-workspace-keyboard-open")))
      if (!editing && !root.hasAttribute("data-workspace-keyboard-open")) fullHeight = Math.max(root.clientHeight, viewport.height)
    }
    viewport.addEventListener("resize", update)
    viewport.addEventListener("scroll", update)
    window.addEventListener("resize", update)
    document.addEventListener("focusin", update)
    document.addEventListener("focusout", update)
    update()
    return () => {
      viewport.removeEventListener("resize", update)
      viewport.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
      document.removeEventListener("focusin", update)
      document.removeEventListener("focusout", update)
      root.removeAttribute("data-workspace-keyboard-open")
      style.removeProperty("--workspace-viewport-height")
      style.removeProperty("--workspace-viewport-top")
    }
  }, [])
}
