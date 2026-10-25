import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createContext, useContext, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router"

import { DeleteConfirmationDialog } from "~/components/overlays/delete-confirmation-dialog"
import Icon from "~/components/icons"
import { ServiceCategoryDialog } from "~/components/services/service-category-dialog"
import { ServiceCategoryMenu } from "~/components/services/service-category-menu"
import { Button } from "~/components/ui/button"
import { useIsMobile } from "~/lib/hooks"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { useOrganizationPermission } from "~/lib/hooks/use-organization-access"

function useCategoryState() {
  const { t } = useTranslation("services")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const services = useQuery(trpc.service.list.queryOptions())
  const categories = useQuery(trpc.service.categories.queryOptions())
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryId = searchParams.get("category") ?? ""
  const setCategoryId = (id: string) => setSearchParams((previous) => {
    const next = new URLSearchParams(previous)
    if (id) next.set("category", id)
    else next.delete("category")
    return next
  }, { replace: true, preventScrollReset: true })
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [categoryFlow, setCategoryFlow] = useState(0)
  const [categoryMode, setCategoryMode] = useState<"create" | "edit">("create")
  const categoryOptions = (categories.data ?? []).map((category) => ({ ...category, count: (services.data ?? []).filter((service) => service.categoryId === category.id).length }))
  const selectedCategory = categoryOptions.find((category) => category.id === categoryId)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const canManage = useOrganizationPermission({ services: ["configure"] })
  const serviceDeletePending = useIsMutating({ mutationKey: trpc.service.delete.mutationOptions().mutationKey }) > 0
  const removeCategory = useMutation(trpc.service.deleteCategory.mutationOptions({
    onSuccess: async (_result, { id }) => {
      setDeleteOpen(false)
      if (categoryId === id) setCategoryId("")
      queryClient.setQueryData(trpc.service.categories.queryKey(), (previous) => previous?.filter((category) => category.id !== id))
      queryClient.setQueryData(trpc.service.list.queryKey(), (previous) => previous?.map((service) => service.categoryId === id ? { ...service, categoryId: null } : service))
      await Promise.all([
        queryClient.invalidateQueries(trpc.service.categories.queryFilter()),
        queryClient.invalidateQueries(trpc.service.list.queryFilter()),
        queryClient.invalidateQueries({ ...trpc.service.get.queryFilter(), refetchType: "all" }),
      ])
      toast.success(t("categoryDeleted"))
    },
    onError: () => toast.error(t("categoryDeleteError")),
  }))
  const openCategory = (mode: "create" | "edit") => {
    setCategoryMode(mode)
    setCategoryFlow((flow) => flow + 1)
    setCategoryOpen(true)
  }

  return { services, categories, categoryId, setCategoryId, categoryOptions, selectedCategory, canManage, serviceDeletePending, removeCategory, editCategory: () => openCategory("edit"), createCategory: () => openCategory("create"), categoryOpen, setCategoryOpen, categoryFlow, categoryMode, deleteTarget, setDeleteTarget, deleteOpen, setDeleteOpen }
}

const ServiceCategoryContext = createContext<ReturnType<typeof useCategoryState> | null>(null)

export function ServiceCategoryProvider({ children }: { children: ReactNode }) {
  const state = useCategoryState()
  const { t } = useTranslation("services")
  return <ServiceCategoryContext.Provider value={state}>
    {children}
    {state.canManage ? <ServiceCategoryDialog open={state.categoryOpen} flow={state.categoryFlow} mode={state.categoryMode} initialCategoryId={state.categoryId || state.categoryOptions[0]?.id || ""} categories={state.categoryOptions} onOpenChange={state.setCategoryOpen} onSaved={state.setCategoryId} /> : null}
    <DeleteConfirmationDialog cancelLabel={t("cancel")} closeOnConfirm={false} confirmLabel={t("deleteCategory")} description={t("categoryDeleteDescription")} isPending={state.removeCategory.isPending} onConfirm={() => { if (state.deleteTarget) state.removeCategory.mutate({ id: state.deleteTarget.id }) }} onOpenChange={state.setDeleteOpen} open={state.deleteOpen} title={t("deleteCategoryTitle", { name: state.deleteTarget?.name ?? "" })} />
  </ServiceCategoryContext.Provider>
}

export function useServiceCategoryControls() {
  const state = useContext(ServiceCategoryContext)
  if (!state) throw new Error("Service category controls require ServiceCategoryProvider")
  return state
}

export function ServiceCategoryControls() {
  const { t } = useTranslation("services")
  const controlsRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const { services, categories, categoryId, setCategoryId, categoryOptions, selectedCategory, canManage, serviceDeletePending, removeCategory, editCategory, createCategory, setDeleteTarget, setDeleteOpen } = useServiceCategoryControls()
  const pending = removeCategory.isPending || serviceDeletePending
  return <div className="flex w-full min-w-0 max-w-full items-center gap-2 md:w-auto md:flex-row-reverse" data-slot="service-category-controls" ref={controlsRef}>
    <ServiceCategoryMenu categories={categoryOptions} totalCount={services.data?.length ?? 0} value={categoryId} onValueChange={setCategoryId} onCreate={createCategory} canManage={canManage} disabled={categories.isPending || pending} popupAnchor={isMobile ? controlsRef : undefined} />
    {canManage && selectedCategory ? <div className="flex shrink-0 items-center gap-2">
      <Button aria-label={t("editCategoryButton")} className="max-sm:size-9 max-sm:p-0" disabled={!services.isSuccess || pending} onClick={editCategory} size="lg" type="button" variant="outline"><Icon aria-hidden={true} name="edit" size={16} /><span className="hidden sm:inline">{t("editCategoryButton")}</span></Button>
      <Button aria-label={t("deleteCategoryButton")} className="max-sm:size-9 max-sm:p-0" disabled={pending} onClick={() => { setDeleteTarget({ id: selectedCategory.id, name: selectedCategory.name }); setDeleteOpen(true) }} size="lg" type="button" variant="destructive-outline"><Icon aria-hidden={true} name="trash" size={16} /><span className="hidden sm:inline">{t("deleteCategoryButton")}</span></Button>
    </div> : null}
  </div>
}
