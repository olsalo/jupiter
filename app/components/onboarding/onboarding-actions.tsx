import { useLayoutEffect, useRef, type ReactNode } from "react"

export function OnboardingActions({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    const actions = actionsRef.current
    if (!container || !actions) return

    const updateHeight = () => {
      container.style.setProperty("--onboarding-actions-height", `${actions.getBoundingClientRect().height}px`)
    }
    const observer = new ResizeObserver(updateHeight)
    observer.observe(actions)
    updateHeight()

    return () => observer.disconnect()
  }, [])

  return (
    <div
      className="h-[var(--onboarding-actions-height,calc(4.25rem+env(safe-area-inset-bottom,0px)))] shrink-0 md:contents"
      ref={containerRef}
    >
      <div
        className="bottom-0 z-20 grid shrink-0 bg-background/95 px-3 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] backdrop-blur-xl max-md:fixed max-md:left-[calc(10px+env(safe-area-inset-left,0px))] max-md:right-[calc(10px+env(safe-area-inset-right,0px))] max-md:mx-auto max-md:max-w-[calc(28rem+1.5rem)] md:sticky md:-mx-3"
        data-slot="onboarding-actions"
        ref={actionsRef}
      >
        {children}
      </div>
    </div>
  )
}
