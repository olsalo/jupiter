import { dehydrate, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Outlet, useMatches, useNavigate, useOutletContext } from "react-router"

import type { Route } from "./+types/member-layout"
import { ResponsiveSheetPanel } from "~/components/overlays/responsive-sheet"
import { TeamPersonSheet } from "~/components/team/team-person-sheet"
import type { TeamMasterDetailContext, TeamPersonContext } from "~/components/team/team-types"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { OverlayLoading } from "~/components/overlays/overlay-loading"
import { useMediaQuery } from "~/lib/hooks"
import { getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { useModalQueryLoading } from "~/lib/hooks/use-modal-query-loading"
import { useOrganizationPermission } from "~/lib/hooks/use-organization-access"

export async function loader(args: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(args)
  await queryClient.query(trpc.team.getPerson.queryOptions({ id: args.params.memberId })).catch(() => undefined)
  return { queryClient: dehydrate(queryClient) }
}

export function clientLoader() {
  return null
}

export default function MemberLayout({ params }: Route.ComponentProps) {
  const { t } = useTranslation("team")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const detailContext = useOutletContext<TeamMasterDetailContext>()
  const mobile = useMediaQuery("max-640px")
  const [pending, setPending] = useState(false)
  const canManage = useOrganizationPermission({ team: ["manage"] })
  const editing = useMatches().some((match) => (match.handle as { teamMode?: string } | undefined)?.teamMode === "edit")
  const query = useQuery({
    ...trpc.team.getPerson.queryOptions({ id: params.memberId }),
    initialData: () => queryClient.getQueryData(trpc.team.list.queryKey())?.people.find((member) => member.id === params.memberId),
    initialDataUpdatedAt: () => queryClient.getQueryState(trpc.team.list.queryKey())?.dataUpdatedAt,
  })
  const loading = useModalQueryLoading(query, params.memberId)

  function content(close: (destination?: string) => void) {
    if (loading) return <OverlayLoading data-slot="person-loading" label={t("people.loading")} />
    if (!query.data) return <ResponsiveSheetPanel><Alert variant="error"><AlertTitle>{t("people.loadFailed")}</AlertTitle><AlertDescription>{t("retryDescription")}</AlertDescription><AlertAction><Button disabled={query.isFetching} onClick={() => void query.refetch()} type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert></ResponsiveSheetPanel>
    return <Outlet context={{ person: query.data, canManage, close, onPendingChange: setPending, sideNavigation: !mobile } satisfies TeamPersonContext} />
  }

  if (mobile) return <TeamPersonSheet basePath="/team" onCloseStart={detailContext.onPersonCloseStart} pending={pending} profile={loading || (Boolean(query.data) && (!editing || canManage))} title={query.data?.name ?? t("people.details")} description={t(editing ? "people.editDescription" : "people.detailsDescription")}>{content}</TeamPersonSheet>

  return <div className="flex min-h-0 flex-1 flex-col" data-slot="team-person-detail">{content(() => navigate("/team"))}</div>
}
