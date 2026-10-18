import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { inferRouterOutputs } from "@trpc/server"
import type { FormApi } from "@rvf/react"
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { TZDate } from "react-day-picker"
import { useTranslation } from "react-i18next"
import { Link, useLocation, useNavigate, useParams } from "react-router"

import type { CalendarDragSelection } from "~/components/calendar/calendar-drag-selection"
import { BookingTimeFields } from "~/components/calendar/booking-time-fields"
import { useCalendarBookingPreview } from "~/components/calendar/calendar-booking-preview"
import { AppForm } from "~/components/app-form"
import { BookingSlotList, bookingSlotKey } from "~/components/calendar/booking-slot-list"
import { CalendarBookingEmpty } from "~/components/calendar/calendar-booking-empty"
import { CalendarBookingSummary } from "~/components/calendar/calendar-booking-summary"
import { CalendarSidePanel } from "~/components/calendar/calendar-side-panel"
import { useCalendarState } from "~/components/calendar/use-calendar-state"
import { CreateCustomerDialog } from "~/components/customers/create-customer-dialog"
import { CustomerPicker } from "~/components/customers/customer-picker"
import { DatePicker } from "~/components/date-picker"
import FormLabel from "~/components/form-label"
import { Alert, AlertAction, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { DialogFooter } from "~/components/ui/dialog"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Spinner } from "~/components/ui/spinner"
import { Textarea } from "~/components/ui/textarea"
import { calendarDateFromValue, calendarDateToValue, getCalendarBookingRange, getCalendarTimeRange } from "~/lib/calendar-date"
import { formatDateTime } from "~/lib/format-preference"
import { getCalendarBookingDragSelection } from "~/lib/calendar-booking-drag-selection"
import { cacheCalendarBooking } from "~/lib/calendar-booking-cache"
import { calendarAvailabilityQueryOptions, calendarPanelQueryOptions } from "~/lib/calendar-query"
import { useDebouncedValue } from "~/lib/use-debounced-value"
import { calendarBookingSchema } from "~/lib/schemas/calendar-booking"
import { toast } from "~/lib/toast"
import { useOrganizationPermission } from "~/lib/use-organization-access"
import { useTRPC } from "~/lib/trpc/client"
import type { appRouter } from "~/.server/main"

type Appointment = inferRouterOutputs<typeof appRouter>["appointment"]["get"]

