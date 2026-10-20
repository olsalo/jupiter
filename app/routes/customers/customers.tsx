import { dehydrate, useInfiniteQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, Outlet, useLocation, useParams } from "react-router"

import type { Route } from "./+types/customers"
import Icon from "~/components/icons"
import { ViewportPage } from "~/components/page-layout"
import { RouteHeader } from "~/components/route-header"
import { CustomerList } from "~/components/customers/customer-list"
import type { CustomerMasterDetailContext } from "~/components/customers/customer-types"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { useDebouncedValue } from "~/lib/use-debounced-value"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"
import { getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { useOrganizationPermission } from "~/lib/use-organization-access"

export const handle = { workspace: true, pageLayout: "viewport" }
export const shouldRevalidate = shouldRevalidateAppRoute

export async function loader(args: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(args)
  await queryClient.fetchInfiniteQuery(trpc.customer.list.infiniteQueryOptions({ limit: 50 }, { getNextPageParam: (page) => page.nextCursor })).catch(() => undefined)
  return { queryClient: dehydrate(queryClient) }
}

export function clientLoader() {
  // Client queries own fetching and freshness after the initial server render.
  return null
}

export default function Customers() {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const { customerId } = useParams()
  const location = useLocation()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search.trim())
  const customers = useInfiniteQuery(trpc.customer.list.infiniteQueryOptions({ limit: 50, search: debouncedSearch || undefined }, { getNextPageParam: (page) => page.nextCursor }))
  const [closingLocationKey, setClosingLocationKey] = useState<string | null>(null)
  const detailContext: CustomerMasterDetailContext = { onCustomerCloseStart: () => setClosingLocationKey(location.key) }
  const canCreate = useOrganizationPermission({ customers: ["create"] })

  return (
    <ViewportPage header={
      <RouteHeader
        className="shrink-0 items-start gap-6 max-md:items-center max-md:gap-3 [&>div:has(h1)]:flex-1 sm:[&>div:has([data-customer-mobile-search])]:hidden"
        title={t("customerPage.title")}
        description={t("customerPage.description")}
        refreshing={customers.isRefetching}
        showDescriptionOnMobile={false}
        mobileControls={<InputGroup className="w-full" data-customer-mobile-search={true}>
          <InputGroupInput aria-label={t("customerPage.search")} onChange={(event) => setSearch(event.target.value)} placeholder={t("customerPage.search")} type="search" value={search} />
          <InputGroupAddon><Icon aria-hidden={true} name="search" size={16} /></InputGroupAddon>
        </InputGroup>}
        actions={canCreate ? <Button aria-label={t("customerPage.add")} className="max-md:size-9 max-md:p-0" render={<Link to={customerId ? `${location.pathname.replace(/\/new\/?$/, "")}/new${location.search}` : "new"} state={{ returnTo: `${location.pathname}${location.search}` }} />} size="lg" type="button"><Icon aria-hidden={true} name="add" size={18} /><span className="hidden md:inline">{t("customerPage.add")}</span></Button> : null}
      />
    }>
      <title>{t("customerPage.title")}</title>
      {customers.isError ? <Alert variant={customers.data ? "warning" : "error"}>
        <AlertTitle>{t(customers.data ? "customerPage.refreshError" : "customerPage.loadError")}</AlertTitle>
        <AlertDescription>{t(customers.data ? "customerPage.staleDescription" : "customerPage.retryDescription")}</AlertDescription>
        <AlertAction><Button disabled={customers.isFetching} onClick={() => void customers.refetch()} size="sm" type="button" variant="outline">{t("customerPage.retry")}</Button></AlertAction>
      </Alert> : null}
      <div className="@container/customers relative isolate flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background sm:rounded-md sm:p-px after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-[inherit] sm:after:border sm:after:border-border" data-slot="customer-master-detail">
        <aside aria-label={t("customerPage.title")} className="flex min-h-0 w-full min-w-0 flex-col sm:w-64 sm:shrink-0 sm:border-r lg:w-80">
          <CustomerList search={search} onSearchChange={setSearch} customers={customers.data?.pages.flatMap((page) => page.items) ?? []} hasMore={customers.hasNextPage} fetchingMore={customers.isFetchingNextPage} onLoadMore={() => void customers.fetchNextPage()} selectedId={closingLocationKey === location.key ? undefined : customerId} loading={customers.isPending} failed={customers.isError && !customers.data} />
        </aside>
        <section aria-label={t("customerPage.details")} className="hidden min-h-0 min-w-0 flex-1 flex-col sm:flex" data-slot="customer-detail-panel">
          {customerId ? <Outlet context={detailContext} key={customerId} /> : <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Icon aria-hidden={true} name="user" /></EmptyMedia>
              <EmptyTitle>{t("customerPage.selectCustomer")}</EmptyTitle>
              <EmptyDescription>{t("customerPage.selectDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>}
        </section>
        {!customerId ? <Outlet /> : null}
      </div>
    </ViewportPage>
  )
}
