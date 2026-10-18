import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { TZDate } from "react-day-picker"
import type { FormApi } from "@rvf/react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router"

import type { CalendarDragSelection } from "~/components/calendar/calendar-drag-selection"
import { BookingTimeFields } from "~/components/calendar/booking-time-fields"
import { AppForm } from "~/components/app-form"
import { DatePicker } from "~/components/date-picker"
import FormLabel from "~/components/form-label"
import Icon from "~/components/icons"
import { useCalendarState } from "~/components/calendar/use-calendar-state"
import { useCalendarBookingPreview } from "~/components/calendar/calendar-booking-preview"
import { BookingSlotList, bookingSlotKey as slotKey } from "~/components/calendar/booking-slot-list"
import { CalendarBookingEmpty } from "~/components/calendar/calendar-booking-empty"
import { CalendarBookingSummary } from "~/components/calendar/calendar-booking-summary"
import { CreateCustomerDialog } from "~/components/customers/create-customer-dialog"
import { CustomerPicker } from "~/components/customers/customer-picker"
import { ServicePicker } from "~/components/services/service-picker"
import { Alert, AlertAction, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { DialogFooter } from "~/components/ui/dialog"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Spinner } from "~/components/ui/spinner"
import { Textarea } from "~/components/ui/textarea"
import { calendarDateFromValue, getCalendarBookingRange, getCalendarTimeRange } from "~/lib/calendar-date"
import { formatDateTime } from "~/lib/format-preference"
import { calendarAvailabilityQueryOptions, calendarReferenceQueryOptions } from "~/lib/calendar-query"
import { useDebouncedValue } from "~/lib/use-debounced-value"
import { calendarBookingSchema } from "~/lib/schemas/calendar-booking"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { cn } from "~/lib/utils"

