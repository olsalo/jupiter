import type { AppIconName } from "~/components/icons"
import { OverviewCardIcon } from "~/components/overview/overview-card-icon"
import { RollingFormattedNumber } from "~/components/data-display/rolling-formatted-number"
import { Card, CardPanel, CardTitle } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"
import type { FormatPreference } from "~/lib/localization/format-preference"

type OverviewStatCardProps = {
  icon: AppIconName
  label: string
  loading: boolean
  tone: "green" | "blue" | "violet"
  value: number | null
  formatPreference: FormatPreference
}

export function OverviewStatCard({ icon, label, loading, tone, value, formatPreference }: OverviewStatCardProps) {
  return (
    <Card aria-busy={loading}>
      <CardPanel className="flex items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          {loading ? <Skeleton aria-hidden="true" className="h-10 w-20 rounded-lg" /> : (
            <p className="text-4xl leading-10 font-semibold tracking-tight tabular-nums">
              {value === null ? "—" : <RollingFormattedNumber formatPreference={formatPreference} value={value} />}
            </p>
          )}
          <CardTitle className="text-sm leading-5 font-medium text-muted-foreground" render={<h2 />}>{label}</CardTitle>
        </div>
        <OverviewCardIcon icon={icon} tone={tone} />
      </CardPanel>
    </Card>
  )
}
