import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Alert, AlertAction, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Meter, MeterIndicator, MeterLabel, MeterTrack } from "~/components/ui/meter"
import { useTRPC } from "~/lib/trpc/client"

export function PlanUsage() {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const usage = useQuery({ ...trpc.resourceLimits.getAll.queryOptions(), staleTime: 0 })
  const team = usage.data?.teamMembers

  if (!team && !usage.isError) return null

  return (
    <div className="border-t px-4 py-4">
        {usage.isError ? (
          <Alert>
            <AlertTitle>{t("settings.planUsageError")}</AlertTitle>
            <AlertAction><Button disabled={usage.isFetching} loading={usage.isFetching} onClick={() => void usage.refetch()} size="sm" type="button" variant="outline">{t("settings.planUsageRetry")}</Button></AlertAction>
          </Alert>
        ) : team ? (
          <Meter min={0} max={team.limit} value={Math.min(team.used, team.limit)}>
            <div className="flex items-center justify-between gap-4">
              <MeterLabel>{t("settings.teamMembers")}</MeterLabel>
              <span className="text-sm tabular-nums">{team.used} / {team.limit}</span>
            </div>
            <MeterTrack className="rounded-full"><MeterIndicator className={team.reached ? "bg-warning" : undefined} /></MeterTrack>
            <p className="text-xs text-muted-foreground">{t("settings.teamMemberUsageDescription")}</p>
          </Meter>
        ) : null}
    </div>
  )
}
