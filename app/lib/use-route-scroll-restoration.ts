import { useLayoutEffect, useRef, type RefObject } from "react"

export function useRouteScrollRestoration(
  viewportRef: RefObject<HTMLDivElement | null>,
  pathname: string,
) {
  const positions = useRef(new Map<string, number>())
  const activePathname = useRef(pathname)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const savePosition = () => {
      positions.current.set(activePathname.current, viewport.scrollTop)
    }

    viewport.addEventListener("scroll", savePosition, { passive: true })
    return () => viewport.removeEventListener("scroll", savePosition)
  }, [viewportRef])

  useLayoutEffect(() => {
    if (activePathname.current === pathname) return

    const viewport = viewportRef.current
    if (!viewport) return

    activePathname.current = pathname
    viewport.scrollTop = positions.current.get(pathname) ?? 0
  }, [pathname, viewportRef])
}
