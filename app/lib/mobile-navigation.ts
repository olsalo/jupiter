import { useRef, type MouseEvent, type PointerEvent } from "react"
import { useNavigate } from "react-router"

export const desktopViewportQuery =
  "(min-width: 768px) and (pointer: fine), (min-width: 768px) and (min-height: 600px), (min-width: 768px) and (orientation: portrait)"

export function useMobileMenuNavigation() {
  const navigate = useNavigate()
  const pressedLink = useRef<string | null>(null)

  return {
    onPointerDown(event: PointerEvent<HTMLAnchorElement>) {
      pressedLink.current = null
      if (event.defaultPrevented || !event.isPrimary || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || !window.matchMedia("(width < 768px)").matches) return

      const link = event.currentTarget
      if (link.target && link.target !== "_self") return

      pressedLink.current = link.href
      void navigate(`${link.pathname}${link.search}${link.hash}`)
    },
    onClick(event: MouseEvent<HTMLAnchorElement>) {
      if (event.detail > 0 && pressedLink.current === event.currentTarget.href) {
        event.preventDefault()
      }
      pressedLink.current = null
    },
  }
}
