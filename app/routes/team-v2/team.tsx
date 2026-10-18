import { dehydrate, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, Outlet, useLocation, useParams } from "react-router"

import type { Route } from "./+types/team"
import Icon from "~/components/icons"
import { TablePage, TablePageHeader } from "~/components/table-page"
import { TeamMemberList } from "~/components/team/team-member-list"
import type { TeamMasterDetailContext } from "~/components/team/team-types"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"
import { getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { useOrganizationPermission } from "~/lib/use-organization-access"

export const handle = { workspace: true, contained: true }
export const shouldRevalidate = shouldRevalidateAppRoute

export async function loader(args: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(args)
  await queryClient.fetchQuery(trpc.team.list.queryOptions()).catch(() => undefined)
  return { queryClient: dehydrate(queryClient) }
}

export function clientLoader() {
  // Client queries own fetching and freshness after the initial server render.
  return null
}

export default function TeamV2() {
  const { t } = useTranslation("team")
  const trpc = useTRPC()
  const team = useQuery(trpc.team.list.queryOptions())
  const { personId } = useParams()
  const location = useLocation()
  const [closingLocationKey, setClosingLocationKey] = useState<string | null>(null)
  const detailContext: TeamMasterDetailContext = { onPersonCloseStart: () => setClosingLocationKey(location.key) }
  const canManage = useOrganizationPermission({ team: ["manage"] })

  return (
    <TablePage fitHeight={true}>
      <title>{t("v2.title")}</title>
      <TablePageHeader
        className="shrink-0 items-start gap-6 max-md:items-center max-md:gap-6 [&>div:has(h1)]:flex-1"
        title={t("v2.title")}
        description={t("description")}
        refreshing={team.isRefetching}
        showDescriptionOnMobile={true}
        actions={canManage ? <Button aria-label={t("people.addAction")} className="max-md:size-9 max-md:p-0" render={<Link to={personId ? `${location.pathname.replace(/\/new\/?$/, "")}/new${location.search}` : "new"} state={{ returnTo: `${location.pathname}${location.search}` }} />} size="lg" type="button"><Icon aria-hidden={true} name="add" size={18} /><span className="hidden md:inline">{t("people.addAction")}</span></Button> : null}
      />
      {team.isError ? <Alert variant={team.data ? "warning" : "error"}>
        <AlertTitle>{t(team.data ? "refreshError" : "loadError")}</AlertTitle>
        <AlertDescription>{t(team.data ? "staleDescription" : "retryDescription")}</AlertDescription>
        <AlertAction><Button disabled={team.isFetching} onClick={() => void team.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction>
      </Alert> : null}
      <div className="@container/team relative isolate flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-md bg-background p-px after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-[inherit] after:border after:border-border" data-slot="team-master-detail">
        <aside aria-label={t("members")} className="flex min-h-0 w-full min-w-0 flex-col sm:w-64 sm:shrink-0 sm:border-r lg:w-80">
          <TeamMemberList people={team.data?.people ?? []} selectedId={closingLocationKey === location.key ? undefined : personId} loading={team.isPending} failed={team.isError && !team.data} />
        </aside>
        <section aria-label={t("people.details")} className="hidden min-h-0 min-w-0 flex-1 flex-col sm:flex" data-slot="team-detail-panel">
          {personId ? <Outlet context={detailContext} key={personId} /> : <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Icon aria-hidden={true} name="user" /></EmptyMedia>
              <EmptyTitle>{t("v2.selectMember")}</EmptyTitle>
              <EmptyDescription>{t("v2.selectMemberDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>}
        </section>
        {!personId ? <Outlet /> : null}
      </div>
    </TablePage>
  )
}
