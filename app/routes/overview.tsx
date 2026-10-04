import { dehydrate, useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import type { Route } from "./+types/overview"
import type { loader as rootLoader } from "~/root"
import { CreateFormButton } from "~/components/forms/create-form-button"
import { JoinTeamInvitation } from "~/components/join-team-invitation"
import { JoinedTeamDialog } from "~/components/joined-team-dialog"
import { OverviewSubmissionsChart } from "~/components/overview-submissions-chart"
import { OverviewStatCard } from "~/components/overview-stat-card"
import { OverviewRecentForms } from "~/components/overview-recent-forms"
import { OverviewRecentResponses } from "~/components/overview-recent-responses"
import { PageHeader } from "~/components/page-header"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { formatNumber } from "~/lib/format-preference"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"
import { getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { useOverviewGreeting } from "~/lib/use-overview-greeting"

export async function loader(loaderArgs: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(loaderArgs)
  await queryClient.query(trpc.forms.overview.queryOptions()).catch(() => undefined)

  return { queryClient: dehydrate(queryClient), greetingDate: new Date().toISOString() }
}

export function clientLoader() {
  return { greetingDate: new Date().toISOString() }
}

export const shouldRevalidate = shouldRevalidateAppRoute

export default function Overview() {
  const { t } = useTranslation("dashboard")
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const greeting = useOverviewGreeting()
  const trpc = useTRPC()
  const stats = useQuery(trpc.forms.overview.queryOptions())
  const cards = [
    { key: "activeForms", icon: "forms", tone: "green" },
    { key: "responses", icon: "chartBar", tone: "blue" },
    { key: "thisWeek", icon: "calendar", tone: "violet" },
  ] as const

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-6">
      <title>{t("title")}</title>
      <JoinTeamInvitation />
      <JoinedTeamDialog />
      <PageHeader
        actions={<CreateFormButton compactOnMobile={true} />}
        className="route-mobile-header max-md:flex-nowrap max-md:gap-3 md:hidden"
        description={t("description")}
        refreshing={stats.isRefetching}
        showDescriptionOnMobile={true}
        title={greeting}
      />
      {stats.isError ? (
        <Alert variant={stats.data ? "warning" : "error"}>
          <AlertTitle>{t(stats.data ? "errors.refresh" : "errors.load")}</AlertTitle>
          <AlertDescription>{t(stats.data ? "errors.stale" : "errors.retry")}</AlertDescription>
          <AlertAction>
            <Button disabled={stats.isFetching} onClick={() => void stats.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button>
          </AlertAction>
        </Alert>
      ) : null}
      {stats.isPending ? (
        <div aria-busy={true} className="flex min-h-0 flex-1 items-center justify-center">
          <Spinner aria-label={t("loading")} className="size-6 text-muted-foreground" />
        </div>
      ) : (
        <>
          <div aria-label={t("stats.label")} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {cards.map(({ key, icon, tone }) => (
              <OverviewStatCard
                icon={icon}
                key={key}
                label={t(`stats.${key}.label`)}
                loading={false}
                tone={tone}
                value={stats.data ? formatNumber(stats.data[key], root?.formatPreference ?? "eu") : "—"}
              />
            ))}
          </div>
          {stats.data ? (
            <>
              <OverviewSubmissionsChart
                data={stats.data.dailySubmissions}
                formatPreference={root?.formatPreference ?? "eu"}
                timeZone={stats.data.timeZone}
              />
              <OverviewRecentForms
                forms={stats.data.recentForms}
                formatPreference={root?.formatPreference ?? "eu"}
                timeZone={stats.data.timeZone}
              />
              <OverviewRecentResponses
                responses={stats.data.recentResponses}
                formatPreference={root?.formatPreference ?? "eu"}
                timeZone={stats.data.timeZone}
              />
            </>
          ) : null}
        </>
      )}
    </section>
  )
}
