import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { AppForm } from "~/components/forms/app-form"
import FormLabel from "~/components/forms/form-label"
import { ResponsiveModal, ResponsiveModalDescription, ResponsiveModalFooter, ResponsiveModalHeader, ResponsiveModalPanel, ResponsiveModalPopup, ResponsiveModalTitle } from "~/components/overlays/responsive-modal"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import { CheckboxGroup } from "~/components/ui/checkbox-group"
import { FieldItem, FieldLabel } from "~/components/ui/field"
import { z } from "~/lib/validation/zod"

export function BillingMemberSelection({ open, onOpenChange, members, count, onConfirm }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: { id: string; name: string }[]
  count: number
  onConfirm: (ids: string[]) => Promise<void>
}) {
  const { t } = useTranslation()
  const submitting = useRef(false)
  const schema = z.object({ ids: z.array(z.string()).length(count, t("settings.billingDisableMembersCount", { count })) })

  return <ResponsiveModal open={open} onOpenChange={(next) => {
    if (!submitting.current) onOpenChange(next)
  }}>
    <ResponsiveModalPopup className="sm:max-w-md" forceBackdrop={true}>
      <ResponsiveModalHeader>
        <ResponsiveModalTitle>{t("settings.billingDisableMembersTitle")}</ResponsiveModalTitle>
        <ResponsiveModalDescription>{t("settings.billingDisableMembersDescription", { count })}</ResponsiveModalDescription>
      </ResponsiveModalHeader>
      <AppForm
        className="contents"
        defaultValues={{ ids: [] as string[] }}
        schema={schema}
        onFormStateChange={(state) => { submitting.current = state.isSubmitting }}
        submitFn={async ({ ids }) => onConfirm(ids)}
      >
        {(form) => {
          const field = form.getControlProps("ids")
          const busy = form.formState.isSubmitting
          return <>
            <ResponsiveModalPanel>
              <FormLabel label={t("settings.billingDisableMembersLabel")} error={form.error("ids")} errorPlacement="below" errorClassName="whitespace-normal">
                <CheckboxGroup
                  aria-invalid={Boolean(form.error("ids"))}
                  className="w-full gap-2"
                  disabled={busy}
                  onBlur={field.onBlur}
                  onValueChange={(ids) => {
                    field.onChange(ids)
                    form.unstable_setCustomError("ids", null)
                  }}
                  ref={field.ref}
                  value={field.value}
                >
                  {members.map((member) => <FieldItem className="min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2 has-data-checked:border-primary/40 has-data-checked:bg-primary/5 has-data-disabled:opacity-50 has-data-disabled:[&_[data-slot=field-label]]:cursor-default" key={member.id}>
                    <Checkbox aria-invalid={Boolean(form.error("ids"))} disabled={busy || (!field.value.includes(member.id) && field.value.length >= count)} value={member.id} />
                    <FieldLabel className="min-w-0 flex-1 cursor-pointer break-words py-1 text-sm">{member.name}</FieldLabel>
                  </FieldItem>)}
                </CheckboxGroup>
              </FormLabel>
            </ResponsiveModalPanel>
            <ResponsiveModalFooter>
              <Button disabled={busy} onClick={() => onOpenChange(false)} type="button" variant="ghost">{t("settings.cancel")}</Button>
              <Button disabled={busy || field.value.length !== count} loading={busy} type="submit">{t("settings.billingDisableMembersConfirm")}</Button>
            </ResponsiveModalFooter>
          </>
        }}
      </AppForm>
    </ResponsiveModalPopup>
  </ResponsiveModal>
}
