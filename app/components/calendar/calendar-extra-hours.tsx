import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import { AppForm } from "~/components/app-form"
import { DatePicker } from "~/components/date-picker"
import { DeleteConfirmationDialog } from "~/components/delete-confirmation-dialog"
import FormLabel from "~/components/form-label"
import Icon from "~/components/icons"
import { IconListItem } from "~/components/icon-list-item"
import { ResponsiveSheetPanel, ResponsiveSheetFooter } from "~/components/responsive-sheet"
import { TimePicker } from "~/components/time-picker"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Button } from "~/components/ui/button"
import { Dialog, DialogPopup, DialogHeader, DialogTitle, DialogDescription, DialogPanel, DialogFooter } from "~/components/ui/dialog"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "~/components/ui/empty"
import { Spinner } from "~/components/ui/spinner"
import { formatDateTime } from "~/lib/format-preference"
import { extraHoursInterval, extraHoursSchema, type ExtraHoursValues } from "~/lib/schemas/calendar-extra-hours"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

export function CalendarExtraHours({ staffMemberId, timezone, close, onBusyChange }: {
  staffMemberId: string
  timezone: string
  close: () => void
  onBusyChange: (busy: boolean) => void
}) {
  const { t } = useTranslation()
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const entries = useQuery(trpc.availability.getExtraHours.queryOptions({ staffMemberId }))
  const create = useMutation(trpc.availability.createOverride.mutationOptions())
  const remove = useMutation(trpc.availability.deleteOverride.mutationOptions())
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [flow, setFlow] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const language = root?.locale === "fi" ? "fi" : "en"
  const formatPreference = root?.formatPreference ?? "eu"
  const pending = submitting || create.isPending || remove.isPending
  const busy = open || removingId !== null || pending
  useEffect(() => { onBusyChange(busy) }, [busy, onBusyChange])
  useEffect(() => () => onBusyChange(false), [onBusyChange])
  const schema = extraHoursSchema({ date: t("team:timeOff.dateInvalid"), time: t("team:timeOff.dateInvalid"), end: t("team:timeOff.endError") })
  const format = (date: Date, includeTime = true, includeDate = true) => formatDateTime(date, { formatPreference, language, timeZone: timezone, includeTime, includeDate })
  const refresh = () => Promise.all([
    queryClient.invalidateQueries(trpc.availability.getExtraHours.queryFilter({ staffMemberId })),
    queryClient.invalidateQueries(trpc.availability.listOverrides.queryFilter()),
    queryClient.invalidateQueries(trpc.availability.calendarSchedule.queryFilter()),
    queryClient.invalidateQueries(trpc.availability.getSlots.queryFilter()),
    queryClient.invalidateQueries(trpc.availability.getBookingTimes.queryFilter()),
    queryClient.invalidateQueries(trpc.appointment.getSlots.queryFilter()),
    queryClient.invalidateQueries(trpc.appointment.getBookingTimes.queryFilter()),
    queryClient.invalidateQueries(trpc.appointment.list.queryFilter()),
    queryClient.invalidateQueries(trpc.appointment.get.queryFilter()),
  ])
  const add = () => { setFlow((version) => version + 1); setOpen(true) }
  const addButton = <Button onClick={add} size="sm" type="button" variant="outline"><Icon aria-hidden={true} name="plus" size={16} />{t("calendarExtraHours.add")}</Button>

  return <>
    <ScrollArea fill={true}>
      <ResponsiveSheetPanel className="flex min-h-full flex-col" scrollable={false}>
        <section aria-labelledby={titleId} className="flex flex-1 flex-col gap-4">
          <div className="flex items-center justify-between gap-4"><h3 className="text-sm font-medium" id={titleId}>{t("calendarExtraHours.tab")}</h3><span className="shrink-0">{addButton}</span></div>
          {entries.isPending ? <div className="flex flex-1 items-center justify-center py-6"><Spinner aria-label={t("loading")} /></div> : entries.isError ? <Alert variant="error"><AlertTitle>{t("calendarExtraHours.loadError")}</AlertTitle><AlertDescription>{t("team:retryDescription")}</AlertDescription><AlertAction><Button disabled={entries.isFetching} onClick={() => void entries.refetch()} size="sm" type="button" variant="outline">{t("team:retry")}</Button></AlertAction></Alert> : entries.data.length === 0 ? <Empty className="min-h-0 w-full flex-1 border-0 bg-transparent px-4 py-3 md:px-4 md:py-3">
            <EmptyHeader className="mx-auto"><EmptyMedia className="mb-3" variant="icon"><Icon aria-hidden={true} name="calendarEvent" /></EmptyMedia><EmptyTitle className="text-sm">{t("calendarExtraHours.empty")}</EmptyTitle><EmptyDescription>{t("calendarExtraHours.emptyDescription")}</EmptyDescription></EmptyHeader>
          </Empty> : <ul className="flex flex-col gap-3">{entries.data.map((entry) => <IconListItem icon="calendarEvent" key={entry.id} actions={<Menu>
            <MenuTrigger aria-label={t("calendarExtraHours.actionsFor", { date: format(entry.startsAt, false) })} render={<Button size="icon" type="button" variant="ghost" />}><Icon aria-hidden={true} className="size-4.5 sm:size-4" name="dotsVertical" size={18} /></MenuTrigger>
            <MenuPopup align="end" className="min-w-48" sideOffset={6}><MenuItem closeOnClick={true} onClick={() => setRemovingId(entry.id)} variant="destructive"><Icon aria-hidden={true} name="delete" />{t("calendarExtraHours.remove")}</MenuItem></MenuPopup>
          </Menu>}>
            <span className="break-words text-sm font-medium">{format(entry.startsAt, false)}</span>
            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{t("team:timeOff.timed")}</Badge><span className="text-xs leading-relaxed text-muted-foreground">{format(entry.startsAt, true, false)} – {format(entry.endsAt, true, false)}</span></div>
          </IconListItem>)}</ul>}
        </section>
      </ResponsiveSheetPanel>
    </ScrollArea>
    <ResponsiveSheetFooter><Button disabled={busy} onClick={close} type="button" variant="ghost">{t("team:people.close")}</Button></ResponsiveSheetFooter>
    <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next) }}>
      <DialogPopup className="sm:max-w-md" forceBackdrop={true}>
        <DialogHeader><DialogTitle>{t("calendarExtraHours.add")}</DialogTitle><DialogDescription>{t("calendarExtraHours.description")}</DialogDescription></DialogHeader>
        <AppForm<ExtraHoursValues, ExtraHoursValues, unknown> key={flow} className="contents" schema={schema} defaultValues={{ date: "", startTime: "09:00", endTime: "17:00" }} onFormStateChange={(state) => setSubmitting(state.isSubmitting)} submitFn={async (values) => {
          try {
            const result = await create.mutateAsync({ staffMemberId, ...extraHoursInterval(values, timezone), isAvailable: true })
            await refresh()
            setOpen(false)
            toast.success(t("calendarExtraHours.added"))
            return result
          } catch (error) {
            if ((error as { data?: { code?: string } }).data?.code === "CONFLICT") throw Object.assign(error as object, { errors: { date: t("calendarExtraHours.conflict") } })
            toast.error(t("calendarExtraHours.saveError"))
            throw error
          }
        }}>
          {(form) => <>
            <DialogPanel className="grid gap-5">
              <FormLabel error={form.error("date")} errorPlacement="below" label={t("calendarExtraHours.date")}>
                <DatePicker clearLabel={t("team:timeOff.clearDate")} disabled={pending} disablePast={true} formatPreference={formatPreference} inputRef={form.getControlProps("date").ref} invalid={Boolean(form.error("date"))} label={t("calendarExtraHours.date")} language={language} onBlur={form.getControlProps("date").onBlur} onChange={(date) => form.setValue("date", date ?? "")} placeholder={t("team:timeOff.chooseDate")} timeZone={timezone} value={form.value("date")} />
              </FormLabel>
              <div className="grid grid-cols-2 gap-4">{(["startTime", "endTime"] as const).map((field) => {
                const control = form.getControlProps(field)
                const label = t(`team:timeOff.${field}`)
                return <FormLabel key={field} error={form.error(field)} errorPlacement="below" label={label}><TimePicker disabled={pending} formatPreference={formatPreference} inputRef={control.ref} intervalMinutes={15} invalid={Boolean(form.error(field))} label={label} language={language} onBlur={control.onBlur} onChange={control.onChange} value={control.value} /></FormLabel>
              })}</div>
            </DialogPanel>
            <DialogFooter><Button disabled={pending} onClick={() => setOpen(false)} type="button" variant="ghost">{t("team:cancel")}</Button><Button disabled={pending} loading={pending} type="submit">{t("calendarExtraHours.add")}</Button></DialogFooter>
          </>}
        </AppForm>
      </DialogPopup>
    </Dialog>
    <DeleteConfirmationDialog cancelLabel={t("team:cancel")} closeOnConfirm={false} confirmLabel={t("calendarExtraHours.remove")} description={t("calendarExtraHours.removeDescription")} forceBackdrop={true} isPending={remove.isPending} onConfirm={async () => {
      if (!removingId) return
      try {
        await remove.mutateAsync({ id: removingId })
        await refresh()
        setRemovingId(null)
        toast.success(t("calendarExtraHours.removed"))
      } catch { toast.error(t("calendarExtraHours.removeError")) }
    }} onOpenChange={(next) => { if (!next && !remove.isPending) setRemovingId(null) }} open={removingId !== null} title={t("calendarExtraHours.remove")} />
  </>
}
