import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Link, useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import { Alert, AlertAction, AlertTitle } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { formatDateTime } from "~/lib/format-preference"
import { useTRPC } from "~/lib/trpc/client"
import type { Customer } from "./customer-types"

export function CustomerAppointments({ customerId, scope, page, preview = false }: { customerId: string; scope: "upcoming" | "history"; page: Customer["appointments"]["upcoming"]; preview?: boolean }) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const queryOptions = trpc.customer.getAppointments.infiniteQueryOptions({ id: customerId, scope: preview && scope === "history" ? "recent" : scope, limit: preview ? 1 : 20 }, { enabled: false, initialData: { pages: [page], pageParams: [null] }, getNextPageParam: (page) => page.nextCursor })
  const query = useInfiniteQuery(queryOptions)
  useEffect(() => {
    queryClient.setQueryData(queryOptions.queryKey, { pages: [page], pageParams: [null] })
  }, [customerId, scope, preview, page, queryClient])
  const appointments = query.data?.pages.flatMap((page) => page.items) ?? []
  const options = { formatPreference: root?.formatPreference ?? "eu", language: root?.locale === "fi" ? "fi" as const : "en" as const, timeZone: root?.organizationTimezone ?? "Europe/Helsinki" }

  return <div className="grid gap-3">
    {query.isError ? <Alert variant="error"><AlertTitle>{t("customerPage.appointmentsError")}</AlertTitle><AlertAction><Button disabled={query.isFetching} onClick={() => void query.refetch()} size="sm" type="button" variant="outline">{t("customerPage.retry")}</Button></AlertAction></Alert> : null}
    {!appointments.length && !query.isError ? <Alert><AlertTitle>{t(scope === "upcoming" ? "customerPage.noUpcoming" : "customerPage.noHistory")}</AlertTitle></Alert> : null}
    {appointments.length ? <ul className="grid gap-3">{appointments.map((appointment) => <li key={appointment.id}>
      <Link className="grid gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={`/calendar/${encodeURIComponent(appointment.id)}`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="min-w-0 break-words text-sm font-medium">{appointment.services.map((service) => service.name).join(", ") || t("customerPage.appointment")}</span>{appointment.status !== "CONFIRMED" ? <Badge variant={appointment.status === "CANCELLED" || appointment.status === "NO_SHOW" ? "secondary" : "outline"}>{t(`calendarGrid.statuses.${appointment.status}`)}</Badge> : null}</div>
        <span className="text-sm text-muted-foreground">{formatDateTime(appointment.startsAt, options)} – {formatDateTime(appointment.endsAt, { ...options, includeDate: false })}</span>
      </Link>
    </li>)}</ul> : null}
    {!preview && query.hasNextPage ? <Button disabled={query.isFetchingNextPage} loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()} type="button" variant="outline">{t("customerPage.loadMore")}</Button> : null}
  </div>
}
