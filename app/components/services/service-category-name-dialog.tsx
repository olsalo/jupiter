import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { AppForm } from "~/components/forms/app-form"
import FormLabel from "~/components/forms/form-label"
import { ResponsiveModal, ResponsiveModalPopup, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalPanel, ResponsiveModalFooter } from "~/components/overlays/responsive-modal"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { serviceCategorySchema } from "~/lib/schemas/services"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

type Props = {
  open: boolean
  flow: number
  onOpenChange: (open: boolean) => void
  onSaved: (id: string) => void
}

export function ServiceCategoryNameDialog(props: Props) {
  return <CategoryNameSession key={props.flow} {...props} />
}

function CategoryNameSession({ open, onOpenChange, onSaved }: Props) {
  const { t } = useTranslation("services")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const create = useMutation(trpc.service.createCategory.mutationOptions())
  const schema = useMemo(() => serviceCategorySchema((key) => t(key)).pick({ name: true }), [t])
  const titleId = useId()
  const [submitting, setSubmitting] = useState(false)
  const pending = submitting || create.isPending

  return <ResponsiveModal open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next) }}>
    <ResponsiveModalPopup forceBackdrop={true} showCloseButton={false} titleId={titleId}>
      <ResponsiveModalHeader><ResponsiveModalTitle id={titleId}>{t("newCategory")}</ResponsiveModalTitle></ResponsiveModalHeader>
      <AppForm<{ name: string }, { name: string }, unknown> className="contents" defaultValues={{ name: "" }} schema={schema} onFormStateChange={(state) => setSubmitting(state.isSubmitting)} submitFn={async (values) => {
        try {
          const category = await create.mutateAsync({ ...values, serviceIds: [] })
          queryClient.setQueryData(trpc.service.categories.queryKey(), (previous) => [...(previous ?? []), category])
          onSaved(category.id)
          onOpenChange(false)
          void queryClient.invalidateQueries(trpc.service.categories.queryFilter())
          toast.success(t("categoryCreated"))
          return category
        } catch (error) {
          if (!(error as { data?: { zodError?: unknown } }).data?.zodError) toast.error(t("categoryCreateError"))
          throw error
        }
      }}>
        {(form) => <>
          <ResponsiveModalPanel>
            <FormLabel label={t("categoryName")} error={form.error("name") === "categoryNameTaken" ? t("categoryNameTaken") : form.error("name")}>
              <Input {...form.getInputProps("name")} aria-invalid={Boolean(form.error("name"))} autoComplete="off" disabled={pending} placeholder={t("categoryNamePlaceholder")} type="text" />
            </FormLabel>
          </ResponsiveModalPanel>
          <ResponsiveModalFooter><Button disabled={pending} onClick={() => onOpenChange(false)} type="button" variant="ghost">{t("cancel")}</Button><Button disabled={pending} loading={pending} type="submit">{t(pending ? "categorySaving" : "saveNewCategory")}</Button></ResponsiveModalFooter>
        </>}
      </AppForm>
    </ResponsiveModalPopup>
  </ResponsiveModal>
}
