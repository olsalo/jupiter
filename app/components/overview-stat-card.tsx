import type { AppIconName } from "~/components/icons"
import { OverviewCardIcon } from "~/components/overview-card-icon"
import { Card, CardPanel, CardTitle } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"

type OverviewStatCardProps = {
  icon: AppIconName
  label: string
  loading: boolean
  tone: "green" | "blue" | "violet"
  value: string
}

export function OverviewStatCard({ icon, label, loading, tone, value }: OverviewStatCardProps) {
  return (
    <Card aria-busy={loading}>
      <CardPanel className="flex items-center justify-between gap-4 p-5">
        <div className="flex min-w-0 flex-col items-start gap-3">
          <OverviewCardIcon icon={icon} size="md" tone={tone} />
          <CardTitle className="text-sm leading-5 font-medium text-muted-foreground" render={<h2 />}>{label}</CardTitle>
        </div>
        {loading ? <Skeleton aria-hidden="true" className="h-10 w-20 rounded-lg" /> : (
          <p className="shrink-0 text-4xl leading-10 font-semibold tracking-tight tabular-nums">{value}</p>
        )}
      </CardPanel>
    </Card>
  )
}
