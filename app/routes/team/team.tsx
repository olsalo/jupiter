import { dehydrate, useQuery } from "@tanstack/react-query"
import type { inferRouterOutputs } from "@trpc/server"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, Outlet, useLocation, useNavigate, useRevalidator, useSearchParams } from "react-router"

import type { Route } from "./+types/team"
import type { AppRouter } from "~/.server/main"
import { useAppContext } from "~/lib/hooks/use-app-context"
import Icon from "~/components/icons"
import { InvitationActionsMenu } from "~/components/team/invitation-actions-menu"
import { ViewportPage } from "~/components/layout/page-layout"
import { RouteHeader } from "~/components/layout/route-header"
import { TanStackTable, type TanStackTableColumn } from "~/components/data-display/tanstack-table"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "~/components/ui/select"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Tabs, TabsList, TabsPanel, TabsTab } from "~/components/ui/tabs"
import { formatDateTime } from "~/lib/localization/format-preference"
import { shouldRevalidateAppRoute } from "~/lib/routing/should-revalidate"
import { getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { hasOrganizationRole } from "~/lib/utils"
import { useCurrentOrganizationRole } from "~/lib/hooks/use-organization-access"

type TeamListOutput = inferRouterOutputs<AppRouter>["team"]["list"]

export async function loader(loaderArgs: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(loaderArgs)

  const team = await queryClient.query(trpc.team.list.queryOptions()).catch(() => undefined)
  const counts = {
    members: team?.members.length ?? 0,
    people: team?.people.length ?? 0,
    invitations: team?.invitations.length ?? 0,
  }
  if (team) {
    queryClient.setQueryData(trpc.team.count.queryOptions().queryKey, counts)
  }

  return { queryClient: dehydrate(queryClient) }
}

export function clientLoader() {
  // Client queries own fetching and freshness after the initial server render.
  return null
}

export const handle = { workspace: true, pageLayout: "viewport" }

export const shouldRevalidate = shouldRevalidateAppRoute

export default function Team() {
  const { t } = useTranslation("team")
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const navigate = useNavigate()
  const location = useLocation()
  const root = useAppContext()
  const trpc = useTRPC()
  const team = useQuery(trpc.team.list.queryOptions())
  const counts = useQuery({ ...trpc.team.count.queryOptions(), enabled: false })
  const showTeamError = team.isError && team.data === undefined
  const showRefreshError = team.isError && team.data !== undefined
  const personCount = team.data?.people.length ?? counts.data?.people
  const invitationCount = team.data?.invitations.length ?? counts.data?.invitations
  const organizationRole = useCurrentOrganizationRole()
  const canInvite = organizationRole === "owner" || organizationRole === "admin"
  const formatDate = useCallback((value: Date) => formatDateTime(value, {
    formatPreference: root?.formatPreference ?? "eu",
    language: root?.locale === "fi" ? "fi" : "en",
    timeZone: root?.organizationTimezone,
    includeTime: false,
  }), [root?.formatPreference, root?.locale, root?.organizationTimezone])
  const roleLabel = useCallback((role: string | null) => (role ?? "member").split(",").map((value) => {
    const key = value.trim()
    return key === "owner" || key === "admin" || key === "member" ? t(`roles.${key}`) : key
  }).join(", "), [t])
  const peopleColumns = useMemo<TanStackTableColumn<TeamListOutput["people"][number]>[]>(() => [
    {
      id: "person", header: t("people.person"),
      cell: ({ row: { original: person } }) => <div className="flex min-w-0 items-center gap-3">
        <Avatar>{person.image ? <AvatarImage src={person.image} alt="" /> : null}<AvatarFallback>{person.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
        <div className="grid min-w-0 gap-1.5"><span className="truncate font-medium">{person.name}{person.member?.user.id === root?.user?.id ? <span className="ml-2 font-normal text-muted-foreground">{t("you")}</span> : null}</span><span className="truncate text-xs text-muted-foreground">{person.email || person.phone || t("people.noContact")}</span></div>
      </div>, meta: { grow: 2, minWidth: "16rem", skeleton: "avatarText" },
    },
    { id: "access", header: t("people.appAccess"), cell: ({ row }) => <Badge variant={row.original.member ? "secondary" : "outline"}>{t(row.original.member ? "people.accessActive" : row.original.invitation ? "people.accessInvited" : "people.accessNone")}</Badge>, meta: { minWidth: "9rem", skeleton: "badge" } },
    { id: "role", header: t("permissionLevel"), cell: ({ row }) => row.original.member ? <Badge variant="outline">{roleLabel(row.original.member.role)}</Badge> : <span className="text-muted-foreground">—</span>, meta: { minWidth: "8rem", skeleton: "badge" } },
    { id: "bookable", header: t("people.takesAppointments"), cell: ({ row }) => <Badge variant="outline">{t(row.original.staff?.isActive && row.original.staff.acceptsAppointments ? "people.bookable" : "people.notBookable")}</Badge>, meta: { minWidth: "10rem", skeleton: "badge" } },
    { id: "services", header: t("people.services"), cell: ({ row }) => <span className="line-clamp-2 text-sm text-muted-foreground">{row.original.staff?.staffServices.filter((link) => link.isActive).map((link) => link.service.name).join(", ") || "—"}</span>, meta: { grow: 1.2, minWidth: "12rem" } },
  ], [roleLabel, root?.user?.id, t])
  const people = (team.data?.people ?? []).filter((person) => {
    const bookable = Boolean(person.staff?.isActive && person.staff.acceptsAppointments)
    return (filter === "all" || (filter === "bookable" ? bookable : !bookable)) && [person.name, person.email, person.phone].some((value) => value?.toLowerCase().includes(search.toLowerCase()))
  })
  const inviteColumns = useMemo<TanStackTableColumn<TeamListOutput["invitations"][number]>[]>(() => [
    {
      accessorKey: "inviteeName",
      header: t("name"),
      cell: ({ row }) => <span className="block truncate font-medium" title={row.original.inviteeName ?? undefined}>{row.original.inviteeName || "—"}</span>,
      meta: { minWidth: "9rem" },
    },
    {
      accessorKey: "email",
      header: t("email"),
      cell: ({ row }) => <span className="truncate font-medium" title={row.original.email}>{row.original.email}</span>,
      meta: { grow: 2, minWidth: "16rem" },
    },
    {
      accessorKey: "role",
      header: t("permissionLevel"),
      cell: ({ row }) => <Badge variant="outline">{roleLabel(row.original.role)}</Badge>,
      meta: { minWidth: "8rem", skeleton: "badge" },
    },
    {
      accessorKey: "expiresAt",
      header: t("expires"),
      cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(row.original.expiresAt)}</span>,
      meta: { align: "end", minWidth: "9rem" },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row: { original: invitation } }) => (
        <InvitationActionsMenu
          canInvite={canInvite}
          email={invitation.email}
          invitationId={invitation.id}
        />
      ),
      meta: { align: "end", width: "7rem", isAction: true, mobileActionPlacement: "top-right" },
    },
  ], [canInvite, formatDate, roleLabel, t])

  return (
    <ViewportPage header={
      <RouteHeader
        title={t("title")}
        refreshing={team.isRefetching}
        description={t("description")}
        showDescriptionOnMobile={false}
        actions={<div className="flex items-center gap-2">
          <Button aria-label={t("v2.detailView")} className="max-md:size-9 max-md:p-0" render={<Link to="/team" />} type="button" variant="outline"><Icon aria-hidden={true} className="md:hidden" name="layoutSidebarInactive" size={18} /><span className="hidden md:inline">{t("v2.detailView")}</span></Button>
          {canInvite ? <Button aria-label={t("people.addAction")} className="max-md:size-9 max-md:p-0" render={<Link to="new" state={{ returnTo: `${location.pathname}${location.search}` }} />} type="button"><Icon aria-hidden={true} name="add" size={18} /><span className="hidden md:inline">{t("people.addAction")}</span></Button> : null}
        </div>}
      />
    }>
      <title>{t("title")}</title>
      {showRefreshError ? (
        <Alert variant="warning">
          <AlertTitle>{t("refreshError")}</AlertTitle>
          <AlertDescription>{t("staleDescription")}</AlertDescription>
          <AlertAction>
            <Button
              disabled={team.isFetching}
              onClick={() => void team.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("retry")}
            </Button>
          </AlertAction>
        </Alert>
      ) : null}
      {showTeamError ? (
        <Alert variant="error">
          <AlertTitle>{t("loadError")}</AlertTitle>
          <AlertDescription>{t("retryDescription")}</AlertDescription>
          <AlertAction>
            <Button
              disabled={team.isFetching}
              onClick={() => void team.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("retry")}
            </Button>
          </AlertAction>
        </Alert>
      ) : (
        <Tabs className="min-h-0 flex-1 gap-4" value={searchParams.get("tab") === "invites" ? "invites" : "people"} onValueChange={(value) => setSearchParams((previous) => {
          const next = new URLSearchParams(previous)
          if (value === "invites") next.set("tab", "invites")
          else next.delete("tab")
          return next
        }, { replace: true })}>
          <TabsList aria-label={t("title")} className="grid shrink-0 grid-cols-2">
            <TabsTab value="people">
              {t("tabs.people")}
              <Badge className="min-w-5 justify-center tabular-nums" variant="secondary">{personCount}</Badge>
            </TabsTab>
            <TabsTab value="invites">
              {t("tabs.invites")}
              <Badge className="min-w-5 justify-center tabular-nums" variant="secondary">{invitationCount}</Badge>
            </TabsTab>
          </TabsList>
          <TabsPanel className="flex min-h-0 flex-col gap-4" value="people">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input aria-label={t("people.search")} className="sm:max-w-sm" onChange={(event) => setSearch(event.target.value)} placeholder={t("people.search")} type="search" value={search} />
              <Select items={[{ label: t("people.all"), value: "all" }, { label: t("people.bookable"), value: "bookable" }, { label: t("people.notBookable"), value: "notBookable" }]} value={filter} onValueChange={(value) => { if (value) setFilter(value) }}>
                <SelectTrigger aria-label={t("people.filter")} className="sm:w-52"><SelectValue /></SelectTrigger><SelectPopup><SelectItem value="all">{t("people.all")}</SelectItem><SelectItem value="bookable">{t("people.bookable")}</SelectItem><SelectItem value="notBookable">{t("people.notBookable")}</SelectItem></SelectPopup>
              </Select>
            </div>
            <TanStackTable
              ariaLabel={t("members")}
              className="min-h-0"
              columns={peopleColumns}
              data={people}
              emptyContent={
                <Empty className="min-h-0 w-full border-0 bg-transparent">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Icon aria-hidden="true" name="users" size={18} />
                    </EmptyMedia>
                    <EmptyTitle>{t(search || filter !== "all" ? "people.noMatches" : "noMembers")}</EmptyTitle>
                    <EmptyDescription>{t("noMembersDescription")}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              }
              enableMultiSelect={false}
              enablePagination={false}
              fillHeight={true}
              getRowId={(person) => person.id}
              onRowClick={(person) => navigate(`/team-original/${encodeURIComponent(person.id)}`, { state: { returnTo: `${location.pathname}${location.search}` } })}
              loading={team.isLoading}
              loadingLabel={t("loading")}
              skeletonRowCount={personCount}
            />
          </TabsPanel>
          <TabsPanel className="flex min-h-0 flex-col" value="invites">
            <TanStackTable
              ariaLabel={t("pending")}
              className="min-h-0"
              columns={inviteColumns}
              data={team.data?.invitations ?? []}
              emptyContent={
                <Empty className="min-h-0 w-full border-0 bg-transparent">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Icon aria-hidden="true" name="mail" size={18} />
                    </EmptyMedia>
                    <EmptyTitle>{t("noInvites")}</EmptyTitle>
                    <EmptyDescription>{t("noInvitesDescription")}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              }
              enableMultiSelect={false}
              enablePagination={false}
              fillHeight={true}
              getRowId={(invitation) => invitation.id}
              loading={team.isLoading}
              loadingLabel={t("loading")}
              skeletonRowCount={invitationCount}
            />
          </TabsPanel>
        </Tabs>
      )}
      <Outlet />
    </ViewportPage>
  )
}

export function ErrorBoundary() {
  const { t } = useTranslation("team")
  const revalidator = useRevalidator()

  return (
    <ViewportPage header={
      <RouteHeader
        description={t("description")}
        title={t("title")}
      />
    }>
      <title>{t("title")}</title>
      <Alert variant="error">
        <AlertTitle>{t("loadError")}</AlertTitle>
        <AlertDescription>{t("retryDescription")}</AlertDescription>
        <AlertAction>
          <Button
            disabled={revalidator.state !== "idle"}
            onClick={() => void revalidator.revalidate()}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("retry")}
          </Button>
        </AlertAction>
      </Alert>
    </ViewportPage>
  )
}
