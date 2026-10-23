import { useState } from "react"
import { dehydrate, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Outlet, useMatches } from "react-router"
import type { Route } from "./+types/person-sheet"
import { TeamPersonSheet } from "~/components/team/team-person-sheet"
import type { TeamPersonContext } from "~/components/team/team-types"
import { ResponsiveSheetPanel } from "~/components/responsive-sheet"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { OverlayLoading } from "~/components/overlay-loading"
import { getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { useModalQueryLoading } from "~/lib/use-modal-query-loading"
import { useOrganizationPermission } from "~/lib/use-organization-access"

export const handle = { overlay: true }
export async function loader(args: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(args)
  await queryClient.query(trpc.team.getPerson.queryOptions({ id: args.params.personId })).catch(() => undefined)
  return { queryClient: dehydrate(queryClient) }
}
// Client navigation mounts the sheet without waiting for its detail query
export function clientLoader() {
  return null
}

export default function PersonSheet({ params }: Route.ComponentProps) {
  const { t } = useTranslation("team")
  const [pending, setPending] = useState(false)
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const canManage = useOrganizationPermission({ team: ["manage"] })
  const editing = useMatches().some((match) => (match.handle as { teamMode?: string } | undefined)?.teamMode === "edit")
  const query = useQuery({ ...trpc.team.getPerson.queryOptions({ id: params.personId }), initialData: () => queryClient.getQueryData(trpc.team.list.queryKey())?.people.find((person) => person.id === params.personId), initialDataUpdatedAt: () => queryClient.getQueryState(trpc.team.list.queryKey())?.dataUpdatedAt })
  const loading = useModalQueryLoading(query, params.personId)
  return (
    <TeamPersonSheet basePath="/team-original" pending={pending} profile={loading || (Boolean(query.data) && (!editing || canManage))} title={query.data?.name ?? t(editing ? "people.edit" : "people.details")} description={t(editing ? "people.editDescription" : "people.detailsDescription")}>
      {(close) => loading ? <OverlayLoading data-slot="person-loading" label={t("people.loading")} /> : query.isError && !query.data ? <ResponsiveSheetPanel><Alert variant="error"><AlertTitle>{t("people.loadFailed")}</AlertTitle><AlertDescription>{t("retryDescription")}</AlertDescription></Alert><Button onClick={() => void query.refetch()} type="button" variant="outline">{t("retry")}</Button></ResponsiveSheetPanel> : <Outlet context={{ person: query.data ?? null, canManage, close, onPendingChange: setPending } satisfies TeamPersonContext} />}
    </TeamPersonSheet>
  )
}
