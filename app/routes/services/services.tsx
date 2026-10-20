import { DragDropProvider, PointerSensor } from "@dnd-kit/react"
import { Feedback, PointerActivationConstraints } from "@dnd-kit/dom"
import { isSortable } from "@dnd-kit/react/sortable"
import { dehydrate, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, Outlet, useLocation } from "react-router"

import type { Route } from "./+types/services"
import Icon from "~/components/icons"
import { DeleteConfirmationDialog } from "~/components/delete-confirmation-dialog"
import { useServiceOrder } from "~/components/services/use-service-order"
import { ServiceListDetails } from "~/components/services/service-list-details"
import { SortableServiceListItem } from "~/components/services/sortable-service-list-item"
import { ServiceActionsMenu } from "~/components/services/service-actions-menu"
import { ServiceCategoryControls, useServiceCategoryControls } from "~/components/services/service-category-controls"
import { RouteHeader } from "~/components/route-header"
import { ScrollPage } from "~/components/page-layout"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { Spinner } from "~/components/ui/spinner"
import { toast } from "~/lib/toast"
import { getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"
import { useOrganizationPermission } from "~/lib/use-organization-access"
import { cn } from "~/lib/utils"

export const handle = { workspace: true, pageLayout: "scroll" } as const
export const shouldRevalidate = shouldRevalidateAppRoute

export async function loader(args: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(args)
  await Promise.all([
    queryClient.query(trpc.service.list.queryOptions()).catch(() => undefined),
    queryClient.query(trpc.service.categories.queryOptions()).catch(() => undefined),
  ])
  return { queryClient: dehydrate(queryClient) }
}

export function clientLoader() {
  // Client queries own fetching and freshness after the initial server render.
  return null
}

export default function Page() {
  const { t } = useTranslation("services")
  const { t: common } = useTranslation()
  const location = useLocation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { services, items, reorder } = useServiceOrder()
  const { categories, categoryId, selectedCategory, removeCategory, editCategory } = useServiceCategoryControls()
  const [serviceDeleteTarget, setServiceDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [serviceDeleteOpen, setServiceDeleteOpen] = useState(false)
  const visibleItems = categoryId ? items.filter((service) => service.categoryId === categoryId) : items
  const canManage = useOrganizationPermission({ services: ["configure"] })
  const listRef = useRef<HTMLUListElement>(null)
  const title = common("routeTitles.services")
  const removeService = useMutation(trpc.service.delete.mutationOptions({
    onSuccess: async (_result, { id }) => {
      setServiceDeleteOpen(false)
      queryClient.setQueryData(trpc.service.list.queryKey(), (previous) => previous?.filter((service) => service.id !== id))
      queryClient.removeQueries(trpc.service.get.queryFilter({ id }))
      await Promise.all([
        queryClient.invalidateQueries(trpc.service.list.queryFilter()),
        queryClient.invalidateQueries(trpc.staff.get.queryFilter()),
        queryClient.invalidateQueries(trpc.team.list.queryFilter()),
        queryClient.invalidateQueries(trpc.team.getPerson.queryFilter()),
        queryClient.invalidateQueries(trpc.profile.getTeamProfile.queryFilter()),
        queryClient.invalidateQueries(trpc.service.categories.queryFilter()),
      ])
      toast.success(t("serviceDeleted"))
    },
    onError: () => toast.error(t("serviceDeleteError")),
  }))
  const addButton = <Button aria-label={common("routeActions.newService")} className="max-md:size-9 max-md:p-0" render={<Link to={`new${location.search}`} state={{ returnTo: `${location.pathname}${location.search}` }} />} size="lg" type="button"><Icon aria-hidden={true} name="add" size={18} /><span className="hidden md:inline">{common("routeActions.newService")}</span></Button>

  return <ScrollPage header={<RouteHeader title={title} description={common("routeDescriptions.services")} refreshing={services.isRefetching} showDescriptionOnMobile={false} controls={<ServiceCategoryControls />} actions={canManage ? addButton : null} />}>
    <title>{title}</title>
    <div className={cn("@container flex min-w-0 flex-col gap-4", (services.isPending || (!services.isError && visibleItems.length === 0)) && "min-h-0 flex-1")}>
    {categories.isError ? <Alert variant="error"><AlertTitle>{t("categoriesLoadError")}</AlertTitle><AlertDescription>{t("categoriesRetryDescription")}</AlertDescription><AlertAction><Button disabled={categories.isFetching} onClick={() => void categories.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : null}
    {services.isPending ? <div className="flex min-h-64 w-full flex-1 items-center justify-center"><Spinner aria-label={t("loading")} className="size-6" /></div> : services.isError ? (
      <Alert variant="error"><AlertTitle>{t("loadError")}</AlertTitle><AlertDescription>{t("listRetryDescription")}</AlertDescription><AlertAction><Button disabled={services.isFetching} onClick={() => void services.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert>
    ) : visibleItems.length === 0 ? (
      <Empty className="min-h-64 w-full flex-1 items-center justify-center border-0 bg-transparent">
        <EmptyHeader><EmptyMedia variant="icon"><Icon aria-hidden={true} name="forms" /></EmptyMedia><EmptyTitle>{t(categoryId ? "categoryEmpty" : "empty")}</EmptyTitle><EmptyDescription>{t(categoryId ? canManage ? "categoryEmptyDescription" : "categoryEmptyReadOnlyDescription" : "emptyDescription")}</EmptyDescription></EmptyHeader>
        {categoryId && canManage && selectedCategory ? <EmptyContent><Button disabled={removeCategory.isPending || removeService.isPending} onClick={editCategory} type="button" variant="outline"><Icon aria-hidden={true} name="edit" size={16} />{t("editCategory")}</Button></EmptyContent> : null}
      </Empty>
    ) : <>
      <DragDropProvider
        sensors={(defaults) => defaults.map((sensor) => sensor === PointerSensor ? PointerSensor.configure({ activationConstraints: (event) => event.pointerType === "touch" ? [new PointerActivationConstraints.Distance({ value: 8 })] : undefined }) : sensor)}
        plugins={(defaults) => [...defaults, Feedback.configure({ dropAnimation: null })]}
        onDragEnd={(event) => {
          if (event.canceled || !canManage || removeCategory.isPending || removeService.isPending) return
          const { source } = event.operation
          if (!isSortable(source) || source.initialIndex === source.index) return
          const nextVisible = [...visibleItems]
          const [moved] = nextVisible.splice(source.initialIndex, 1)
          if (!moved) return
          nextVisible.splice(source.index, 0, moved)
          const visibleIds = new Set(nextVisible.map((service) => service.id))
          let visibleIndex = 0
          const next = items.map((service) => visibleIds.has(service.id) ? nextVisible[visibleIndex++] : service)
          reorder(next.map((service) => service.id))
        }}
      >
        <ul className="relative isolate z-0 flex flex-col gap-3" ref={listRef}>
          {visibleItems.map((service, index) => <SortableServiceListItem key={service.id} id={service.id} index={index} name={service.name} color={service.color} showHandle={canManage} disabled={!canManage || removeCategory.isPending || removeService.isPending || visibleItems.length < 2} containerRef={listRef} actions={canManage ? <ServiceActionsMenu id={service.id} name={service.name} disabled={removeCategory.isPending || removeService.isPending} onDelete={() => { setServiceDeleteTarget({ id: service.id, name: service.name }); setServiceDeleteOpen(true) }} /> : null}>
            <Link className="w-fit max-w-full wrap-anywhere text-balance text-sm font-medium outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring max-sm:flex max-sm:min-h-9 max-sm:items-center max-sm:text-base" draggable={false} to={`${service.id}${canManage ? "/edit" : ""}${location.search}`} state={{ returnTo: `${location.pathname}${location.search}` }}>{service.name}</Link>
            <ServiceListDetails service={service} />
          </SortableServiceListItem>)}
        </ul>
      </DragDropProvider>
    </>}
    </div>
    <DeleteConfirmationDialog cancelLabel={t("cancel")} closeOnConfirm={false} confirmLabel={t("deleteServiceAction")} description={t("serviceDeleteDescription")} isPending={removeService.isPending} onConfirm={() => { if (serviceDeleteTarget) removeService.mutate({ id: serviceDeleteTarget.id }) }} onOpenChange={setServiceDeleteOpen} open={serviceDeleteOpen} title={t("serviceDeleteTitle", { name: serviceDeleteTarget?.name ?? "" })} />
    <Outlet />
  </ScrollPage>
}
