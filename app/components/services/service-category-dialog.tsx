import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useId, useMemo, useState, type Ref } from "react"
import { useTranslation } from "react-i18next"

import { AppForm } from "~/components/app-form"
import FormLabel from "~/components/form-label"
import Icon from "~/components/icons"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Checkbox } from "~/components/ui/checkbox"
import { CheckboxGroup } from "~/components/ui/checkbox-group"
import { ResponsiveSheet, ResponsiveSheetPopup, ResponsiveSheetHeader, ResponsiveSheetTitle, ResponsiveSheetDescription, ResponsiveSheetPanel, ResponsiveSheetFooter } from "~/components/responsive-sheet"
import { Input } from "~/components/ui/input"
import { FieldItem } from "~/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group"
import { Label } from "~/components/ui/label"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { serviceCategorySchema, type ServiceCategoryValues } from "~/lib/schemas/services"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { cn } from "~/lib/utils"

type ServiceCategoryDialogProps = {
  open: boolean
  flow: number
  mode?: "create" | "edit"
  initialCategoryId?: string
  categories?: { id: string; name: string; count: number }[]
  onOpenChange: (open: boolean) => void
  onSaved: (id: string) => void
}

export function ServiceCategoryDialog(props: ServiceCategoryDialogProps) {
  return <ServiceCategoryDialogSession key={props.flow} {...props} />
}

