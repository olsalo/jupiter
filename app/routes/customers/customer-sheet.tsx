import { dehydrate, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Outlet, useMatches, useNavigate, useOutletContext } from "react-router"

import type { Route } from "./+types/customer-sheet"
import { ResponsiveSheetPanel } from "~/components/responsive-sheet"
import { CustomerSheet } from "~/components/customers/customer-sheet"
import type { CustomerMasterDetailContext, CustomerContext } from "~/components/customers/customer-types"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { OverlayLoading } from "~/components/overlay-loading"
import { useMediaQuery } from "~/lib/hooks"
import { getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { useModalQueryLoading } from "~/lib/use-modal-query-loading"
import { useOrganizationPermission } from "~/lib/use-organization-access"

export async function loader(args: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(args)
  await queryClient.query(trpc.customer.get.queryOptions({ id: args.params.customerId })).catch(() => undefined)
  return { queryClient: dehydrate(queryClient) }
}

export function clientLoader() {
  return null
}

export default function CustomerLayout({ params }: Route.ComponentProps) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const navigate = useNavigate()
  const detailContext = useOutletContext<CustomerMasterDetailContext>()
  const mobile = useMediaQuery("max-640px")
  const [pending, setPending] = useState(false)
  const canManage = useOrganizationPermission({ customers: ["update"] })
  const editing = useMatches().some((match) => (match.handle as { customerMode?: string } | undefined)?.customerMode === "edit")
  const query = useQuery({
    ...trpc.customer.get.queryOptions({ id: params.customerId }),
  })
  const loading = useModalQueryLoading(query, params.customerId)

  function content(close: (destination?: string) => void) {
    if (loading) return <OverlayLoading data-slot="customer-loading" label={t("customerPage.loading")} />
    if (!query.data) return <ResponsiveSheetPanel><Alert variant="error"><AlertTitle>{t("customerPage.loadError")}</AlertTitle><AlertDescription>{t("customerPage.retryDescription")}</AlertDescription></Alert><Button className="mt-4" disabled={query.isFetching} onClick={() => void query.refetch()} type="button" variant="outline">{t("customerPage.retry")}</Button></ResponsiveSheetPanel>
    return <Outlet context={{ customer: query.data, close, onPendingChange: setPending } satisfies CustomerContext} />
  }

  if (mobile) return <CustomerSheet basePath="/customers" onCloseStart={detailContext.onCustomerCloseStart} pending={pending} profile={loading || (Boolean(query.data) && (!editing || canManage))} title={query.data ? [query.data.firstName, query.data.lastName].filter(Boolean).join(" ") : t("customerPage.details")} description={t(editing ? "customerPage.editDescription" : "customerPage.detailsDescription")}>{content}</CustomerSheet>

  return <div className="flex min-h-0 flex-1 flex-col" data-slot="customer-detail">{content(() => navigate("/customers"))}</div>
}
