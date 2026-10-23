import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { AppForm } from "~/components/app-form"
import FormLabel from "~/components/form-label"
import { PhoneInput } from "~/components/phone-input"
import { ResponsiveSheetFooter, ResponsiveSheetPanel } from "~/components/responsive-sheet"
import { Alert, AlertTitle } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { customerFormSchema } from "~/lib/schemas/customers"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { useOrganizationPermission } from "~/lib/use-organization-access"
import type { Customer } from "./customer-types"

export function CustomerForm({ customer, close, onPendingChange }: {
  customer?: Customer
  close: () => void | Promise<void>
  onPendingChange: (pending: boolean) => void
}) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const create = useMutation(trpc.customer.create.mutationOptions())
  const update = useMutation(trpc.customer.update.mutationOptions())
  const organization = useQuery(trpc.organizations.getCurrent.queryOptions())
  const canCreate = useOrganizationPermission({ customers: ["create"] })
  const canUpdate = useOrganizationPermission({ customers: ["update"] })

  if (!(customer ? canUpdate : canCreate)) return <ResponsiveSheetPanel><Alert variant="info"><AlertTitle>{t("customerPage.readOnly")}</AlertTitle></Alert></ResponsiveSheetPanel>

  return <AppForm
    className="flex min-h-0 flex-1 flex-col"
    defaultValues={{ firstName: customer?.firstName ?? "", lastName: customer?.lastName ?? "", email: customer?.email ?? "", phone: customer?.phone ?? "" }}
    onFormStateChange={({ isSubmitting }) => onPendingChange(isSubmitting)}
    schema={customerFormSchema}
    submitFn={async (values) => {
      let saved: Awaited<ReturnType<typeof create.mutateAsync>>
      try {
        saved = customer ? await update.mutateAsync({ id: customer.id, ...values }) : await create.mutateAsync(values)
      } catch (error) {
        toast.error(t("customerPage.saveError"))
        throw error
      }
      queryClient.setQueryData(trpc.customer.get.queryKey({ id: saved.id }), (previous) => previous ? { ...previous, ...saved } : undefined)
      await queryClient.invalidateQueries(trpc.customer.list.pathFilter())
      toast.success(t(customer ? "customerPage.saved" : "customerPage.created"))
      await close()
    }}
  >
    {(form) => {
      const phone = form.getControlProps("phone")
      return <>
        {customer ? <div className="shrink-0 border-b px-6 py-5"><h2 className="text-xl font-semibold">{t("customerPage.edit")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("customerPage.editDescription")}</p></div> : null}
        <ResponsiveSheetPanel className="flex flex-col gap-5" scrollFade={true}>
          {(["firstName", "lastName", "email", "phone"] as const).map((field) => <FormLabel error={form.error(field)} key={field} label={<>{t(`customerPage.${field}`)}{field !== "firstName" ? <Badge className="font-normal" size="sm" variant="secondary">{t("bookingForm.optional")}</Badge> : null}</>}>
            {field === "phone" ? <PhoneInput country={organization.data?.settings?.countryCode} disabled={form.formState.isSubmitting || organization.isPending} invalid={Boolean(form.error(field))} name={phone.name} onBlur={phone.onBlur} onChange={phone.onChange} ref={phone.ref} value={phone.value} /> : <Input {...form.getInputProps(field)} aria-invalid={Boolean(form.error(field))} autoComplete={field === "firstName" ? "given-name" : field === "lastName" ? "family-name" : "email"} disabled={form.formState.isSubmitting} inputMode={field === "email" ? "email" : "text"} type="text" />}
          </FormLabel>)}
        </ResponsiveSheetPanel>
        <ResponsiveSheetFooter className={customer ? "sm:bg-transparent" : undefined}>
          <Button disabled={form.formState.isSubmitting} onClick={() => void close()} type="button" variant="ghost">{t("customerPage.cancel")}</Button>
          <Button disabled={form.formState.isSubmitting} loading={form.formState.isSubmitting} type="submit">{t(customer ? "customerPage.save" : "customerPage.add")}</Button>
        </ResponsiveSheetFooter>
      </>
    }}
  </AppForm>
}