function ServiceCategoryDialogSession({ open, flow, mode = "create", initialCategoryId = "", categories = [], onOpenChange, onSaved }: ServiceCategoryDialogProps) {
  const { t } = useTranslation("services")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const services = useQuery(trpc.service.list.queryOptions())
  const create = useMutation(trpc.service.createCategory.mutationOptions())
  const update = useMutation(trpc.service.updateCategory.mutationOptions())
  const titleId = useId()
  const descriptionId = useId()
  const editing = mode === "edit"
  const categoryValues = (id: string): ServiceCategoryValues => ({
    name: editing ? categories.find((category) => category.id === id)?.name ?? "" : "",
    serviceIds: editing ? (services.data ?? []).filter((service) => service.categoryId === id).map((service) => service.id) : [],
  })
  const [selection, setSelection] = useState(() => ({ id: initialCategoryId, values: categoryValues(initialCategoryId) }))
  const selectedId = selection.id
  const selectedCategory = categories.find((category) => category.id === selectedId)
  const categoryItems = categories.map((category) => ({ value: category.id, label: category.name }))
  const schema = useMemo(() => serviceCategorySchema((key) => t(key)), [t])
  const [submitting, setSubmitting] = useState(false)

  return <ResponsiveSheet deferClose={false} open={open} onOpenChange={(next) => { if (!submitting && !create.isPending && !update.isPending) onOpenChange(next) }}>
    <ResponsiveSheetPopup className="h-full sm:max-w-xl" closeLabel={t("close")} descriptionId={descriptionId} drawerClassName="max-sm:h-[calc(100dvh-3rem)]" open={open} side="right" titleId={titleId} variant="inset">
      <ResponsiveSheetHeader className="shrink-0"><ResponsiveSheetTitle id={titleId}>{t(editing ? "editCategory" : "newCategory")}</ResponsiveSheetTitle><ResponsiveSheetDescription id={descriptionId}>{t(editing ? "categoryEditDescription" : "categoryServicesDescription")}</ResponsiveSheetDescription></ResponsiveSheetHeader>
      <AppForm<ServiceCategoryValues, ServiceCategoryValues, unknown> className="contents" key={editing ? selectedId : flow} defaultValues={selection.values} schema={schema} onFormStateChange={(state) => setSubmitting(state.isSubmitting)} submitFn={async (values) => {
        try {
          const category = editing ? await update.mutateAsync({ ...values, id: selectedId }) : await create.mutateAsync(values)
          queryClient.setQueryData(trpc.service.categories.queryKey(), (previous) => editing ? (previous ?? []).map((item) => item.id === category.id ? category : item) : [...(previous ?? []), category])
          await Promise.all([
            queryClient.invalidateQueries(trpc.service.categories.queryFilter()),
            queryClient.invalidateQueries(trpc.service.list.queryFilter()),
            queryClient.invalidateQueries({ ...trpc.service.get.queryFilter(), refetchType: "all" }),
          ])
          onSaved(category.id)
          onOpenChange(false)
          toast.success(t(editing ? "categoryUpdated" : "categoryCreated"))
          return category
        } catch (error) {
          if (!(error as { data?: { zodError?: unknown } }).data?.zodError) toast.error(t(editing ? "categoryUpdateError" : "categoryCreateError"))
          throw error
        }
      }}>
        {(form) => {
          const saving = form.formState.isSubmitting
          const pending = saving
          const control = form.getControlProps("serviceIds")
          return <>
            <ResponsiveSheetPanel className="flex min-h-0 flex-1 flex-col gap-5" scrollable={false}>
              {editing ? <FormLabel className="shrink-0" label={t("category")}>
                <Select items={categoryItems} value={selectedId} onValueChange={(id) => { if (id) setSelection({ id, values: categoryValues(id) }) }} disabled={pending}>
                  <SelectTrigger aria-label={t("category")}><SelectValue /></SelectTrigger>
                  <SelectPopup>{categories.map((category) => <SelectItem key={category.id} value={category.id}><span className="flex w-full min-w-0 items-center justify-between gap-2"><span className="truncate">{category.name}</span><Badge className="tabular-nums" size="sm" variant="secondary">{category.count}</Badge></span></SelectItem>)}</SelectPopup>
                </Select>
              </FormLabel> : null}
              <FormLabel className="shrink-0" label={t("categoryName")} error={form.error("name") === "categoryNameTaken" ? t("categoryNameTaken") : form.error("name")}>
                <Input {...form.getInputProps("name")} aria-invalid={Boolean(form.error("name"))} disabled={pending} placeholder={t("categoryNamePlaceholder")} type="text" />
              </FormLabel>
              <FormLabel className="min-h-0 flex-1 items-stretch" label={t("categoryServices")} error={form.error("serviceIds") === "invalidAssignment" ? t("invalidAssignment") : form.error("serviceIds")} errorPlacement="below">
                {services.isPending ? <div className="flex min-h-0 flex-1 items-center justify-center"><Spinner aria-label={t("loading")} /></div> : services.isError ? <Alert variant="error"><AlertTitle>{t("loadError")}</AlertTitle><AlertDescription>{t("listRetryDescription")}</AlertDescription><AlertAction><Button disabled={services.isFetching} onClick={() => void services.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : <CategoryServiceSelection key={flow} services={services.data} value={control.value} onChange={control.onChange} onBlur={control.onBlur} inputRef={control.ref} disabled={pending} invalid={Boolean(form.error("serviceIds"))} />}
              </FormLabel>
            </ResponsiveSheetPanel>
            {!services.isPending ? <ResponsiveSheetFooter className="shrink-0"><Button disabled={pending} onClick={() => onOpenChange(false)} type="button" variant="ghost">{t("cancel")}</Button><Button disabled={pending || !services.isSuccess || (editing && !selectedCategory)} loading={saving} type="submit">{t(editing ? saving ? "categorySaving" : "saveCategory" : saving ? "categoryCreating" : "createCategory")}</Button></ResponsiveSheetFooter> : null}
          </>
        }}
      </AppForm>
    </ResponsiveSheetPopup>
  </ResponsiveSheet>
}

function CategoryServiceSelection({ services, value, onChange, onBlur, inputRef, disabled, invalid }: {
  services: { id: string; name: string; durationMinutes: number }[]
  value: string[]
  onChange: (value: string[]) => void
  onBlur: () => void
  inputRef: Ref<HTMLInputElement>
  disabled: boolean
  invalid: boolean
}) {
  const { t } = useTranslation("services")
  const [search, setSearch] = useState("")
  const term = search.trim().toLocaleLowerCase()
  const filtered = services.filter((service) => service.name.toLocaleLowerCase().includes(term))
  const filteredIds = new Set(filtered.map((service) => service.id))
  const selectedCount = value.filter((id) => filteredIds.has(id)).length
  const allSelected = filtered.length > 0 && selectedCount === filtered.length

  return <div className={cn("flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border", invalid && "border-destructive/64")}>
    <div className="shrink-0 p-3"><InputGroup><InputGroupInput aria-label={t("searchServices")} aria-invalid={invalid} disabled={disabled} nativeInput={true} onBlur={onBlur} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchServices")} ref={inputRef} type="search" value={search} /><InputGroupAddon><Icon aria-hidden={true} name="search" size={16} /></InputGroupAddon></InputGroup></div>
    <ScrollArea className="h-auto min-h-0 flex-1" fill={filtered.length === 0} overscrollContain={true} scrollFade={true}>
    <CheckboxGroup aria-label={t("categoryServices")} aria-invalid={invalid} className={cn("items-stretch gap-2 p-2", filtered.length === 0 && "h-full justify-center")} value={value} onValueChange={onChange}>
      {filtered.length ? filtered.map((service) => <FieldItem className="w-full" key={service.id}><Label className="flex h-11 w-full cursor-pointer gap-3 rounded-md px-2 py-2 font-normal hover:bg-muted/60 has-data-checked:bg-muted/60">
        <Checkbox aria-invalid={invalid} disabled={disabled} onBlur={onBlur} value={service.id} />
        <span className="min-w-0 flex-1 truncate text-sm" title={service.name}>{service.name}</span><span className="shrink-0 text-xs text-muted-foreground">{service.durationMinutes} {t("minutes")}</span>
      </Label></FieldItem>) : <p className="px-3 py-10 text-center text-sm text-muted-foreground">{t(term ? "noServiceMatches" : "empty")}</p>}
    </CheckboxGroup>
    </ScrollArea>
    {services.length > 0 ? <div className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3">
      <FieldItem className="shrink-0"><Label className="cursor-pointer gap-3 text-xs font-normal">
        <Checkbox checked={allSelected} disabled={disabled || filtered.length === 0} indeterminate={selectedCount > 0 && !allSelected} onBlur={onBlur} onCheckedChange={(checked) => onChange(checked ? [...new Set([...value, ...filteredIds])] : value.filter((id) => !filteredIds.has(id)))} />
        {t("selectAllServices")}
      </Label></FieldItem>
      <p className="text-right text-xs text-muted-foreground" role="status">{t("selectedServices", { count: value.length })}</p>
    </div> : null}
  </div>
}
