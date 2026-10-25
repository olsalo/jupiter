import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { AppForm } from "~/components/forms/app-form"
import { BusinessHolidayFormFields } from "~/components/settings/business/business-holiday-form-fields"
import { Button } from "~/components/ui/button"
import { Dialog, DialogPopup, DialogHeader, DialogTitle, DialogDescription, DialogPanel, DialogFooter } from "~/components/ui/dialog"
import { Spinner } from "~/components/ui/spinner"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { generateId } from "~/lib/database/id"
import { businessHolidaySchema, type BusinessHolidayValues } from "~/lib/schemas/business-schedule"
import type { BusinessHoliday } from "~/lib/business/business-holidays"

export function BusinessHolidayDialog({ open, onOpenChange, holiday, holidays, timezone, flow, onSave, persist = true }: {
  persist?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  holiday?: BusinessHoliday
  holidays: BusinessHoliday[]
  timezone: string
  flow: number
  onSave: (holiday: BusinessHoliday) => void
}) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const mutation = useMutation(trpc.organizations.saveCustomBusinessHoliday.mutationOptions({
    onError: (error) => { if (!error.data?.zodError) toast.error(t("settings.saveError")) },
  }))
  const schema = businessHolidaySchema.superRefine((value, ctx) => {
    if (holidays.some((entry) => entry.id !== value.id && entry.enabled && entry.date.slice(5) === value.date.slice(5))) ctx.addIssue({ code: "custom", path: ["date"], message: t("businessSchedule.dateTaken") })
  })
  return <Dialog open={open} onOpenChange={(next) => { if (!mutation.isPending) onOpenChange(next) }}>
    <DialogPopup className="sm:max-w-md" forceBackdrop={true} onSubmit={(event) => event.stopPropagation()}>
      <DialogHeader>
        <DialogTitle>{t(holiday ? "businessSchedule.editHoliday" : "businessSchedule.addHoliday")}</DialogTitle>
        <DialogDescription>{t("businessSchedule.customDescription")}</DialogDescription>
      </DialogHeader>
      <AppForm<BusinessHolidayValues, BusinessHolidayValues, unknown>
        className="contents"
        defaultValues={holiday ?? { id: `custom-${generateId()}`, name: "", date: "", enabled: true, closed: true, startMinute: 540, endMinute: 1020 }}
        key={flow}
        schema={schema}
        submitFn={async (values) => {
          const saved = persist ? await mutation.mutateAsync(values) : values
          onSave(saved)
          if (persist) await Promise.all([
            queryClient.invalidateQueries(trpc.organizations.getCurrent.queryFilter()),
            queryClient.invalidateQueries(trpc.availability.pathFilter()),
            queryClient.invalidateQueries(trpc.booking.pathFilter()),
            queryClient.invalidateQueries(trpc.appointment.pathFilter()),
          ])
          onOpenChange(false)
        }}
      >{(form) => <>
        <DialogPanel><BusinessHolidayFormFields custom={true} form={form} timezone={timezone} /></DialogPanel>
        <DialogFooter>
          <Button disabled={form.formState.isSubmitting} onClick={() => onOpenChange(false)} type="button" variant="ghost">{t("settings.cancel")}</Button>
          <Button disabled={form.formState.isSubmitting} type="submit">{form.formState.isSubmitting ? <Spinner className="size-4" /> : null}{t(holiday ? "settings.save" : "businessSchedule.addHoliday")}</Button>
        </DialogFooter>
      </>}</AppForm>
    </DialogPopup>
  </Dialog>
}
