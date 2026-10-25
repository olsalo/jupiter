import type { CalendarDragSelection } from "~/lib/calendar/types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { TZDate } from "react-day-picker"
import type { FormApi } from "@rvf/react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router"

import { usePastBookingConfirmation } from "~/components/calendar/use-past-booking-confirmation"
import { useBreakOverlapConfirmation } from "~/components/calendar/use-break-overlap-confirmation"
import { CalendarBookingLiveIssues } from "~/components/calendar/calendar-booking-live-issues"
import { BookingDurationField } from "~/components/calendar/booking-duration-field"
import { BookingMemberFilter } from "~/components/calendar/booking-member-filter"
import { useCalendarBookingDurationLimit } from "~/components/calendar/use-calendar-booking-duration-limit"
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
import { CustomerPicker, type CustomerOption } from "~/components/customers/customer-picker"
import { ServicePicker } from "~/components/services/service-picker"
import { Alert, AlertAction, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { DrawerFooter } from "~/components/ui/drawer"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Spinner } from "~/components/ui/spinner"
import { Textarea } from "~/components/ui/textarea"
import { calendarDateFromValue, getCalendarBookingRange, getCalendarTimeRange } from "~/lib/calendar/date"
import { getClosestBookingSlot } from "~/lib/calendar/booking-slots"
import { formatDateTime } from "~/lib/format-preference"
import { calendarAvailabilityQueryOptions, calendarReferenceQueryOptions } from "~/lib/calendar/query-options"
import { calendarMinDurationMinutes } from "~/lib/calendar/time-step"
import { useDebouncedValue } from "~/lib/use-debounced-value"
import { getCalendarDraftService, getCalendarServiceSelectionLength } from "~/lib/calendar/booking-service-suggestion"
import { calendarBookingSchema } from "~/lib/calendar/booking-schema"
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
  const { setPreview, clearPreview, dragUpdate, dragging } = useCalendarBookingPreview()
  const { timeZone, formatPreference } = calendar
  const [staffMemberId, setStaffMemberId] = useState<string | undefined>()
  const services = useQuery({ ...trpc.service.list.queryOptions(), ...calendarReferenceQueryOptions })
  const serviceUsage = useQuery({ ...trpc.service.bookingUsage.queryOptions(), ...calendarReferenceQueryOptions })
  const availableServices = useMemo(() => services.data?.filter((service) => service.isActive) ?? [], [services.data])
  const serviceDurations = useMemo(() => availableServices.map((service) => service.durationMinutes), [availableServices])
  const ownMemberId = calendar.bookableMembers.find((member) => member.memberId === calendar.organization.data?.memberId)?.id
  const [startTime, setStartTime] = useState(() => dragSelection ? `${String(Math.floor(dragSelection.startMinute / 60)).padStart(2, "0")}:${String(dragSelection.startMinute % 60).padStart(2, "0")}` : "")
  const [preserveScroll, setPreserveScroll] = useState(Boolean(dragSelection))
  const [rawLength, setLength] = useState(() => String(dragSelection ? dragSelection.endMinute - dragSelection.startMinute : 30))
  const [lengthSource, setLengthSource] = useState<"default" | "specified">(dragSelection ? "specified" : "default")
  const [serviceChoice, setServiceChoice] = useState<string | null>(null)
  const suggestedService = getCalendarDraftService(availableServices, serviceUsage.data ?? [], lengthSource === "specified" ? Number(rawLength) : undefined)
  const serviceId = serviceChoice ?? suggestedService?.id ?? ""
  const length = lengthSource === "default" && serviceChoice === null && suggestedService ? String(suggestedService.durationMinutes) : rawLength
  const durationMinutes = Number(length)
  const debouncedDuration = useDebouncedValue(durationMinutes)
  const durationPending = durationMinutes !== debouncedDuration
  const validLength = Number.isInteger(durationMinutes) && durationMinutes >= calendarMinDurationMinutes && durationMinutes <= 1440
  const [startHour, startMinute] = startTime.split(":").map(Number)
  const customRange = dragSelection && selectedDay && validLength && Number.isFinite(startHour) && Number.isFinite(startMinute)
    ? getCalendarTimeRange(selectedDay, startHour * 60 + startMinute, durationMinutes, timeZone)
    : null
  const [selection, setSelection] = useState("")
  const [selectedSlotMemberId, setSelectedSlotMemberId] = useState(dragSelection?.member.id)
  const [step, setStep] = useState<"time" | "customer">("time")
  const [timeError, setTimeError] = useState("")
  const [saved, setSaved] = useState(false)
  const [summaryCustomer, setSummaryCustomer] = useState<CustomerOption | null>(null)
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [customerFlow, setCustomerFlow] = useState(0)
  const formRef = useRef<FormApi<{ customerId: string; notes: string }>>(null)
  const { confirmPastBooking, pastBookingConfirmation } = usePastBookingConfirmation()
  const { confirmBreakOverlap, breakOverlapConfirmation } = useBreakOverlapConfirmation()
  const timeErrorId = useId()
  const [appliedDrag, setAppliedDrag] = useState(dragSelection)
  const manualLength = useRef(length)
  useLayoutEffect(() => {
    if (appliedDrag === dragSelection) return
    setStaffMemberId(undefined)
    setLengthSource("specified")
    if (!dragSelection || !appliedDrag || dragSelection.endMinute - dragSelection.startMinute !== appliedDrag.endMinute - appliedDrag.startMinute) setServiceChoice(null)
    if (!dragSelection) {
      setPreserveScroll(false)
      setAppliedDrag(undefined)
      setSelectedDay(null)
      setStartTime("")
      setLength(manualLength.current)
      setSelection("")
      setTimeError("")
      return
    }
    if (!appliedDrag) manualLength.current = length
    setAppliedDrag(dragSelection)
    setPreserveScroll(true)
    setSelectedDay(dragSelection.day)
    setSelectedSlotMemberId(dragSelection.member.id)
    setStartTime(`${String(Math.floor(dragSelection.startMinute / 60)).padStart(2, "0")}:${String(dragSelection.startMinute % 60).padStart(2, "0")}`)
    setLength(String(dragSelection.endMinute - dragSelection.startMinute))
    setSelection("")
    setTimeError("")
  }, [dragSelection, appliedDrag, setSelectedDay, length])
  const serviceDetails = useQuery({ ...trpc.service.get.queryOptions({ id: serviceId }), ...calendarReferenceQueryOptions, enabled: Boolean(serviceId) })
  const staff = calendar.staff
  const filterMembers = calendar.bookableMembers.filter((member) => member.id === staffMemberId || !serviceDetails.data || serviceDetails.data.staffServices.some((assignment) => assignment.staffMemberId === member.id && assignment.isActive))
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
      ? trpc.availability.getBookingTimes.queryOptions({ serviceId: serviceId || undefined, from: new Date(+from), to: new Date(+to), staffMemberId, durationMinutes: Number.isInteger(debouncedDuration) && debouncedDuration >= calendarMinDurationMinutes && debouncedDuration <= 1440 ? debouncedDuration : calendarMinDurationMinutes, selectedStart: customRange?.startsAt })
      : trpc.availability.getSlots.queryOptions({ serviceId, from: new Date(+from), to: new Date(+to), staffMemberId, durationMinutes: validLength ? debouncedDuration : undefined })),
    enabled: !saved && validLength && !durationPending && appliedDrag === dragSelection && Boolean(selectedDay && (dragSelection || serviceId)),
    ...calendarAvailabilityQueryOptions,
  })
  const create = useMutation(trpc.appointment.create.mutationOptions())
  const service = availableServices.find((item) => item.id === serviceId)
  const availableSlots = slots.data?.days.find((entry) => entry.date === selectedDay)?.slots ?? []
  const preferredStart = selectedDay && startTime && Number.isFinite(startHour) && Number.isFinite(startMinute)
    ? getCalendarTimeRange(selectedDay, startHour * 60 + startMinute, calendarMinDurationMinutes, timeZone).startsAt : undefined
  const chosenSlot = durationPending || appliedDrag !== dragSelection || !slots.isSuccess || slots.isFetching ? undefined : availableSlots.find((slot) => slotKey(slot) === selection)
    ?? (preferredStart ? getClosestBookingSlot(availableSlots, preferredStart, selectedSlotMemberId ?? dragSelection?.member.id) : undefined)
  const durationLimit = useCalendarBookingDurationLimit({ startsAt: preferredStart, memberId: staffMemberId ?? chosenSlot?.staffMemberId ?? selectedSlotMemberId, length: validLength ? durationMinutes : null, beforeMinutes: service?.bufferBeforeMinutes, afterMinutes: service?.bufferAfterMinutes })
  useLayoutEffect(() => {
    if (dragging || saved || durationPending || appliedDrag !== dragSelection || slots.isFetching || slots.isError || !chosenSlot) return
    const local = new TZDate(chosenSlot.startsAt, timeZone)
    const nextTime = `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`
    if (nextTime !== startTime) setStartTime(nextTime)
    setSelectedSlotMemberId(chosenSlot.staffMemberId)
    if (!dragSelection && selection !== slotKey(chosenSlot)) setSelection(slotKey(chosenSlot))
    setTimeError("")
  }, [dragging, saved, durationPending, appliedDrag, dragSelection, slots.isFetching, slots.isError, chosenSlot?.startsAt, chosenSlot?.staffMemberId, chosenSlot?.locationId, timeZone, startTime, selection])
  const previewSlot = dragSelection && customRange ? { startsAt: customRange.startsAt.toISOString(), endsAt: customRange.endsAt.toISOString(), staffMemberId: chosenSlot?.staffMemberId ?? staffMemberId ?? dragSelection.member.id, locationId: chosenSlot?.locationId ?? null } : chosenSlot
  const previewMember = staff.data?.find((member) => member.id === previewSlot?.staffMemberId) ?? (dragSelection?.member.id === previewSlot?.staffMemberId ? dragSelection?.member : undefined)
  const summarySlot = dragging ? previewSlot : chosenSlot
  const preview = useMemo(() => previewSlot && previewMember && (service || dragSelection) ? {
    preserveScroll,
    bufferBeforeMinutes: service?.bufferBeforeMinutes,
    bufferAfterMinutes: service?.bufferAfterMinutes,
    locationId: previewSlot.locationId,
    startsAt: previewSlot.startsAt,
    endsAt: previewSlot.endsAt,
    member: { id: previewMember.id, name: previewMember.name },
    service: service ? { id: service.id, name: service.name, color: service.color ?? "var(--primary)" } : { id: "", name: "", color: "#808080" },
  } : null, [previewSlot?.startsAt, previewSlot?.endsAt, previewSlot?.staffMemberId, previewSlot?.locationId, preserveScroll, dragSelection, service?.id, service?.name, service?.color, service?.bufferBeforeMinutes, service?.bufferAfterMinutes, previewMember?.id, previewMember?.name])
  useEffect(() => {
    if (!dragging && !saved && !dragUpdate?.appointmentId && appliedDrag === dragSelection && (!dragSelection || (chosenSlot && !slots.isError))) setPreview(preview)
  }, [dragging, saved, appliedDrag, dragSelection, dragUpdate?.appointmentId, preview, chosenSlot, slots.isError, setPreview])
  const canContinue = Boolean(!dragging && selectedDay && service && chosenSlot && validLength && !slots.isError)
  const selectedTimeError = timeError || undefined
  const pending = create.isPending || saved
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const format = useCallback((value: string | Date, includeDate = true, includeTime = true, includeWeekday = false) => formatDateTime(value, {
    formatPreference, timeZone, language, includeDate, includeTime, includeWeekday,
  }), [formatPreference, timeZone, language])
  const selectSlot = useCallback((value: string) => {
    setPreserveScroll(false)
    const slot = availableSlots.find((slot) => slotKey(slot) === value)
    const local = slot ? new TZDate(slot.startsAt, timeZone) : undefined
    setStartTime(selection === value || !local ? "" : `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`)
    setSelection(selection === value ? "" : value)
    setTimeError("")
  }, [availableSlots, selection, timeZone])
  const selectedTimeLabel = previewSlot ? `${format(previewSlot.startsAt, true, true, true)} – ${format(previewSlot.endsAt, false)}` : ""
  useEffect(() => { onSelectedTimeChange(selectedTimeLabel) }, [selectedTimeLabel, onSelectedTimeChange])

  return <><AppForm
    className="min-h-0 flex-1 gap-0"
    defaultValues={{ customerId: "", notes: "" }}
    ref={formRef}
    schema={calendarBookingSchema}
    submitFn={async ({ notes, customerId }) => {
      if (step !== "customer") return
      if (!canContinue || !chosenSlot) {
        setStep("time")
        setTimeError(t("bookingForm.chooseSlot"))
        return
      }
      if (chosenSlot.overlapsBreak && !await confirmBreakOverlap()) return
      if (!await confirmPastBooking(chosenSlot.startsAt)) return
      try {
        await queryClient.cancelQueries(trpc.appointment.list.queryFilter())
        const result = await create.mutateAsync({ durationMinutes, allowBreakOverlap: Boolean(dragSelection && customRange && chosenSlot.startsAt === customRange.startsAt.toISOString()), serviceId, startsAt: new Date(chosenSlot.startsAt), staffMemberId: chosenSlot.staffMemberId, locationId: chosenSlot.locationId ?? undefined, customerId, notes })
        setSaved(true)
        setPreview((current) => current ? { ...current, appointmentId: result.id, status: result.status } : current)
        void Promise.all([
          queryClient.invalidateQueries({ ...trpc.service.bookingUsage.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.availability.getSlots.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.availability.getBookingTimes.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.appointment.getSlots.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.appointment.getBookingTimes.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.customer.get.queryFilter({ id: customerId }), refetchType: "none" }),
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
            {summarySlot && (service || dragSelection) ? <CalendarBookingLiveIssues appointmentId="calendar-booking-draft" position={{ startsAt: summarySlot.startsAt, endsAt: summarySlot.endsAt, memberId: summarySlot.staffMemberId, locationId: summarySlot.locationId, status: "CONFIRMED" }} savedPosition={{ startsAt: summarySlot.startsAt, endsAt: summarySlot.endsAt, memberId: summarySlot.staffMemberId, locationId: summarySlot.locationId, status: "CONFIRMED" }} /> : null}
            <FormLabel label={t("bookingForm.service")}>
              <ServicePicker disabled={services.isPending || pending} onChange={(value) => {
                setPreserveScroll(false)
                setServiceChoice(value)
                setLengthSource("specified")
                setLength(String(getCalendarServiceSelectionLength({ length: durationMinutes, defaultLength: availableServices.find((item) => item.id === value)?.durationMinutes ?? durationMinutes, preserveCustomLength: lengthSource === "specified", serviceDurations })))
                setSelection("")
                setTimeError("")
              }} services={availableServices} value={serviceId} />
            </FormLabel>
            <BookingDurationField serviceDurations={serviceDurations} minLength={calendarMinDurationMinutes} disabled={pending} language={language} length={length === "" ? null : durationMinutes} maxLength={durationLimit} lengthError={!validLength ? t("bookingForm.lengthError") : undefined} onLengthChange={(value, source) => { setLength(value === null ? "" : String(value)); setLengthSource("specified"); setServiceChoice(source === "step" ? null : serviceId); setPreserveScroll(false); setTimeError("") }} />
            <FormLabel label={t("bookingForm.date")}>
              <DatePicker
                clearLabel={t("bookingForm.clearDay")}
                defaultMonth={calendar.selected}
                disabled={pending}
                disablePast={false}
                formatPreference={formatPreference}
                includeWeekday={true}
                invalid={false}
                label={t("bookingForm.date")}
                language={i18n.resolvedLanguage === "fi" ? "fi" : "en"}
                onChange={(value) => { setSelectedDay(value); setPreserveScroll(false) }}
                placeholder={t("bookingForm.chooseDay")}
                timeZone={timeZone}
                value={selectedDay}
                weekStartsOn={calendar.weekStartsOn}
              />
            </FormLabel>
            {!dragSelection && !services.isPending && !services.isError && availableServices.length > 0 && (!serviceId || !selectedDay) ? <CalendarBookingEmpty
              icon="calendarEvent"
              title={t("bookingForm.findTime")}
              description={t(!serviceId ? "bookingForm.chooseTime" : "bookingForm.chooseDayForTimes")}
            /> : null}
            {services.isError ? <Alert variant="error"><AlertTitle>{t("bookingForm.servicesError")}</AlertTitle><AlertAction><Button disabled={services.isFetching} onClick={() => void services.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : null}
            {!services.isPending && !services.isError && !availableServices.length ? <CalendarBookingEmpty
              icon="calendarEvent"
              title={t("bookingForm.noServices")}
              description={t("bookingForm.noServicesDescription")}
            /> : null}
            {!services.isError && (services.isPending || availableServices.length > 0) && selectedDay && (serviceId || dragSelection) ? <>
              <FormLabel className="flex-1" error={timeError ? <span id={timeErrorId}>{timeError}</span> : undefined} errorPlacement="below" errorClassName="whitespace-normal" label={t("bookingForm.times")}>
                <BookingMemberFilter disabled={pending || dragging === true || serviceDetails.isFetching || staff.isPending} members={filterMembers} ownMemberId={ownMemberId} onChange={(id) => {
                  setStaffMemberId(id)
                  setSelectedSlotMemberId(id)
                  setPreserveScroll(false)
                  setSelection("")
                  setTimeError("")
                }} value={staffMemberId} />
                {slots.isPending || slots.isFetching || durationPending || appliedDrag !== dragSelection ? <div className="flex min-h-32 w-full flex-1 items-center justify-center py-8"><Spinner aria-label={t("loading")} /></div> : slots.isError && slots.data === undefined ? <Alert variant="error"><AlertTitle>{t("bookingForm.loadError")}</AlertTitle><AlertAction><Button disabled={slots.isFetching} onClick={() => void slots.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : availableSlots.length ? <div aria-describedby={timeError ? timeErrorId : undefined} aria-invalid={Boolean(timeError)} aria-label={t("bookingForm.times")} className="flex w-full min-w-0 flex-col gap-5" role="group">
                  <BookingSlotList
                    disabled={pending || dragging === true}
                    days={slots.data?.days ?? []}
                    format={format}
                    formatPreference={formatPreference}
                    invalid={Boolean(timeError)}
                    members={staff.data ?? []}
                    onSelect={selectSlot}
                    selection={chosenSlot ? slotKey(chosenSlot) : ""}
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
            {summarySlot && service ? <>
              <CalendarBookingSummary customer={summaryCustomer} endsAt={summarySlot.endsAt} formatPreference={formatPreference} member={staff.data?.find((person) => person.id === summarySlot.staffMemberId)} service={service} startsAt={summarySlot.startsAt} timeZone={timeZone} />
            </> : <Alert variant="warning"><AlertTitle>{t("bookingForm.slotTaken")}</AlertTitle></Alert>}
            <FormLabel error={form.error("customerId")} label={t("bookingForm.customerLabel")}>
              <CustomerPicker onCustomerChange={setSummaryCustomer} disabled={pending} inputRef={customer.ref} invalid={Boolean(form.error("customerId"))} onBlur={customer.onBlur} onChange={customer.onChange} onCreate={() => {
                setCustomerFlow((flow) => flow + 1)
                setCustomerModalOpen(true)
              }} value={customer.value} />
            </FormLabel>
            <FormLabel error={form.error("notes")} label={t("bookingForm.notes")}><Textarea {...form.getInputProps("notes")} aria-invalid={Boolean(form.error("notes"))} disabled={pending} /></FormLabel>
          </>}
        </div>
      </ScrollArea>
      {selectedDay && service && (chosenSlot || step === "customer") ? <DrawerFooter allowSelection={false} className="shrink-0 rounded-none! flex-col-reverse! items-stretch max-md:*:w-full md:flex-row! md:items-center md:justify-between!">
        {step === "customer" ? <Button disabled={pending} onClick={() => setStep("time")} type="button" variant="ghost"><Icon aria-hidden={true} name="chevronLeft" size={16} />{t("bookingForm.back")}</Button> : null}
        {step === "time" ? <Button className="md:ml-auto" disabled={pending} key="continue" onClick={(event) => {
          event.preventDefault()
          if (!canContinue) {
            setTimeError(t("bookingForm.chooseSlot"))
            return
          }
          setStep("customer")
        }} type="button">{t("bookingForm.continue")}<Icon aria-hidden={true} name="chevronRight" size={16} /></Button> : <Button disabled={pending} key="submit" loading={form.formState.isSubmitting || pending} type="submit"><Icon aria-hidden={true} name="plus" size={16} />{t("bookingForm.add")}</Button>}
      </DrawerFooter> : null}
    </>}}
  </AppForm>
    {pastBookingConfirmation}
    {breakOverlapConfirmation}
    <CreateCustomerDialog flow={customerFlow} onCreated={(id) => {
      formRef.current?.setValue("customerId", id)
      formRef.current?.clearError("customerId")
    }} onOpenChange={setCustomerModalOpen} open={customerModalOpen} />
  </>
}