export function CalendarBookingEdit() {
  const { t, i18n } = useTranslation()
  const trpc = useTRPC()
  const { appointmentId = "" } = useParams()
  const location = useLocation()
  const { search } = location
  const dragged = (location.state as { draggedBooking?: CalendarDragSelection & { appointmentId: string } } | null)?.draggedBooking
  const { preview: activePreview, dragUpdate } = useCalendarBookingPreview()
  const dragSelection = getCalendarBookingDragSelection(dragUpdate, dragged ? { appointmentId: dragged.appointmentId, selection: dragged } : undefined, appointmentId)

  const returnTo = useRef(`/calendar${search}`).current
  const { timeZone, formatPreference } = useCalendarState()
  const appointment = useQuery({ ...trpc.appointment.get.queryOptions({ id: appointmentId }), ...calendarPanelQueryOptions })
  const title = t("routeTitles.editAppointment")
  const subtitleStart = activePreview?.appointmentId === appointmentId ? activePreview.startsAt : appointment.data?.startsAt
  const subtitle = subtitleStart ? formatDateTime(subtitleStart, { formatPreference, timeZone, language: i18n.resolvedLanguage === "fi" ? "fi" : "en", includeWeekday: true }) : undefined

  return <CalendarSidePanel returnTo={returnTo} subtitle={subtitle} title={title}>
    <title>{title}</title>
    {appointment.isPending ? <div className="flex min-h-32 flex-1 items-center justify-center"><Spinner aria-label={t("loading")} /></div> : appointment.data === undefined ? <div className="px-6 pb-6"><Alert variant="error">
      <AlertTitle>{t("bookingForm.bookingLoadError")}</AlertTitle>
      <AlertAction><Button disabled={appointment.isFetching} onClick={() => void appointment.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction>
    </Alert></div> : <BookingEditForm dragSelection={dragSelection} appointment={appointment.data} key={appointment.data.id} returnTo={returnTo} />}
  </CalendarSidePanel>
}

function BookingEditForm({ appointment, dragSelection, returnTo }: { appointment: Appointment; dragSelection?: CalendarDragSelection; returnTo: string }) {
  const { t, i18n } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const calendar = useCalendarState({ preview: false })
  const { timeZone, formatPreference } = calendar
  const canEdit = useOrganizationPermission({ appointments: ["update"] })
  const { setPreview, clearPreview } = useCalendarBookingPreview()
  const [changingTime, setChangingTime] = useState(Boolean(dragSelection))
  const [startTime, setStartTime] = useState(() => {
    const minute = dragSelection?.startMinute ?? 0
    return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
  })
  const [length, setLength] = useState<number | null>(() => dragSelection ? dragSelection.endMinute - dragSelection.startMinute : Math.round((+appointment.endsAt - +appointment.startsAt) / 60000))
  const debouncedLength = useDebouncedValue(length)
  const durationPending = Boolean(dragSelection && length !== debouncedLength)
  const validLength = length !== null && Number.isInteger(length) && length >= 5 && length <= 1440

  const [selectedDay, setSelectedDay] = useState<string | null>(() => dragSelection?.day ?? calendarDateToValue(new TZDate(appointment.startsAt, timeZone)))
  const [selection, setSelection] = useState("")
  const [timeError, setTimeError] = useState("")
  const [saved, setSaved] = useState(false)
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [customerFlow, setCustomerFlow] = useState(0)
  const formRef = useRef<FormApi<{ customerId: string; notes: string }>>(null)
  const timeErrorId = useId()
  const [appliedDrag, setAppliedDrag] = useState(dragSelection)
  useLayoutEffect(() => {
    if (!dragSelection || appliedDrag === dragSelection) return
    setAppliedDrag(dragSelection)
    setChangingTime(true)
    setSelectedDay(dragSelection.day)
    setStartTime(`${String(Math.floor(dragSelection.startMinute / 60)).padStart(2, "0")}:${String(dragSelection.startMinute % 60).padStart(2, "0")}`)
    setLength(dragSelection.endMinute - dragSelection.startMinute)
    setSelection("")
    setTimeError("")
  }, [dragSelection, appliedDrag])
  const update = useMutation(trpc.appointment.update.mutationOptions())
  const service = appointment.services[0]
  const targetMember = changingTime && dragSelection ? dragSelection.member : appointment.staffMember
  const targetMemberId = targetMember?.id ?? appointment.staffMemberId
  const canReschedule = canEdit && Boolean(service && appointment.staffMemberId && ["PENDING", "CONFIRMED"].includes(appointment.status))
  const range = getCalendarBookingRange({ ...calendar, mode: "day", selected: selectedDay ? calendarDateFromValue(selectedDay, timeZone) : calendar.selected }, timeZone)
  const slots = useQuery({
    ...(dragSelection
      ? trpc.appointment.getBookingTimes.queryOptions({ id: appointment.id, ...range, staffMemberId: targetMemberId ?? undefined, durationMinutes: debouncedLength !== null && Number.isInteger(debouncedLength) && debouncedLength >= 5 && debouncedLength <= 1440 ? debouncedLength : 5 })
      : trpc.appointment.getSlots.queryOptions({ id: appointment.id, ...range })),
    enabled: !saved && !durationPending && appliedDrag === dragSelection && changingTime && Boolean(selectedDay) && canReschedule && (!dragSelection || validLength), ...calendarAvailabilityQueryOptions,
  })
  const [startHour, startMinute] = startTime.split(":").map(Number)
  const customRange = dragSelection && changingTime && selectedDay && validLength ? getCalendarTimeRange(selectedDay, startHour * 60 + startMinute, length, timeZone) : null

  const availableSlots = selectedDay ? slots.data?.days.flatMap((day) => day.slots) ?? [] : []
  const chosenSlot = durationPending ? undefined : dragSelection
    ? availableSlots.find((slot) => +new Date(slot.startsAt) === (customRange ? +customRange.startsAt : NaN))
    : availableSlots.find((slot) => bookingSlotKey(slot) === selection)
  const availableStartTimes = useMemo(() => new Set(availableSlots.map((slot) => {
    const local = new TZDate(slot.startsAt, timeZone)
    return `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`
  })), [slots.data, selectedDay, timeZone])
  const preview = useMemo(() => dragSelection && customRange && service && targetMember ? {
    appointmentId: appointment.id, status: appointment.status, customerName: [appointment.customer.firstName, appointment.customer.lastName].filter(Boolean).join(" "),
    preserveScroll: true, startsAt: customRange.startsAt.toISOString(), endsAt: customRange.endsAt.toISOString(),
    member: targetMember, service: { id: service.serviceId, name: service.name, color: service.service?.color ?? "var(--primary)" },
  } : null, [dragSelection, customRange?.startsAt.toISOString(), customRange?.endsAt.toISOString(), appointment.id, appointment.status, appointment.customer.firstName, appointment.customer.lastName, targetMember, service])
  useEffect(() => {
    if (!saved && dragSelection && appliedDrag === dragSelection && chosenSlot && !slots.isError) setPreview(preview)
  }, [saved, dragSelection, appliedDrag, preview, chosenSlot, slots.isError, setPreview])
  const selectedTimeError = timeError || (dragSelection && !durationPending && changingTime && selectedDay && validLength && !slots.isPending && !slots.isFetching && !slots.isError && !chosenSlot ? t("bookingForm.slotTaken") : undefined)

  const pending = update.isPending || saved
  const disabled = pending || !canEdit
  const format = (value: string | Date, includeDate = true) => formatDateTime(value, { formatPreference, timeZone, language: i18n.resolvedLanguage === "fi" ? "fi" : "en", includeDate })

  return <><AppForm
    className="min-h-0 flex-1 gap-0"
    defaultValues={{ customerId: appointment.customerId, notes: appointment.internalNotes ?? "" }}
    ref={formRef}
    schema={calendarBookingSchema}
    submitFn={async ({ customerId, notes }) => {
      if (!canEdit || pending) return
      if (changingTime && (!chosenSlot || slots.isError)) {
        setTimeError(t("bookingForm.chooseSlot"))
        return
      }
      try {
        const timeChanged = changingTime && chosenSlot && (+new Date(chosenSlot.startsAt) !== +appointment.startsAt || (dragSelection && (length !== Math.round((+appointment.endsAt - +appointment.startsAt) / 60000) || targetMemberId !== appointment.staffMemberId)))
        await queryClient.cancelQueries(trpc.appointment.list.queryFilter())
        const result = await update.mutateAsync({ id: appointment.id, customerId, internalNotes: notes, staffMemberId: timeChanged && dragSelection ? targetMemberId ?? undefined : undefined, startsAt: timeChanged && chosenSlot ? new Date(chosenSlot.startsAt) : undefined, durationMinutes: timeChanged && dragSelection && validLength ? length : undefined })
        cacheCalendarBooking(queryClient, trpc.appointment.list.queryKey(), result)
        queryClient.setQueryData(trpc.appointment.get.queryKey({ id: appointment.id }), result)
        setSaved(true)
        if (clearPreview) clearPreview({ animate: false })
        else setPreview(null)
        void Promise.all([
          queryClient.invalidateQueries({ ...trpc.appointment.getSlots.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.appointment.getBookingTimes.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.availability.getBookingTimes.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.availability.getSlots.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.customer.getAppointments.queryFilter({ id: appointment.customerId }), refetchType: "none" }),
          ...(customerId !== appointment.customerId ? [queryClient.invalidateQueries({ ...trpc.customer.getAppointments.queryFilter({ id: customerId }), refetchType: "none" })] : []),
        ])
        toast.success(t("bookingForm.updated"))
        await navigate(returnTo, { replace: true, preventScrollReset: true })
      } catch (error) {
        if ((error as { data?: { code?: string } }).data?.code === "CONFLICT") {
          setTimeError(t("bookingForm.slotTaken"))
          setSelection("")
          void slots.refetch()
        } else toast.error(t("bookingForm.updateError"))
        throw error
      }
    }}
  >{(form) => {
    const customer = form.getControlProps("customerId")
    return <>
      <ScrollArea className="min-h-0 flex-1" scrollFade={true}>
        <div className="flex flex-col gap-5 px-6 pt-1 pb-6">
          {!canEdit ? <Alert variant="info"><AlertTitle>{t("bookingForm.readOnly")}</AlertTitle></Alert> : null}
          {service ? <CalendarBookingSummary endsAt={customRange?.endsAt.toISOString() ?? chosenSlot?.endsAt ?? appointment.endsAt.toISOString()} formatPreference={formatPreference} member={targetMember ?? undefined} service={{ name: appointment.services.map((item) => item.name).join(", "), durationMinutes: customRange && length !== null ? length : Math.round((+appointment.endsAt - +appointment.startsAt) / 60000), color: service.service?.color }} startsAt={customRange?.startsAt.toISOString() ?? chosenSlot?.startsAt ?? appointment.startsAt.toISOString()} timeZone={timeZone} /> : null}
          {canReschedule ? <Button disabled={pending} onClick={() => { setChangingTime((value) => !value); setSelection(""); setTimeError("") }} type="button" variant="outline">{t(changingTime ? "bookingForm.keepTime" : "bookingForm.changeTime")}</Button> : null}
          {changingTime ? <>
            <FormLabel label={t("bookingForm.date")}>
              <DatePicker clearLabel={t("bookingForm.clearDay")} disabled={pending} disablePast={true} formatPreference={formatPreference} includeWeekday={true} invalid={Boolean(timeError && !selectedDay)} label={t("bookingForm.date")} language={i18n.resolvedLanguage === "fi" ? "fi" : "en"} onChange={(value) => { setSelectedDay(value); setSelection(""); setTimeError("") }} placeholder={t("bookingForm.chooseDay")} timeZone={timeZone} value={selectedDay} weekStartsOn={calendar.weekStartsOn} />
            </FormLabel>
            {dragSelection ? <>
              <BookingTimeFields availableStartTimes={availableStartTimes} disabled={disabled} formatPreference={formatPreference} language={i18n.resolvedLanguage === "fi" ? "fi" : "en"} length={length} lengthError={!validLength ? t("bookingForm.lengthError") : undefined} onLengthChange={(value) => { setLength(value); setTimeError("") }} onStartChange={(value) => { setStartTime(value); setTimeError("") }} startDisabled={!selectedDay || !validLength || durationPending || slots.isPending || slots.isError} startTime={startTime} timeError={selectedTimeError || undefined} />
              {slots.isError ? <Alert variant="error"><AlertTitle>{t("bookingForm.loadError")}</AlertTitle><AlertAction><Button disabled={slots.isFetching} onClick={() => void slots.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : null}
            </> : <FormLabel error={timeError ? <span id={timeErrorId}>{timeError}</span> : undefined} errorPlacement="below" errorClassName="whitespace-normal" label={t("bookingForm.times")}>
              <div aria-describedby={timeError ? timeErrorId : undefined} aria-invalid={Boolean(timeError)} aria-label={t("bookingForm.times")} className="w-full" role="group">
                {slots.isPending && selectedDay ? <div className="flex min-h-32 items-center justify-center"><Spinner aria-label={t("loading")} /></div> : slots.isError ? <Alert variant="error"><AlertTitle>{t("bookingForm.loadError")}</AlertTitle><AlertAction><Button disabled={slots.isFetching} onClick={() => void slots.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : availableSlots.length ? <BookingSlotList days={slots.data?.days ?? []} format={format} formatPreference={formatPreference} invalid={Boolean(timeError)} locations={appointment.location ? [appointment.location] : []} members={appointment.staffMember ? [appointment.staffMember] : []} onSelect={(value) => { setSelection(value); setTimeError("") }} selection={selection} showDateHeadings={false} timeZone={timeZone} /> : <CalendarBookingEmpty description={t(selectedDay ? "bookingForm.tryDate" : "bookingForm.chooseDayForTimes")} icon="calendarOff" title={t("bookingForm.noTimes")} />}
              </div>
            </FormLabel>}
          </> : null}
          <FormLabel error={form.error("customerId")} label={t("bookingForm.customerLabel")}>
            <CustomerPicker selectedCustomer={appointment.customer} disabled={disabled} inputRef={customer.ref} invalid={Boolean(form.error("customerId"))} onBlur={customer.onBlur} onChange={customer.onChange} onCreate={() => { setCustomerFlow((flow) => flow + 1); setCustomerModalOpen(true) }} value={customer.value} />
          </FormLabel>
          <FormLabel error={form.error("notes")} label={t("bookingForm.notes")}><Textarea {...form.getInputProps("notes")} aria-invalid={Boolean(form.error("notes"))} disabled={disabled} /></FormLabel>
        </div>
      </ScrollArea>
      <DialogFooter className="shrink-0 rounded-none! bg-transparent">
        <Button disabled={pending} render={<Link preventScrollReset={true} replace={true} to={returnTo} />} type="button" variant="ghost">{t("bookingForm.close")}</Button>
        {canEdit ? <Button disabled={pending || (changingTime && (!chosenSlot || slots.isError))} loading={form.formState.isSubmitting || pending} type="submit">{t("bookingForm.saveChanges")}</Button> : null}
      </DialogFooter>
    </>
  }}</AppForm>
    <CreateCustomerDialog flow={customerFlow} onCreated={(id) => { formRef.current?.setValue("customerId", id); formRef.current?.clearError("customerId") }} onOpenChange={setCustomerModalOpen} open={customerModalOpen} />
  </>
}
