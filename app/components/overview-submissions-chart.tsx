import { useTranslation } from "react-i18next"

import { OverviewCardIcon } from "~/components/overview-card-icon"
import AreaChart from "~/components/chart"
import type { AreaChartDatum } from "~/components/chart"
import { Card, CardHeader, CardPanel, CardTitle } from "~/components/ui/card"
import { formatNumber } from "~/lib/format-preference"
import type { FormatPreference } from "~/lib/format-preference"

type OverviewSubmissionsChartProps = {
  data: AreaChartDatum[]
  formatPreference: FormatPreference
  timeZone: string
}

export function OverviewSubmissionsChart({ data, formatPreference, timeZone }: OverviewSubmissionsChartProps) {
  const { t, i18n } = useTranslation("dashboard")
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const total = data.reduce((sum, day) => sum + day.value, 0)

  return (
    <Card>
      <CardHeader className="gap-4 p-5 pb-4 sm:p-6 sm:pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <OverviewCardIcon icon="chartBar" tone="blue" />
            <CardTitle className="text-base leading-6" render={<h2 />}>{t("chart.title")}</CardTitle>
          </div>
          <span className="shrink-0 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{t("chart.period")}</span>
        </div>
        <p className="text-4xl font-semibold tracking-tight tabular-nums">{formatNumber(total, formatPreference)}</p>
      </CardHeader>
      <CardPanel className="px-3 pb-5! sm:px-5 sm:pb-6!">
        <AreaChart
          data={data}
          emptyLabel={t("chart.empty")}
          formatPreference={formatPreference}
          label={t("chart.label")}
          language={language}
          showXAxis={true}
          timeZone={timeZone}
          valueLabel={t("chart.responses")}
        />
      </CardPanel>
    </Card>
  )
}
