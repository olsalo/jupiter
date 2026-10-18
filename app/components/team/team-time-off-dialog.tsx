import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import { AppForm } from "~/components/app-form"
import { DatePicker } from "~/components/date-picker"
import FormLabel from "~/components/form-label"
import { FormSwitch } from "~/components/form-switch"
import { TimePicker } from "~/components/time-picker"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Dialog, DialogPopup, DialogHeader, DialogTitle, DialogDescription, DialogPanel, DialogFooter } from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { timeOffSchema, type TimeOffValues } from "~/lib/team-time-off"
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
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const createOwn = useMutation(trpc.profile.addTimeOff.mutationOptions())
  const create = useMutation(trpc.availability.addTimeOff.mutationOptions())
  const schema = useMemo(() => timeOffSchema({ date: t("timeOff.dateInvalid"), title: t("timeOff.titleRequired"), end: t("timeOff.endError"), repeat: t("timeOff.repeatError") }), [t])
  const language = root?.locale === "fi" ? "fi" : "en"
  const formatPreference = root?.formatPreference ?? "eu"
  const repeatItems = (["none", "weekly", "monthly", "yearly"] as const).map((value) => ({ value, label: t(`timeOff.repeatOptions.${value}`) }))

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
                queryClient.invalidateQueries(trpc.availability.getSlots.queryFilter()),
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
            const values = form.value()
            const pending = form.formState.isSubmitting
            const allDay = form.getControlProps("allDay")
            const repeat = form.getControlProps("repeat")
            const dateField = (field: "startDate" | "endDate" | "repeatUntil") => {
              const control = form.getControlProps(field)
              const label = t(`timeOff.${field}`)
              return <FormLabel error={form.error(field)} errorPlacement="below" label={field === "repeatUntil" ? <span className="inline-flex items-center gap-2">{label}<Badge size="sm" variant="secondary">{t("timeOff.optional")}</Badge></span> : label} description={field === "repeatUntil" ? t("timeOff.repeatUntilDescription") : undefined}>
                <DatePicker clearLabel={t("timeOff.clearDate")} disabled={pending} formatPreference={formatPreference} inputRef={control.ref} invalid={Boolean(form.error(field))} label={label} language={language} onBlur={control.onBlur} onChange={(value) => control.onChange(value ?? "")} placeholder={t(field === "repeatUntil" ? "timeOff.noEndDate" : "timeOff.chooseDate")} timeZone={timezone} value={control.value || null} />
              </FormLabel>
            }
            return <>
              <DialogPanel className="grid gap-5">
                <FormLabel error={form.error("title")} label={t("timeOff.title")}>
                  <Input {...form.getInputProps("title")} aria-invalid={Boolean(form.error("title"))} disabled={pending} placeholder={t("timeOff.placeholder")} type="text" />
                </FormLabel>
                <div className="grid grid-cols-2 gap-4">{dateField("startDate")}{dateField("endDate")}</div>
                <FormSwitch checked={!allDay.value} disabled={pending} label={t("timeOff.specifyTimes")} onBlur={allDay.onBlur} onCheckedChange={(checked) => allDay.onChange(!checked)} ref={allDay.ref} />
                {!values.allDay ? <div className="grid grid-cols-2 gap-4">
                  {(["startTime", "endTime"] as const).map((field) => {
                    const control = form.getControlProps(field)
                    const label = t(`timeOff.${field}`)
                    return <FormLabel key={field} error={form.error(field)} errorPlacement="below" label={label}>
                      <TimePicker disabled={pending} formatPreference={formatPreference} inputRef={control.ref} intervalMinutes={15} invalid={Boolean(form.error(field))} label={label} language={language} onBlur={control.onBlur} onChange={control.onChange} value={control.value} />
                    </FormLabel>
                  })}
                </div> : null}
                <FormLabel label={t("timeOff.repeat")} error={form.error("repeat")}>
                  <Select disabled={pending} items={repeatItems} value={repeat.value} onValueChange={(value) => { if (value) repeat.onChange(value) }}>
                    <SelectTrigger aria-invalid={Boolean(form.error("repeat")) || undefined} onBlur={repeat.onBlur} ref={repeat.ref}><SelectValue /></SelectTrigger>
                    <SelectPopup>{repeatItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectPopup>
                  </Select>
                </FormLabel>
                {values.repeat !== "none" ? dateField("repeatUntil") : null}
              </DialogPanel>
              <DialogFooter>
                <Button disabled={pending} onClick={() => onOpenChange(false)} type="button" variant="ghost">{t("cancel")}</Button>
                <Button disabled={pending || !values.title.trim()} type="submit">{pending ? <Spinner /> : null}{t(pending ? "timeOff.adding" : "timeOff.addButton")}</Button>
              </DialogFooter>
            </>
          }}
        </AppForm>
      </DialogPopup>
    </Dialog>
  )
}
