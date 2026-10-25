import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { AppForm } from "~/components/forms/app-form"
import { Button } from "~/components/ui/button"
import { Dialog, DialogPopup, DialogHeader, DialogTitle, DialogDescription, DialogPanel, DialogFooter } from "~/components/ui/dialog"
import { TeamTimeOffFields } from "./team-time-off-fields"
import { Spinner } from "~/components/ui/spinner"
import { timeOffSchema, type TimeOffValues } from "~/lib/team/team-time-off"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

export function TeamTimeOffDialog({ staffMemberId, timezone, open, onOpenChange, flow, self = false }: {
  staffMemberId: string
  timezone: string
  open: boolean
  onOpenChange: (open: boolean) => void
  self?: boolean
  flow: number
}) {
  const [submitting, setSubmitting] = useState(false)
  const { t } = useTranslation("team")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const createOwn = useMutation(trpc.profile.addTimeOff.mutationOptions())
  const create = useMutation(trpc.availability.addTimeOff.mutationOptions())
  const schema = useMemo(() => timeOffSchema({ date: t("timeOff.dateInvalid"), title: t("timeOff.titleRequired"), end: t("timeOff.endError"), repeat: t("timeOff.repeatError") }), [t])

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next) }}>
      <DialogPopup className="sm:max-w-md" forceBackdrop={true}>
        <DialogHeader>
          <DialogTitle>{t("timeOff.addTitle")}</DialogTitle>
          <DialogDescription>{t("timeOff.description")}</DialogDescription>
        </DialogHeader>
        <AppForm<TimeOffValues, TimeOffValues, unknown> key={flow} className="contents" schema={schema} onFormStateChange={(state) => setSubmitting(state.isSubmitting)}
          defaultValues={{ title: "", startDate: "", endDate: "", allDay: true, startTime: "09:00", endTime: "17:00", repeat: "none", repeatUntil: "" }}
          submitFn={async (values) => {
            try {
              const result = await (self ? createOwn.mutateAsync(values) : create.mutateAsync({ ...values, staffMemberId }))
              await Promise.all([
                queryClient.invalidateQueries(trpc.availability.getTimeOff.queryFilter({ staffMemberId })),
                queryClient.invalidateQueries(trpc.availability.listBlockedTime.queryFilter()),
                queryClient.invalidateQueries(trpc.availability.calendarSchedule.queryFilter()),
                queryClient.invalidateQueries(trpc.appointment.getBookingTimes.queryFilter()),
                queryClient.invalidateQueries(trpc.appointment.getSlots.queryFilter()),
                queryClient.invalidateQueries(trpc.availability.getSlots.queryFilter()),
                queryClient.invalidateQueries(trpc.availability.getBookingTimes.queryFilter()),
                queryClient.invalidateQueries(trpc.appointment.list.queryFilter()),
                queryClient.invalidateQueries(trpc.appointment.get.queryFilter()),
              ])
              onOpenChange(false)
              toast.success(t("timeOff.added"))
              return result
            } catch (error) {
              toast.error(t("timeOff.saveError"))
              throw error
            }
          }}>
          {(form) => {
            const pending = form.formState.isSubmitting
            return <>
              <DialogPanel className="grid gap-5">
                <TeamTimeOffFields form={form} timezone={timezone} />
              </DialogPanel>
              <DialogFooter>
                <Button disabled={pending} onClick={() => onOpenChange(false)} type="button" variant="ghost">{t("cancel")}</Button>
                <Button disabled={pending} type="submit">{pending ? <Spinner /> : null}{t(pending ? "timeOff.adding" : "timeOff.addButton")}</Button>
              </DialogFooter>
            </>
          }}
        </AppForm>
      </DialogPopup>
    </Dialog>
  )
}
