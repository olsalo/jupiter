import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"

import { Spinner } from "~/components/ui/spinner"

export function CalendarLoading() {
  const { t } = useTranslation()
  const container = useRef<HTMLDivElement>(null)
  const indicator = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const page = container.current?.closest<HTMLElement>(".app-page-scroll")
    if (!page) return
    const mobile = window.matchMedia("(width < 768px)")
    const header = page.querySelector<HTMLElement>(".route-header")
    const navigation = page.closest("main")?.querySelector<HTMLElement>('[data-slot="app-navigation"]')
    const visualViewport = window.visualViewport
    const measure = () => {
      if (!mobile.matches) {
        setPosition(null)
        return
      }
      const bounds = page.getBoundingClientRect()
      const visualTop = visualViewport?.offsetTop ?? 0
      const visualBottom = visualTop + (visualViewport?.height ?? window.innerHeight)
      const top = Math.max(bounds.top, visualTop, header?.getBoundingClientRect().bottom ?? bounds.top)
      const navBounds = navigation?.getBoundingClientRect()
      const bottom = Math.max(top, Math.min(bounds.top + page.clientHeight, visualBottom, navBounds && navBounds.width > 0 ? navBounds.top : visualBottom))
      const left = bounds.left + page.clientWidth / 2
      const center = top + (bottom - top) / 2
      // Scroll and viewport callbacks must reposition the spinner before paint,
      // without waiting for React to schedule another render
      if (indicator.current) {
        indicator.current.style.left = `${left}px`
        indicator.current.style.top = `${center}px`
      }
      setPosition((current) => current?.left === left && current.top === center ? current : { left, top: center })
    }
    const observer = new ResizeObserver(measure)
    for (const element of [page, header, navigation]) {
      if (element) observer.observe(element)
    }
    page.addEventListener("scroll", measure, { passive: true })
    window.addEventListener("resize", measure)
    mobile.addEventListener("change", measure)
    visualViewport?.addEventListener("resize", measure)
    visualViewport?.addEventListener("scroll", measure)
    measure()
    return () => {
      observer.disconnect()
      page.removeEventListener("scroll", measure)
      window.removeEventListener("resize", measure)
      mobile.removeEventListener("change", measure)
      visualViewport?.removeEventListener("resize", measure)
      visualViewport?.removeEventListener("scroll", measure)
    }
  }, [])

  useLayoutEffect(() => {
    const content = container.current?.closest('[data-slot="page-content"]')
    if (!position || !indicator.current || !content) return
    // Portals do not inherit the page's entrance animation. Mirror its active
    // effects and timeline so the centered spinner slides in with the route
    const animations = content.getAnimations().filter((animation) => animation.playState === "running" && animation.effect instanceof KeyframeEffect).map((source) => {
      const effect = source.effect as KeyframeEffect
      const animation = indicator.current!.animate(effect.getKeyframes(), effect.getTiming())
      animation.currentTime = source.currentTime
      animation.playbackRate = source.playbackRate
      return animation
    })
    return () => { for (const animation of animations) animation.cancel() }
  }, [Boolean(position)])

  return <>
    <div className="flex min-h-48 min-w-0 flex-1 items-center justify-center bg-background md:min-h-0" data-slot="calendar-loading" ref={container}>
      <Spinner aria-label={t("loading")} className="max-md:hidden" />
    </div>
    {position ? createPortal(<div className="pointer-events-none fixed z-20 -translate-x-1/2 -translate-y-1/2" data-slot="calendar-mobile-loading" ref={indicator} style={position}>
      <Spinner aria-label={t("loading")} />
    </div>, document.body) : null}
  </>
}