export function CalendarBookingForm({ dragSelection, selectedDay, onSelectedDayChange: setSelectedDay, onSelectedTimeChange, returnTo }: {
  dragSelection?: CalendarDragSelection
  selectedDay: string | null
  onSelectedDayChange: (value: string | null) => void
  onSelectedTimeChange: (value: string) => void
  returnTo?: string
}) {
  const { t, i18n } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const calendar = useCalendarState({ preview: false })
  const { setPreview, clearPreview, dragUpdate } = useCalendarBookingPreview()
  const { timeZone, formatPreference, selectedMember } = calendar
  const staffMemberId = dragSelection?.member.id ?? selectedMember?.id
  const [startTime, setStartTime] = useState(() => dragSelection ? `${String(Math.floor(dragSelection.startMinute / 60)).padStart(2, "0")}:${String(dragSelection.startMinute % 60).padStart(2, "0")}` : "")
  const [length, setLength] = useState(() => String(dragSelection ? dragSelection.endMinute - dragSelection.startMinute : 30))
  const durationMinutes = Number(length)
  const debouncedDuration = useDebouncedValue(durationMinutes)
  const durationPending = Boolean(dragSelection && durationMinutes !== debouncedDuration)
  const validLength = Number.isInteger(durationMinutes) && durationMinutes >= 5 && durationMinutes <= 1440
  const [startHour, startMinute] = startTime.split(":").map(Number)
  const customRange = dragSelection && selectedDay && validLength && Number.isFinite(startHour) && Number.isFinite(startMinute)
    ? getCalendarTimeRange(selectedDay, startHour * 60 + startMinute, durationMinutes, timeZone)
    : null
  const customStart = customRange?.startsAt
  const [serviceId, setServiceId] = useState("")
  const [selection, setSelection] = useState("")
  const [step, setStep] = useState<"time" | "customer">("time")
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
    setSelectedDay(dragSelection.day)
    setStartTime(`${String(Math.floor(dragSelection.startMinute / 60)).padStart(2, "0")}:${String(dragSelection.startMinute % 60).padStart(2, "0")}`)
    setLength(String(dragSelection.endMinute - dragSelection.startMinute))
    setSelection("")
    setTimeError("")
  }, [dragSelection, appliedDrag, setSelectedDay])
  const services = useQuery({ ...trpc.service.list.queryOptions(), ...calendarReferenceQueryOptions })
  const staff = calendar.staff
  const locations = useQuery({ ...trpc.location.list.queryOptions(), ...calendarReferenceQueryOptions, enabled: !dragSelection && step === "time" && Boolean(serviceId && selectedDay) })
  const calendarRange = getCalendarBookingRange(calendar, timeZone)
  const calendarRangeKey = `${calendarRange.from.toISOString()}/${calendarRange.to.toISOString()}/${timeZone}`
  useEffect(() => { if (!dragSelection) setSelectedDay(null) }, [calendarRangeKey, setSelectedDay, dragSelection])
  const { from, to } = selectedDay
    ? getCalendarBookingRange({ ...calendar, mode: "day", selected: calendarDateFromValue(selectedDay, timeZone) }, timeZone)
    : calendarRange
  const rangeKey = `${selectedDay ?? ""}/${from.toISOString()}/${to.toISOString()}/${timeZone}/${staffMemberId ?? ""}`
  useEffect(() => {
    setSelection("")
    setTimeError("")
    setStep("time")
  }, [rangeKey])
  const slots = useQuery({
    ...(dragSelection
      ? trpc.availability.getBookingTimes.queryOptions({ serviceId: serviceId || undefined, from: new Date(+from), to: new Date(+to), staffMemberId: staffMemberId ?? "", durationMinutes: Number.isInteger(debouncedDuration) && debouncedDuration >= 5 && debouncedDuration <= 1440 ? debouncedDuration : 5 })
      : trpc.availability.getSlots.queryOptions({ serviceId, from: new Date(+from), to: new Date(+to), staffMemberId })),
    enabled: !saved && !durationPending && appliedDrag === dragSelection && Boolean(selectedDay && (dragSelection ? staffMemberId && validLength : serviceId)),
    ...calendarAvailabilityQueryOptions,
  })
  const create = useMutation(trpc.appointment.create.mutationOptions())
  const availableServices = useMemo(() => services.data?.filter((service) => service.isActive) ?? [], [services.data])
  const service = availableServices.find((item) => item.id === serviceId)
  const availableSlots = selectedDay ? slots.data?.days.flatMap((entry) => entry.slots) ?? [] : []
  const availableStartTimes = useMemo(() => new Set(availableSlots.map((slot) => {
    const local = new TZDate(slot.startsAt, timeZone)
    return `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`
  })), [slots.data, selectedDay, timeZone])
  const chosenSlot = durationPending ? undefined : dragSelection ? availableSlots.find((slot) => +new Date(slot.startsAt) === (customStart ? +customStart : NaN)) : availableSlots.find((slot) => slotKey(slot) === selection)
  const previewSlot = dragSelection && customRange ? { startsAt: customRange.startsAt.toISOString(), endsAt: customRange.endsAt.toISOString(), staffMemberId } : chosenSlot
  const previewMember = dragSelection?.member ?? staff.data?.find((member) => member.id === previewSlot?.staffMemberId)
  const preview = useMemo(() => previewSlot && previewMember && (service || dragSelection) ? {
    preserveScroll: Boolean(dragSelection),
    startsAt: previewSlot.startsAt,
    endsAt: previewSlot.endsAt,
    member: { id: previewMember.id, name: previewMember.name },
    service: service ? { id: service.id, name: service.name, color: service.color ?? "var(--primary)" } : { id: "", name: "", color: "#808080" },
  } : null, [previewSlot?.startsAt, previewSlot?.endsAt, previewSlot?.staffMemberId, dragSelection, service?.id, service?.name, service?.color, previewMember?.id, previewMember?.name])
  useEffect(() => {
    if (!saved && !dragUpdate?.appointmentId && appliedDrag === dragSelection && (!dragSelection || (chosenSlot && !slots.isError))) setPreview(preview)
  }, [saved, appliedDrag, dragSelection, dragUpdate?.appointmentId, preview, chosenSlot, slots.isError, setPreview])
  const canContinue = Boolean(selectedDay && service && chosenSlot && (!dragSelection || validLength) && !slots.isError)
  const selectedTimeError = timeError || (dragSelection && !durationPending && selectedDay && serviceId && validLength && !slots.isPending && !slots.isFetching && !slots.isError && !chosenSlot ? t("bookingForm.slotTaken") : undefined)
  const pending = create.isPending || saved
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const format = useCallback((value: string | Date, includeDate = true, includeTime = true, includeWeekday = false) => formatDateTime(value, {
    formatPreference, timeZone, language, includeDate, includeTime, includeWeekday,
  }), [formatPreference, timeZone, language])
  const selectSlot = useCallback((value: string) => {
    setSelection((previous) => previous === value ? "" : value)
    setTimeError("")
  }, [])
  const selectedTimeLabel = previewSlot ? `${format(previewSlot.startsAt, true, true, true)} – ${format(previewSlot.endsAt, false)}` : ""
  useEffect(() => { onSelectedTimeChange(selectedTimeLabel) }, [selectedTimeLabel, onSelectedTimeChange])

  return <><AppForm
    className="min-h-0 flex-1 gap-0"
    defaultValues={{ customerId: "", notes: "" }}
    ref={formRef}
    schema={calendarBookingSchema}
    submitFn={async ({ notes, customerId }) => {
      if (step !== "customer" || !canContinue || !chosenSlot) return
      try {
        await queryClient.cancelQueries(trpc.appointment.list.queryFilter())
        const result = await create.mutateAsync({ durationMinutes: dragSelection ? durationMinutes : undefined, serviceId, startsAt: new Date(chosenSlot.startsAt), staffMemberId: chosenSlot.staffMemberId, locationId: chosenSlot.locationId ?? undefined, customerId, notes })
        setSaved(true)
        setPreview((current) => current ? { ...current, appointmentId: result.id, status: result.status } : current)
        void Promise.all([
          queryClient.invalidateQueries({ ...trpc.availability.getSlots.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.availability.getBookingTimes.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.appointment.getSlots.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.appointment.getBookingTimes.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.customer.getAppointments.queryFilter({ id: customerId }), refetchType: "none" }),
        ])
        toast.success(t("bookingForm.saved"))
        // Keep the new booking visible until its saved row is in the calendar cache
        await queryClient.invalidateQueries(trpc.appointment.list.queryFilter())
        if (clearPreview) clearPreview({ animate: false })
        else setPreview(null)
        await navigate(returnTo ?? `/calendar${location.search}`, { replace: true, preventScrollReset: true })
      } catch (error) {
        const code = (error as { data?: { code?: string } }).data?.code
        if (code === "CONFLICT") {
          setTimeError(t("bookingForm.slotTaken"))
          setSelection("")
          setStep("time")
          void slots.refetch()
        } else {
          toast.error(t("bookingForm.saveError"))
        }
        throw error
      }
    }}
  >
    {(form) => {
      const customer = form.getControlProps("customerId")
      return <>
      <ScrollArea className="min-h-0 flex-1" fill={step === "time"} scrollFade={true}>
        <div className={cn("flex flex-col gap-5 px-6 pt-1 pb-6", step === "time" && "min-h-full")}>
          {step === "time" ? <>
            <FormLabel label={t("bookingForm.service")}>
              <ServicePicker disabled={services.isPending || pending} onChange={(value) => {
                setServiceId(value)
                setSelection("")
                setTimeError("")
              }} services={availableServices} value={serviceId} />
            </FormLabel>
            <FormLabel label={t("bookingForm.date")}>
              <DatePicker
                clearLabel={t("bookingForm.clearDay")}
                defaultMonth={calendar.selected}
                disabled={pending}
                disablePast={true}
                formatPreference={formatPreference}
                includeWeekday={true}
                invalid={false}
                label={t("bookingForm.date")}
                language={i18n.resolvedLanguage === "fi" ? "fi" : "en"}
                onChange={setSelectedDay}
                placeholder={t("bookingForm.chooseDay")}
                timeZone={timeZone}
                value={selectedDay}
                weekStartsOn={calendar.weekStartsOn}
              />
            </FormLabel>
            {dragSelection ? <BookingTimeFields
              availableStartTimes={availableStartTimes}
              disabled={pending}
              formatPreference={formatPreference}
              language={language}
              length={length === "" ? null : durationMinutes}
              lengthError={!validLength ? t("bookingForm.lengthError") : undefined}
              onLengthChange={(value) => { setLength(value === null ? "" : String(value)); setTimeError("") }}
              onStartChange={(value) => { setStartTime(value); setTimeError("") }}
              startDisabled={!selectedDay || !validLength || durationPending || slots.isPending || slots.isError}
              startTime={startTime}
              timeError={selectedTimeError || undefined}
            /> : null}
            {!dragSelection && !services.isPending && !services.isError && availableServices.length > 0 && (!serviceId || !selectedDay) ? <CalendarBookingEmpty
              icon="calendarEvent"
              title={t("bookingForm.findTime")}
              description={t(!serviceId ? "bookingForm.chooseTime" : "bookingForm.chooseDayForTimes")}
            /> : null}
            {services.isError ? <Alert variant="error"><AlertTitle>{t("bookingForm.servicesError")}</AlertTitle><AlertAction><Button disabled={services.isFetching} onClick={() => void services.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : null}
            {services.isPending && !dragSelection ? <div className="flex min-h-20 w-full flex-1 items-center justify-center"><Spinner aria-label={t("loading")} /></div> : !services.isPending && !services.isError && !availableServices.length ? <CalendarBookingEmpty
              icon="calendarEvent"
              title={t("bookingForm.noServices")}
              description={t("bookingForm.noServicesDescription")}
            /> : null}
            {dragSelection && slots.isError ? <Alert variant="error"><AlertTitle>{t("bookingForm.loadError")}</AlertTitle><AlertAction><Button disabled={slots.isFetching} onClick={() => void slots.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : null}
            {serviceId && selectedDay && !dragSelection ? <>
              <FormLabel className="flex-1" error={timeError ? <span id={timeErrorId}>{timeError}</span> : undefined} errorPlacement="below" errorClassName="whitespace-normal" label={t("bookingForm.times")}>
                {slots.isPending ? <div className="flex min-h-32 w-full flex-1 items-center justify-center py-8"><Spinner aria-label={t("loading")} /></div> : slots.isError && slots.data === undefined ? <Alert variant="error"><AlertTitle>{t("bookingForm.loadError")}</AlertTitle><AlertAction><Button disabled={slots.isFetching} onClick={() => void slots.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : availableSlots.length ? <div aria-describedby={timeError ? timeErrorId : undefined} aria-invalid={Boolean(timeError)} aria-label={t("bookingForm.times")} className="flex w-full min-w-0 flex-col gap-5" role="group">
                  <BookingSlotList
                    days={slots.data?.days ?? []}
                    format={format}
                    formatPreference={formatPreference}
                    invalid={Boolean(timeError)}
                    locations={locations.data ?? []}
                    members={staff.data ?? []}
                    onSelect={selectSlot}
                    selection={selection}
                    showDateHeadings={false}
                    timeZone={timeZone}
                  />
                </div> : <CalendarBookingEmpty
                  icon="calendarOff"
                  title={t("bookingForm.noTimes")}
                  description={t("bookingForm.tryDate")}
                />}
              </FormLabel>
            </> : null}
          </> : <>
            {chosenSlot && service ? <CalendarBookingSummary endsAt={chosenSlot.endsAt} formatPreference={formatPreference} member={staff.data?.find((person) => person.id === chosenSlot.staffMemberId)} service={service} startsAt={chosenSlot.startsAt} timeZone={timeZone} /> : <Alert variant="warning"><AlertTitle>{t("bookingForm.slotTaken")}</AlertTitle></Alert>}
            <FormLabel error={form.error("customerId")} label={t("bookingForm.customerLabel")}>
              <CustomerPicker disabled={pending} inputRef={customer.ref} invalid={Boolean(form.error("customerId"))} onBlur={customer.onBlur} onChange={customer.onChange} onCreate={() => {
                setCustomerFlow((flow) => flow + 1)
                setCustomerModalOpen(true)
              }} value={customer.value} />
            </FormLabel>
            <FormLabel error={form.error("notes")} label={t("bookingForm.notes")}><Textarea {...form.getInputProps("notes")} aria-invalid={Boolean(form.error("notes"))} disabled={pending} /></FormLabel>
          </>}
        </div>
      </ScrollArea>
      {selectedDay && (chosenSlot || dragSelection || step === "customer") ? <DialogFooter className="shrink-0 rounded-none! flex-col-reverse! items-stretch bg-transparent max-md:*:w-full md:flex-row! md:items-center md:justify-between!">
        {step === "customer" ? <Button disabled={pending} onClick={() => setStep("time")} type="button" variant="ghost"><Icon aria-hidden={true} name="chevronLeft" size={16} />{t("bookingForm.back")}</Button> : null}
        {step === "time" ? <Button className="md:ml-auto" disabled={!canContinue || pending} key="continue" onClick={(event) => {
          event.preventDefault()
          setStep("customer")
        }} type="button">{t("bookingForm.continue")}<Icon aria-hidden={true} name="chevronRight" size={16} /></Button> : <Button disabled={!canContinue || pending} key="submit" loading={form.formState.isSubmitting || pending} type="submit"><Icon aria-hidden={true} name="plus" size={16} />{t("bookingForm.add")}</Button>}
      </DialogFooter> : null}
    </>}}
  </AppForm>
    <CreateCustomerDialog flow={customerFlow} onCreated={(id) => {
      formRef.current?.setValue("customerId", id)
      formRef.current?.clearError("customerId")
    }} onOpenChange={setCustomerModalOpen} open={customerModalOpen} />
  </>
}
