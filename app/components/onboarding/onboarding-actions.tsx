import { useLayoutEffect, useRef, type ReactNode } from "react"

export function OnboardingActions({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    const actions = actionsRef.current
    if (!container || !actions) return
    const viewport = container.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')

    const updateHeight = () => {
      const height = `${actions.getBoundingClientRect().height}px`
      container.style.setProperty("--onboarding-actions-height", height)
      viewport?.style.setProperty("scroll-padding-bottom", height)
    }
    const observer = new ResizeObserver(updateHeight)
    observer.observe(actions)
    updateHeight()

    return () => {
      observer.disconnect()
      viewport?.style.removeProperty("scroll-padding-bottom")
    }
  }, [])

  return (
    <div
      className="h-[var(--onboarding-actions-height,calc(4.25rem+env(safe-area-inset-bottom,0px)))] shrink-0 lg:contents"
      ref={containerRef}
    >
      <div
        className="bottom-0 z-20 isolate grid shrink-0 px-3 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:bottom-0 before:-z-10 before:bg-background/75 before:content-[''] max-lg:fixed max-lg:left-[calc(10px+env(safe-area-inset-left,0px))] max-lg:right-[calc(10px+env(safe-area-inset-right,0px))] max-lg:mx-auto max-lg:max-w-[calc(28rem+1.5rem)] lg:sticky lg:-mx-3 lg:pb-[calc(1rem+var(--tappable-inset-bottom,0px))]"
        data-slot="onboarding-actions"
        ref={actionsRef}
      >
        {children}
      </div>
    </div>
  )
}
