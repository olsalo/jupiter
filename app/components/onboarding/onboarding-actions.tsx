import type { ReactNode } from "react"

export function OnboardingActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-3 grid shrink-0 bg-background/95 px-3 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] backdrop-blur-xl">
      {children}
    </div>
  )
}
