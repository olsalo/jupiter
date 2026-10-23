import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { AppForm } from "~/components/app-form"
import FormLabel from "~/components/form-label"
import Icon from "~/components/icons"
import { PhoneInput } from "~/components/phone-input"
import { ResponsiveModal, ResponsiveModalClose, ResponsiveModalFooter, ResponsiveModalHeader, ResponsiveModalPanel, ResponsiveModalPopup, ResponsiveModalTitle } from "~/components/responsive-modal"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Input } from "~/components/ui/input"
import { calendarCustomerCreateSchema } from "~/lib/calendar/booking-schema"
import { calendarReferenceQueryOptions } from "~/lib/calendar/query-options"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

const defaultCustomerValues: { name: string; phone: string; email: string } = { name: "", phone: "", email: "" }

export function CreateCustomerDialog({ open, flow, onOpenChange, onCreated }: {
  open: boolean
  flow: number
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const create = useMutation(trpc.customer.create.mutationOptions())
  const organization = useQuery({ ...trpc.organizations.getCurrent.queryOptions(), ...calendarReferenceQueryOptions, enabled: open })

  return <ResponsiveModal open={open} onOpenChange={(nextOpen) => {
    if (!create.isPending) onOpenChange(nextOpen)
  }}>
    <ResponsiveModalPopup forceBackdrop={true}>
      <ResponsiveModalHeader><ResponsiveModalTitle>{t("bookingForm.newCustomer")}</ResponsiveModalTitle></ResponsiveModalHeader>
      <AppForm
        className="contents"
        defaultValues={defaultCustomerValues}
        key={flow}
        schema={calendarCustomerCreateSchema}
        submitFn={async ({ name, ...contact }) => {
          try {
            const customer = await create.mutateAsync({ firstName: name, ...contact })
            queryClient.setQueryData(trpc.customer.get.queryKey({ id: customer.id }), { ...customer, appointments: { upcoming: { items: [], nextCursor: undefined }, history: { items: [], nextCursor: undefined }, recent: { items: [], nextCursor: undefined } } })
            await queryClient.invalidateQueries({ ...trpc.customer.list.queryFilter(), refetchType: "none" })
            onCreated(customer.id)
            onOpenChange(false)
          } catch (error) {
            toast.error(t("bookingForm.customerSaveError"))
            throw error
          }
        }}
      >
        {(form) => {
          const phone = form.getControlProps("phone")
          return <>
          <ResponsiveModalPanel className="flex flex-col gap-5">
            {(["name", "phone", "email"] as const).map((field) => <FormLabel error={form.error(field)} key={field} label={<>{t(`bookingForm.${field}`)}{field !== "name" ? <Badge className="font-normal" size="sm" variant="secondary">{t("bookingForm.optional")}</Badge> : null}</>}>
              {field === "phone" ? <PhoneInput country={organization.data?.settings?.countryCode} disabled={form.formState.isSubmitting || organization.isPending} invalid={Boolean(form.error("phone"))} name={phone.name} onBlur={phone.onBlur} onChange={phone.onChange} placeholder={t("bookingForm.phonePlaceholder")} ref={phone.ref} value={phone.value} /> : <Input {...form.getInputProps(field)} aria-invalid={Boolean(form.error(field))} autoComplete={field} disabled={form.formState.isSubmitting} inputMode={field === "email" ? "email" : "text"} placeholder={t(`bookingForm.${field}Placeholder`)} type="text" />}
            </FormLabel>)}
          </ResponsiveModalPanel>
          <ResponsiveModalFooter variant="default">
            <ResponsiveModalClose render={<Button disabled={form.formState.isSubmitting} type="button" variant="ghost" />}>{t("settings.cancel")}</ResponsiveModalClose>
            <Button disabled={form.formState.isSubmitting} loading={form.formState.isSubmitting} type="submit"><Icon aria-hidden={true} name="plus" size={16} />{t("bookingForm.addCustomer")}</Button>
          </ResponsiveModalFooter>
        </>}}
      </AppForm>
    </ResponsiveModalPopup>
  </ResponsiveModal>
}
