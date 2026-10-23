import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Alert, AlertAction, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "~/components/ui/card"
import { Meter, MeterIndicator, MeterLabel, MeterTrack } from "~/components/ui/meter"
import { Skeleton } from "~/components/ui/skeleton"
import { useTRPC } from "~/lib/trpc/client"

export function PlanUsage() {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const usage = useQuery({ ...trpc.resourceLimits.getAll.queryOptions(), staleTime: 0 })
  const team = usage.data?.teamMembers

  return (
    <Card>
      <CardHeader className="gap-2 p-4">
        <CardTitle className="text-base">{t("settings.planUsage")}</CardTitle>
        <CardDescription className="text-xs">{t("settings.teamMemberUsageDescription")}</CardDescription>
      </CardHeader>
      <CardPanel className="px-4 pt-0 pb-4">
        {usage.isError ? (
          <Alert variant="error">
            <AlertTitle>{t("settings.planUsageError")}</AlertTitle>
            <AlertAction><Button disabled={usage.isFetching} onClick={() => void usage.refetch()} size="sm" type="button" variant="outline">{t("settings.planUsageRetry")}</Button></AlertAction>
          </Alert>
        ) : team ? (
          <Meter min={0} max={team.limit} value={Math.min(team.used, team.limit)}>
            <div className="flex items-center justify-between gap-4">
              <MeterLabel>{t("settings.teamMembers")}</MeterLabel>
              <span className="text-sm tabular-nums">{team.used} / {team.limit}</span>
            </div>
            <MeterTrack className="rounded-full"><MeterIndicator className={team.reached ? "bg-warning" : undefined} /></MeterTrack>
          </Meter>
        ) : <Skeleton className="h-9 w-full rounded-lg" />}
      </CardPanel>
    </Card>
  )
}
