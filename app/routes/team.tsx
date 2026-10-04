import { dehydrate, useQuery } from "@tanstack/react-query"
import type { inferRouterOutputs } from "@trpc/server"
import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useRevalidator, useRouteLoaderData } from "react-router"

import type { Route } from "./+types/team"
import type { AppRouter } from "~/.server/main"
import type { loader as rootLoader } from "~/root"
import Icon from "~/components/icons"
import { InviteMemberDialog } from "~/components/invite-member-dialog"
import { TablePage, TablePageHeader } from "~/components/table-page"
import { TanStackTable, type TanStackTableColumn } from "~/components/tanstack-table"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Tabs, TabsList, TabsPanel, TabsTab } from "~/components/ui/tabs"
import { formatDateTime } from "~/lib/format-preference"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"
import { getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { hasOrganizationRole } from "~/lib/utils"

type TeamListOutput = inferRouterOutputs<AppRouter>["team"]["list"]

export async function loader(loaderArgs: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(loaderArgs)

  const team = await queryClient.fetchQuery(trpc.team.list.queryOptions()).catch(() => undefined)
  const counts = {
    members: team?.members.length ?? 0,
    invitations: team?.invitations.length ?? 0,
  }
  if (team) {
    queryClient.setQueryData(trpc.team.count.queryOptions().queryKey, counts)
  }

  return { queryClient: dehydrate(queryClient) }
}

export function clientLoader() {
  return null
}

export const shouldRevalidate = shouldRevalidateAppRoute

export default function Team() {
  const { t } = useTranslation("team")
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const trpc = useTRPC()
  const team = useQuery(trpc.team.list.queryOptions())
  const counts = useQuery({ ...trpc.team.count.queryOptions(), enabled: false })
  const showTeamError = team.isError && team.data === undefined
  const showRefreshError = team.isError && team.data !== undefined
  const memberCount = team.data?.members.length ?? counts.data?.members
  const invitationCount = team.data?.invitations.length ?? counts.data?.invitations
  const organizationRole = root?.organizations.find((organization) => organization.id === root.org?.id)?.role
  const canInvite = team.data?.canInvite ?? (
    hasOrganizationRole(organizationRole, "owner") || hasOrganizationRole(organizationRole, "admin")
  )
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
  const memberColumns = useMemo<TanStackTableColumn<TeamListOutput["members"][number]>[]>(() => [
    {
      id: "member",
      header: t("member"),
      cell: ({ row: { original: member } }) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar>
            {member.user.image ? <AvatarImage src={member.user.image} alt="" /> : null}
            <AvatarFallback>{(member.user.name || member.user.email).slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 gap-1.5">
            <span className="truncate font-medium" title={member.user.name || member.user.email}>
              {member.user.name || member.user.email}
              {member.user.id === root?.user?.id ? <span className="ml-2 font-normal text-muted-foreground">{t("you")}</span> : null}
            </span>
            <span className="truncate text-xs text-muted-foreground" title={member.user.email}>{member.user.email}</span>
          </div>
        </div>
      ),
      meta: { grow: 2, minWidth: "16rem", skeleton: "avatarText" },
    },
    {
      accessorKey: "role",
      header: t("role"),
      cell: ({ row }) => <Badge variant="outline">{roleLabel(row.original.role)}</Badge>,
      meta: { minWidth: "8rem", skeleton: "badge" },
    },
    {
      accessorKey: "createdAt",
      header: t("joined"),
      cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
      meta: { align: "end", minWidth: "9rem" },
    },
  ], [formatDate, roleLabel, root?.user?.id, t])
  const inviteColumns = useMemo<TanStackTableColumn<TeamListOutput["invitations"][number]>[]>(() => [
    {
      accessorKey: "email",
      header: t("email"),
      cell: ({ row }) => <span className="truncate font-medium" title={row.original.email}>{row.original.email}</span>,
      meta: { grow: 2, minWidth: "16rem" },
    },
    {
      accessorKey: "role",
      header: t("role"),
      cell: ({ row }) => <Badge variant="outline">{roleLabel(row.original.role)}</Badge>,
      meta: { minWidth: "8rem", skeleton: "badge" },
    },
    {
      accessorKey: "expiresAt",
      header: t("expires"),
      cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(row.original.expiresAt)}</span>,
      meta: { align: "end", minWidth: "9rem" },
    },
  ], [formatDate, roleLabel, t])

  return (
    <TablePage>
      <title>{t("title")}</title>
      <TablePageHeader
        title={t("title")}
        refreshing={team.isRefetching}
        description={t("description")}
        actions={canInvite ? <InviteMemberDialog /> : undefined}
      />
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
        <Tabs className="min-h-0 flex-1 gap-4" defaultValue="members">
          <TabsList aria-label={t("title")} className="grid shrink-0 grid-cols-2">
            <TabsTab value="members">
              {t("tabs.members")}
              <Badge className="min-w-5 justify-center tabular-nums" variant="secondary">{memberCount}</Badge>
            </TabsTab>
            <TabsTab value="invites">
              {t("tabs.invites")}
              <Badge className="min-w-5 justify-center tabular-nums" variant="secondary">{invitationCount}</Badge>
            </TabsTab>
          </TabsList>
          <TabsPanel className="flex min-h-0 flex-col" value="members">
            <TanStackTable
              ariaLabel={t("members")}
              className="h-auto min-h-[24rem] md:min-h-0"
              columns={memberColumns}
              data={team.data?.members ?? []}
              emptyContent={
                <Empty className="min-h-0 w-full border-0 bg-transparent">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Icon aria-hidden="true" name="users" size={18} />
                    </EmptyMedia>
                    <EmptyTitle>{t("noMembers")}</EmptyTitle>
                    <EmptyDescription>{t("noMembersDescription")}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              }
              enableMultiSelect={false}
              enablePagination={false}
              fillHeight={true}
              getRowId={(member) => member.id}
              loading={team.isLoading}
              loadingLabel={t("loading")}
              skeletonRowCount={memberCount}
            />
          </TabsPanel>
          <TabsPanel className="flex min-h-0 flex-col" value="invites">
            <TanStackTable
              ariaLabel={t("pending")}
              className="h-auto min-h-[24rem] md:min-h-0"
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
    </TablePage>
  )
}

export function ErrorBoundary() {
  const { t } = useTranslation("team")
  const revalidator = useRevalidator()

  return (
    <TablePage>
      <title>{t("title")}</title>
      <TablePageHeader
        description={t("description")}
        title={t("title")}
      />
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
    </TablePage>
  )
}
