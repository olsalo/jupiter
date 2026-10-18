import { Spinner } from "~/components/ui/spinner"

export function TeamPanelLoading({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background" data-slot="team-panel-loading">
      <Spinner aria-label={label} className="size-6" />
    </div>
  )
}
