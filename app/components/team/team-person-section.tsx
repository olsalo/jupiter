import type { ReactNode } from "react"

import { TeamPanelLoading } from "./team-panel-loading"
import { ResponsiveSheetPanel } from "~/components/overlays/responsive-sheet"

export function TeamPersonSection({ header, children, loadingLabel }: { header: ReactNode; children: ReactNode; loadingLabel?: string }) {
  return <div className="relative flex min-h-0 flex-1 flex-col [&_[data-slot=scroll-area-content]]:flex [&_[data-slot=scroll-area-content]]:min-h-full [&_[data-slot=scroll-area-content]]:flex-col">
    <div className="shrink-0 px-6 pt-6 pb-5">{header}</div>
    {loadingLabel ? <div className="relative min-h-0 flex-1"><TeamPanelLoading label={loadingLabel} /></div> : <ResponsiveSheetPanel className="relative flex min-h-full flex-1 flex-col gap-4 px-6! pt-0! pb-6! has-[[data-slot=empty]]:pb-0!" scrollFade={true}>
      {children}
    </ResponsiveSheetPanel>}
  </div>
}
