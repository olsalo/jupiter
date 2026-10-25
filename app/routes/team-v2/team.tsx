import { dehydrate, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, Outlet, useLocation, useParams } from "react-router"

import type { Route } from "./+types/team"
import Icon from "~/components/icons"
import { ScrollPage, ViewportPage } from "~/components/layout/page-layout"
import { RouteHeader } from "~/components/layout/route-header"
import { TeamMemberList } from "~/components/team/team-member-list"
import type { TeamMasterDetailContext } from "~/components/team/team-types"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { useMediaQuery } from "~/lib/hooks"
import { shouldRevalidateAppRoute } from "~/lib/routing/should-revalidate"
import { getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { useOrganizationPermission } from "~/lib/hooks/use-organization-access"

export const handle = { workspace: true, pageLayout: "viewport-desktop" }
export const shouldRevalidate = shouldRevalidateAppRoute

export async function loader(args: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(args)
  await queryClient.query(trpc.team.list.queryOptions()).catch(() => undefined)
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
  const { memberId } = useParams()
  const location = useLocation()
  const mobile = useMediaQuery("max-640px")
  const Page = mobile ? ScrollPage : ViewportPage
  const [search, setSearch] = useState("")
  const [closingLocationKey, setClosingLocationKey] = useState<string | null>(null)
  const detailContext: TeamMasterDetailContext = { onPersonCloseStart: () => setClosingLocationKey(location.key) }
  const canManage = useOrganizationPermission({ team: ["manage"] })

  return (
    <Page header={
      <RouteHeader
        className="shrink-0 items-start gap-6 max-md:items-center max-md:gap-3 [&>div:has(h1)]:flex-1 sm:[&>div:has([data-team-mobile-search])]:hidden"
        title={t("v2.title")}
        description={t("description")}
        refreshing={team.isRefetching}
        showDescriptionOnMobile={false}
        mobileControls={<InputGroup className="w-full" data-team-mobile-search={true}>
          <InputGroupInput aria-label={t("people.search")} onChange={(event) => setSearch(event.target.value)} placeholder={t("people.search")} type="search" value={search} />
          <InputGroupAddon><Icon aria-hidden={true} name="search" size={16} /></InputGroupAddon>
        </InputGroup>}
        actions={canManage ? <Button aria-label={t("people.addAction")} className="max-md:size-9 max-md:p-0" render={<Link to={memberId ? `${location.pathname.replace(/\/new\/?$/, "")}/new${location.search}` : "new"} state={{ returnTo: `${location.pathname}${location.search}` }} />} size="lg" type="button"><Icon aria-hidden={true} name="add" size={18} /><span className="hidden md:inline">{t("people.addAction")}</span></Button> : null}
      />
    }>
      <title>{t("v2.title")}</title>
      {team.isError ? <Alert variant={team.data ? "warning" : "error"}>
        <AlertTitle>{t(team.data ? "refreshError" : "loadError")}</AlertTitle>
        <AlertDescription>{t(team.data ? "staleDescription" : "retryDescription")}</AlertDescription>
        <AlertAction><Button disabled={team.isFetching} onClick={() => void team.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction>
      </Alert> : null}
      <div className="@container/team relative isolate flex min-h-0 min-w-0 flex-1 sm:overflow-hidden sm:bg-background sm:rounded-md sm:p-px after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-[inherit] sm:after:border sm:after:border-border" data-slot="team-master-detail">
        <aside aria-label={t("members")} className="flex min-h-0 w-full min-w-0 flex-col sm:w-64 sm:shrink-0 sm:border-r lg:w-80">
          <TeamMemberList search={search} onSearchChange={setSearch} people={team.data?.people ?? []} selectedId={closingLocationKey === location.key ? undefined : memberId} loading={team.isPending} failed={team.isError && !team.data} />
        </aside>
        <section aria-label={t("people.details")} className="hidden min-h-0 min-w-0 flex-1 flex-col sm:flex" data-slot="team-detail-panel">
          {memberId ? <Outlet context={detailContext} key={memberId} /> : <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Icon aria-hidden={true} name="user" /></EmptyMedia>
              <EmptyTitle>{t("v2.selectMember")}</EmptyTitle>
              <EmptyDescription>{t("v2.selectMemberDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>}
        </section>
        {!memberId ? <Outlet /> : null}
      </div>
    </Page>
  )
}
