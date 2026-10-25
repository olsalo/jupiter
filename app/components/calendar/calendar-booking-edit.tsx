import { canRescheduleAppointment } from "~/lib/booking/appointment-status"
import type { CalendarDragSelection } from "~/lib/calendar/types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { inferRouterOutputs } from "@trpc/server"
import type { FormApi } from "@rvf/react"
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { TZDate } from "react-day-picker"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate, useParams } from "react-router"

import { CalendarBookingLiveIssues } from "~/components/calendar/calendar-booking-live-issues"
import { usePastBookingConfirmation } from "~/components/calendar/use-past-booking-confirmation"
import { useBreakOverlapConfirmation } from "~/components/calendar/use-break-overlap-confirmation"
import { BookingDurationField } from "~/components/calendar/booking-duration-field"
import { BookingCustomerDetails } from "~/components/calendar/booking-customer-details"
import { BookingMemberFilter } from "~/components/calendar/booking-member-filter"
import { useCalendarBookingDurationLimit } from "~/components/calendar/use-calendar-booking-duration-limit"
import { useCalendarBookingPreview } from "~/components/calendar/calendar-booking-preview"
import { AppForm } from "~/components/forms/app-form"
import { BookingSlotList, bookingSlotKey } from "~/components/calendar/booking-slot-list"
import { CalendarBookingEmpty } from "~/components/calendar/calendar-booking-empty"
import { CalendarPanelClose, CalendarSidePanel } from "~/components/calendar/calendar-side-panel"
import { useCalendarState } from "~/components/calendar/use-calendar-state"
import { CreateCustomerDialog } from "~/components/customers/create-customer-dialog"
import { CustomerPicker, type CustomerOption } from "~/components/customers/customer-picker"
import { ServicePicker } from "~/components/services/service-picker"
import { DeleteConfirmationDialog } from "~/components/overlays/delete-confirmation-dialog"
import { DatePicker } from "~/components/forms/date-picker"
import FormLabel from "~/components/forms/form-label"
import Icon from "~/components/icons"
import { Alert, AlertAction, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { DrawerFooter } from "~/components/ui/drawer"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Separator } from "~/components/ui/separator"
import { Spinner } from "~/components/ui/spinner"
import { Textarea } from "~/components/ui/textarea"
import { calendarDateFromValue, calendarDateToValue, getCalendarBookingRange, getCalendarTimeRange } from "~/lib/calendar/date"
import { formatDateTime } from "~/lib/localization/format-preference"
import { getCalendarBookingDragSelection } from "~/lib/calendar/booking-drag-selection"
import { getCalendarBookingEditSlot, includeCurrentBookingSlot } from "~/lib/calendar/booking-slots"
import { cacheCalendarBooking, removeCalendarBooking } from "~/lib/calendar/booking-cache"
import { calendarAvailabilityQueryOptions, calendarPanelQueryOptions, calendarReferenceQueryOptions } from "~/lib/calendar/query-options"
import { calendarMinDurationMinutes } from "~/lib/calendar/time-step"
import { useMediaQuery } from "~/lib/hooks"
import { useDebouncedValue } from "~/lib/hooks/use-debounced-value"
import { calendarBookingEditSchema } from "~/lib/calendar/booking-schema"
import { toast } from "~/lib/toast"
import { useOrganizationPermission } from "~/lib/hooks/use-organization-access"
import { useTRPC } from "~/lib/trpc/client"
import type { appRouter } from "~/.server/main"

type Appointment = inferRouterOutputs<typeof appRouter>["appointment"]["get"]

export function CalendarBookingEdit() {
  const { t, i18n } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
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
  const cachedBooking = queryClient.getQueriesData<inferRouterOutputs<typeof appRouter>["appointment"]["list"]>(trpc.appointment.list.queryFilter())
    .map(([, bookings]) => bookings?.find((booking) => booking.id === appointmentId))
    .find((booking) => booking !== undefined)
  const subtitleStart = activePreview?.appointmentId === appointmentId ? activePreview.startsAt
    : dragSelection ? getCalendarTimeRange(dragSelection.day, dragSelection.startMinute, dragSelection.endMinute - dragSelection.startMinute, timeZone).startsAt
    : appointment.data?.startsAt ?? cachedBooking?.startsAt
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
  const bookedService = appointment.services[0]
  const [serviceId, setServiceId] = useState(bookedService?.serviceId ?? "")
  const serviceChanged = Boolean(bookedService && serviceId !== bookedService.serviceId)
  const services = useQuery({ ...trpc.service.list.queryOptions(), ...calendarReferenceQueryOptions })
  const availableServices = useMemo(() => {
    const items = (services.data ?? []).filter((service) => service.isActive && service.id !== bookedService?.serviceId)
    return bookedService ? [{ id: bookedService.serviceId, name: bookedService.name, durationMinutes: bookedService.durationMinutes, bufferBeforeMinutes: bookedService.bufferBeforeMinutes, bufferAfterMinutes: bookedService.bufferAfterMinutes, color: bookedService.service?.color }, ...items] : items
  }, [services.data, bookedService])
  const serviceDurations = useMemo(() => (services.data ?? []).filter((service) => service.isActive).map((service) => service.durationMinutes), [services.data])
  const selectedService = availableServices.find((service) => service.id === serviceId)
  const hasStackedButtons = useMediaQuery("max-40rem")
  const canEdit = useOrganizationPermission({ appointments: ["update"] })
  const { setPreview, clearPreview, dragging } = useCalendarBookingPreview()
  const [changingTime, setChangingTime] = useState(Boolean(dragSelection))
  const [memberFilter, setMemberFilter] = useState<string | undefined>()
  const [selection, setSelection] = useState("")
  const [selectedSlotMemberId, setSelectedSlotMemberId] = useState(dragSelection?.member.id ?? appointment.staffMemberId ?? undefined)
  const ownMemberId = calendar.bookableMembers.find((member) => member.memberId === calendar.organization.data?.memberId)?.id
  const [preserveScroll, setPreserveScroll] = useState(Boolean(dragSelection))
  const [startTime, setStartTime] = useState(() => {
    const local = new TZDate(appointment.startsAt, timeZone)
    const minute = dragSelection?.startMinute ?? local.getHours() * 60 + local.getMinutes()
    return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
  })
  const [length, setLength] = useState<number | null>(() => dragSelection ? dragSelection.endMinute - dragSelection.startMinute : Math.round((+appointment.endsAt - +appointment.startsAt) / 60000))
  const debouncedLength = useDebouncedValue(length)
  const durationPending = length !== debouncedLength
  const validLength = length !== null && Number.isInteger(length) && length >= calendarMinDurationMinutes && length <= 1440

  const [selectedDay, setSelectedDay] = useState<string | null>(() => dragSelection?.day ?? calendarDateToValue(new TZDate(appointment.startsAt, timeZone)))
  const [timeError, setTimeError] = useState("")
  const [saved, setSaved] = useState(false)
  const [summaryCustomer, setSummaryCustomer] = useState<CustomerOption | null>(appointment.customer)
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [customerFlow, setCustomerFlow] = useState(0)
  const formRef = useRef<FormApi<{ customerId: string; notes: string }>>(null)
  const { confirmPastBooking, pastBookingConfirmation } = usePastBookingConfirmation()
  const { confirmBreakOverlap, breakOverlapConfirmation } = useBreakOverlapConfirmation()
  const timeErrorId = useId()
  const [appliedDrag, setAppliedDrag] = useState(dragSelection)
  useLayoutEffect(() => {
    if (!dragSelection || appliedDrag === dragSelection) return
    setAppliedDrag(dragSelection)
    setSelectedSlotMemberId(dragSelection.member.id)
    setMemberFilter(undefined)
    setSelection("")
    setPreserveScroll(true)
    setChangingTime(true)
    setSelectedDay(dragSelection.day)
    setStartTime(`${String(Math.floor(dragSelection.startMinute / 60)).padStart(2, "0")}:${String(dragSelection.startMinute % 60).padStart(2, "0")}`)
    setLength(dragSelection.endMinute - dragSelection.startMinute)
    setTimeError("")
  }, [dragSelection, appliedDrag])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const remove = useMutation(trpc.appointment.delete.mutationOptions())
  const update = useMutation(trpc.appointment.update.mutationOptions())
  const service = useMemo(() => serviceChanged && selectedService ? { serviceId: selectedService.id, name: selectedService.name, service: { color: selectedService.color } } : bookedService, [serviceChanged, selectedService, bookedService])
  const serviceDetails = useQuery({ ...trpc.service.get.queryOptions({ id: serviceId }), ...calendarReferenceQueryOptions, enabled: changingTime && Boolean(serviceId) })
  const preferredMember = changingTime && dragSelection ? dragSelection.member : appointment.staffMember
  const filterMembers: { id: string; name: string }[] = calendar.bookableMembers.filter((member) => appointment.services.length === 1
    ? !serviceDetails.data || serviceDetails.data.staffServices.some((assignment) => assignment.staffMemberId === member.id && assignment.isActive)
    : member.id === appointment.staffMemberId)
  if (preferredMember && !filterMembers.some((member) => member.id === preferredMember.id)) filterMembers.push(preferredMember)
  const canReschedule = canEdit && Boolean(service && appointment.staffMemberId && canRescheduleAppointment(appointment.status))
  const range = getCalendarBookingRange({ ...calendar, mode: "day", selected: selectedDay ? calendarDateFromValue(selectedDay, timeZone) : calendar.selected }, timeZone)
  const [startHour, startMinute] = startTime.split(":").map(Number)
  const customRange = changingTime && selectedDay && validLength ? getCalendarTimeRange(selectedDay, startHour * 60 + startMinute, length, timeZone) : null
  const slots = useQuery({
    ...(appointment.services.length === 1
      ? trpc.appointment.getBookingTimes.queryOptions({ id: appointment.id, ...range, serviceId: serviceChanged ? serviceId : undefined, staffMemberId: memberFilter ?? null, durationMinutes: debouncedLength !== null && Number.isInteger(debouncedLength) && debouncedLength >= calendarMinDurationMinutes && debouncedLength <= 1440 ? debouncedLength : calendarMinDurationMinutes, selectedStart: customRange?.startsAt })
      : trpc.appointment.getSlots.queryOptions({ id: appointment.id, ...range, durationMinutes: appointment.services.length === 1 && validLength && debouncedLength !== null ? debouncedLength : undefined, selectedStart: customRange?.startsAt })),
    enabled: !saved && !durationPending && appliedDrag === dragSelection && changingTime && Boolean(selectedDay) && canReschedule && validLength, ...calendarAvailabilityQueryOptions,
  })
  const originalDay = calendarDateToValue(new TZDate(appointment.startsAt, timeZone))
  const originalLength = Math.round((+appointment.endsAt - +appointment.startsAt) / 60000)
  const currentSlot = useMemo(() => !serviceChanged && selectedDay === originalDay && (!memberFilter || memberFilter === appointment.staffMemberId) && length === originalLength && appointment.staffMemberId ? {
    startsAt: appointment.startsAt.toISOString(), endsAt: appointment.endsAt.toISOString(), staffMemberId: appointment.staffMemberId, locationId: appointment.locationId,
  } : undefined, [serviceChanged, selectedDay, originalDay, memberFilter, length, originalLength, appointment.staffMemberId, appointment.startsAt, appointment.endsAt, appointment.locationId])
  const slotDays = useMemo(() => includeCurrentBookingSlot(slots.data?.days ?? [], currentSlot ? { date: originalDay, slot: currentSlot } : undefined), [slots.data?.days, currentSlot, originalDay])
  const slotMembers = useMemo(() => {
    const members: { id: string; name: string; image?: string | null }[] = [...(calendar.staff.data ?? [])]
    if (appointment.staffMember && !members.some((member) => member.id === appointment.staffMember?.id)) members.push(appointment.staffMember)
    return members
  }, [calendar.staff.data, appointment.staffMember])
  const availableSlots = slotDays.find((day) => day.date === selectedDay)?.slots ?? []
  const chosenSlot = durationPending || appliedDrag !== dragSelection || !slots.isSuccess || slots.isFetching || !customRange ? undefined
    : getCalendarBookingEditSlot(availableSlots, customRange.startsAt, memberFilter ?? selectedSlotMemberId ?? preferredMember?.id, selection)
  const targetMemberId = chosenSlot?.staffMemberId ?? memberFilter ?? selectedSlotMemberId ?? preferredMember?.id
  const targetMember = calendar.staff.data?.find((member) => member.id === targetMemberId) ?? (preferredMember?.id === targetMemberId ? preferredMember : undefined)
  const durationLimit = useCalendarBookingDurationLimit({ startsAt: selectedDay ? getCalendarTimeRange(selectedDay, startHour * 60 + startMinute, calendarMinDurationMinutes, timeZone).startsAt : undefined, memberId: targetMemberId, appointmentId: appointment.id, length, beforeMinutes: serviceChanged ? selectedService?.bufferBeforeMinutes : bookedService?.bufferBeforeMinutes, afterMinutes: serviceChanged ? selectedService?.bufferAfterMinutes : bookedService?.bufferAfterMinutes })
  useLayoutEffect(() => {
    if (dragging || saved || durationPending || appliedDrag !== dragSelection || slots.isFetching || slots.isError || !chosenSlot) return
    const local = new TZDate(chosenSlot.startsAt, timeZone)
    const nextTime = `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`
    if (nextTime !== startTime) {
      setStartTime(nextTime)
      setTimeError("")
    }
  }, [dragging, saved, durationPending, appliedDrag, dragSelection, slots.isFetching, slots.isError, chosenSlot?.startsAt, timeZone, startTime])
  const previewCustomer = summaryCustomer ?? appointment.customer
  const preview = useMemo(() => customRange && service && targetMember ? {
    bufferBeforeMinutes: serviceChanged ? selectedService?.bufferBeforeMinutes : bookedService?.bufferBeforeMinutes,
    bufferAfterMinutes: serviceChanged ? selectedService?.bufferAfterMinutes : bookedService?.bufferAfterMinutes,
    appointmentId: appointment.id, locationId: appointment.locationId, status: appointment.status, customerName: [previewCustomer.firstName, previewCustomer.lastName].filter(Boolean).join(" "),
    preserveScroll, startsAt: customRange.startsAt.toISOString(), endsAt: customRange.endsAt.toISOString(),
    member: targetMember, service: { id: service.serviceId, name: service.name, color: service.service?.color ?? "var(--primary)" },
  } : null, [preserveScroll, customRange?.startsAt.toISOString(), customRange?.endsAt.toISOString(), appointment.id, appointment.locationId, appointment.status, previewCustomer.firstName, previewCustomer.lastName, targetMember, service, serviceChanged, selectedService?.bufferBeforeMinutes, selectedService?.bufferAfterMinutes, bookedService?.bufferBeforeMinutes, bookedService?.bufferAfterMinutes])
  useEffect(() => {
    if (!dragging && !saved && appliedDrag === dragSelection) setPreview((current) => current && current.appointmentId !== appointment.id ? current : preview)
  }, [dragging, saved, dragSelection, appliedDrag, preview, appointment.id, setPreview])
  const selectedTimeError = timeError || undefined

  const pending = update.isPending || remove.isPending || saved
  const disabled = pending || !canEdit || dragging === true
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const format = useCallback((value: string | Date, includeDate = true) => formatDateTime(value, { formatPreference, timeZone, language, includeDate }), [formatPreference, timeZone, language])
  const selectSlot = useCallback((value: string) => {
    const slot = availableSlots.find((slot) => bookingSlotKey(slot) === value)
    if (slot) {
      setPreserveScroll(false)
      setSelection(value)
      setSelectedSlotMemberId(slot.staffMemberId)
      const local = new TZDate(slot.startsAt, timeZone)
      setStartTime(`${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`)
    }
    setTimeError("")
  }, [availableSlots, timeZone])

  return <><AppForm
    className="min-h-0 flex-1 gap-0"
    defaultValues={{ customerId: appointment.customerId, notes: [appointment.customerNotes, appointment.internalNotes].filter(Boolean).join("\n\n") }}
    ref={formRef}
    schema={calendarBookingEditSchema}
    submitFn={async ({ customerId, notes }) => {
      if (disabled) return
      if (changingTime && (!chosenSlot || slots.isError)) {
        setTimeError(t("bookingForm.chooseSlot"))
        return
      }
      if (!await confirmPastBooking(appointment.startsAt, changingTime && chosenSlot ? chosenSlot.startsAt : appointment.startsAt)) return
      try {
        const timeChanged = changingTime && chosenSlot && (serviceChanged || +new Date(chosenSlot.startsAt) !== +appointment.startsAt || length !== Math.round((+appointment.endsAt - +appointment.startsAt) / 60000) || targetMemberId !== appointment.staffMemberId)
        if (timeChanged && chosenSlot.overlapsBreak && !await confirmBreakOverlap()) return
        await queryClient.cancelQueries(trpc.appointment.list.queryFilter())
        const result = await update.mutateAsync({ id: appointment.id, customerId, customerNotes: null, internalNotes: notes, serviceId: serviceChanged ? serviceId : undefined, staffMemberId: timeChanged && targetMemberId !== appointment.staffMemberId ? targetMemberId ?? undefined : undefined, startsAt: timeChanged && chosenSlot ? new Date(chosenSlot.startsAt) : undefined, durationMinutes: timeChanged && appointment.services.length === 1 && validLength ? length : undefined, allowBreakOverlap: Boolean(timeChanged && dragSelection && customRange && chosenSlot?.startsAt === customRange.startsAt.toISOString()) })
        cacheCalendarBooking(queryClient, trpc.appointment.list.queryKey(), result)
        queryClient.setQueryData(trpc.appointment.get.queryKey({ id: appointment.id }), result)
        setSaved(true)
        if (clearPreview) clearPreview({ animate: false })
        else setPreview(null)
        void Promise.all([
          queryClient.invalidateQueries({ ...trpc.service.bookingUsage.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.appointment.getSlots.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.appointment.getBookingTimes.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.availability.getBookingTimes.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.availability.getSlots.queryFilter(), refetchType: "none" }),
          queryClient.invalidateQueries({ ...trpc.customer.get.queryFilter({ id: appointment.customerId }), refetchType: "none" }),
          ...(customerId !== appointment.customerId ? [queryClient.invalidateQueries({ ...trpc.customer.get.queryFilter({ id: customerId }), refetchType: "none" })] : []),
        ])
        toast.success(t("bookingForm.updated"))
        await navigate(returnTo, { replace: true, preventScrollReset: true })
      } catch (error) {
        if ((error as { data?: { code?: string } }).data?.code === "CONFLICT") {
          setTimeError(t("bookingForm.slotTaken"))
          void slots.refetch()
        } else toast.error(t("bookingForm.updateError"))
        throw error
      }
    }}
  >{(form) => {
    const customer = form.getControlProps("customerId")
    const saveButton = canEdit ? <Button disabled={disabled} loading={form.formState.isSubmitting || pending} type="submit">{t("bookingForm.saveChanges")}</Button> : null
    const deleteButton = canEdit ? <Button className={hasStackedButtons ? undefined : "sm:mr-auto"} disabled={disabled} onClick={() => setDeleteOpen(true)} type="button" variant="destructive-outline"><Icon aria-hidden={true} name="delete" size={16} />{t("bookingForm.delete")}</Button> : null
    const closeButton = <CalendarPanelClose disabled={pending} returnTo={returnTo} type="button" variant="ghost">{t("bookingForm.close")}</CalendarPanelClose>
    return <>
      <ScrollArea className="min-h-0 flex-1" scrollFade={true}>
        <div className="flex flex-col gap-5 px-6 pt-1 pb-6">
          <CalendarBookingLiveIssues
            appointmentId={appointment.id}
            position={preview ? { ...preview, memberId: preview.member.id, locationId: appointment.locationId, status: appointment.status } : undefined}
            savedIssues={appointment.availabilityIssues}
            savedPosition={{ startsAt: appointment.startsAt, endsAt: appointment.endsAt, memberId: appointment.staffMemberId ?? "", locationId: appointment.locationId, status: appointment.status }}
          />
          {!canEdit ? <Alert variant="info"><AlertTitle>{t("bookingForm.readOnly")}</AlertTitle></Alert> : null}
          <FormLabel error={form.error("customerId")} label={t("bookingForm.customerLabel")}>
            <CustomerPicker onCustomerChange={setSummaryCustomer} selectedCustomer={appointment.customer} disabled={disabled} inputRef={customer.ref} invalid={Boolean(form.error("customerId"))} onBlur={customer.onBlur} onChange={customer.onChange} onCreate={() => { setCustomerFlow((flow) => flow + 1); setCustomerModalOpen(true) }} value={customer.value} />
          </FormLabel>
          <FormLabel error={form.error("notes")} label={t("bookingForm.notes")}><Textarea {...form.getInputProps("notes")} aria-invalid={Boolean(form.error("notes"))} disabled={disabled} /></FormLabel>
          <BookingCustomerDetails answers={appointment.answers} />
          <Separator />
          <FormLabel label={t("bookingForm.service")}>
            {appointment.services.length === 1 ? <ServicePicker disabled={disabled || !canReschedule || services.isPending} onChange={(id) => {
              if (!id || id === serviceId) return
              setServiceId(id)
              setLength(Math.max(calendarMinDurationMinutes, services.data?.find((item) => item.id === id)?.durationMinutes ?? availableServices.find((item) => item.id === id)?.durationMinutes ?? originalLength))
              setMemberFilter(undefined)
              setSelection("")
              setChangingTime(true)
              setPreserveScroll(false)
              setTimeError("")
            }} services={availableServices} value={serviceId} /> : appointment.services.map((item) => <ServicePicker disabled={true} key={item.id} onChange={() => {}} services={[{ id: item.serviceId, name: item.name, durationMinutes: item.durationMinutes, color: item.service?.color }]} value={item.serviceId} />)}
          </FormLabel>
          {services.isError ? <Alert variant="error"><AlertTitle>{t("bookingForm.servicesError")}</AlertTitle><AlertAction><Button disabled={services.isFetching} onClick={() => void services.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : null}
          <BookingDurationField serviceDurations={serviceDurations} minLength={calendarMinDurationMinutes} disabled={disabled || !canReschedule || appointment.services.length !== 1} language={i18n.resolvedLanguage === "fi" ? "fi" : "en"} length={length} maxLength={durationLimit} lengthError={!validLength ? t("bookingForm.lengthError") : undefined} onLengthChange={(value) => { setLength(value); setChangingTime(true); setPreserveScroll(false); setTimeError("") }} />
          {canReschedule ? <Button disabled={disabled} onClick={() => {
            setPreserveScroll(false)
            setChangingTime(serviceChanged || !changingTime)
            if (changingTime) {
              setMemberFilter(undefined)
              setSelection("")
              setLength(originalLength)
              setSelectedDay(originalDay)
              const local = new TZDate(appointment.startsAt, timeZone)
              setStartTime(`${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`)
            }
            setTimeError("")
          }} type="button" variant="outline"><Icon aria-hidden={true} name="clock" size={16} />{t(changingTime ? "bookingForm.keepTime" : "bookingForm.changeTime")}</Button> : null}
          {changingTime ? <>
            <FormLabel label={t("bookingForm.date")}>
              <DatePicker clearLabel={t("bookingForm.clearDay")} disabled={pending} disablePast={false} formatPreference={formatPreference} includeWeekday={true} invalid={Boolean(timeError && !selectedDay)} label={t("bookingForm.date")} language={i18n.resolvedLanguage === "fi" ? "fi" : "en"} onChange={(value) => { setSelectedDay(value); setPreserveScroll(false); setTimeError("") }} placeholder={t("bookingForm.chooseDay")} timeZone={timeZone} value={selectedDay} weekStartsOn={calendar.weekStartsOn} />
            </FormLabel>
            <FormLabel error={selectedTimeError ? <span id={timeErrorId}>{selectedTimeError}</span> : undefined} errorPlacement="below" errorClassName="whitespace-normal" label={t("bookingForm.times")}>
              <BookingMemberFilter disabled={disabled || serviceDetails.isFetching || calendar.staff.isPending || appointment.services.length !== 1} members={filterMembers} ownMemberId={ownMemberId} onChange={(id) => {
                setMemberFilter(id)
                if (id) setSelectedSlotMemberId(id)
                setSelection("")
                setPreserveScroll(false)
                setTimeError("")
              }} value={memberFilter} />
              <div aria-describedby={selectedTimeError ? timeErrorId : undefined} aria-invalid={Boolean(selectedTimeError)} aria-label={t("bookingForm.times")} className="w-full" role="group">
                {(slots.isPending || slots.isFetching || durationPending || appliedDrag !== dragSelection) && selectedDay ? <div className="flex min-h-32 items-center justify-center"><Spinner aria-label={t("loading")} /></div> : slots.isError ? <Alert variant="error"><AlertTitle>{t("bookingForm.loadError")}</AlertTitle><AlertAction><Button disabled={slots.isFetching} onClick={() => void slots.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : availableSlots.length ? <BookingSlotList currentSlotKey={currentSlot ? bookingSlotKey(currentSlot) : undefined} disabled={disabled || durationPending || !slots.isSuccess || slots.isFetching} days={slotDays} format={format} formatPreference={formatPreference} invalid={Boolean(selectedTimeError)} members={slotMembers} onSelect={selectSlot} selection={chosenSlot ? bookingSlotKey(chosenSlot) : ""} showDateHeadings={false} timeZone={timeZone} /> : <CalendarBookingEmpty description={t(selectedDay ? "bookingForm.tryDate" : "bookingForm.chooseDayForTimes")} icon="calendarOff" title={t("bookingForm.noTimes")} />}
              </div>
            </FormLabel>
          </> : null}
        </div>
      </ScrollArea>
      <DrawerFooter allowSelection={false} className={`shrink-0 rounded-none! ${hasStackedButtons ? "flex-col" : ""}`}>
        {hasStackedButtons ? <>{saveButton}{deleteButton}{closeButton}</> : <>{deleteButton}{closeButton}{saveButton}</>}
      </DrawerFooter>
    </>
  }}</AppForm>
    <DeleteConfirmationDialog
      cancelLabel={t("settings.cancel")}
      closeOnConfirm={false}
      confirmLabel={t("bookingForm.delete")}
      description={t("bookingForm.deleteDescription")}
      forceBackdrop={true}
      isPending={remove.isPending || saved}
      onConfirm={async () => {
        try {
          await queryClient.cancelQueries(trpc.appointment.list.queryFilter())
          await remove.mutateAsync({ id: appointment.id })
          setSaved(true)
          setDeleteOpen(false)
          removeCalendarBooking(queryClient, trpc.appointment.list.queryKey(), appointment.id)
          if (clearPreview) clearPreview({ animate: false })
          else setPreview(null)
          void Promise.all([
            queryClient.invalidateQueries(trpc.appointment.list.queryFilter()),
            queryClient.invalidateQueries({ ...trpc.service.bookingUsage.queryFilter(), refetchType: "none" }),
            queryClient.invalidateQueries({ ...trpc.appointment.getSlots.queryFilter(), refetchType: "none" }),
            queryClient.invalidateQueries({ ...trpc.appointment.getBookingTimes.queryFilter(), refetchType: "none" }),
            queryClient.invalidateQueries({ ...trpc.availability.getBookingTimes.queryFilter(), refetchType: "none" }),
            queryClient.invalidateQueries({ ...trpc.availability.getSlots.queryFilter(), refetchType: "none" }),
            queryClient.invalidateQueries({ ...trpc.customer.get.queryFilter({ id: appointment.customerId }), refetchType: "none" }),
          ])
          toast.success(t("bookingForm.deleted"))
          await navigate(returnTo, { replace: true, preventScrollReset: true })
          queryClient.removeQueries(trpc.appointment.get.queryFilter({ id: appointment.id }))
        } catch {
          toast.error(t("bookingForm.deleteError"))
        }
      }}
      onOpenChange={setDeleteOpen}
      open={deleteOpen}
      title={t("bookingForm.delete")}
    />
    {pastBookingConfirmation}
    {breakOverlapConfirmation}
    <CreateCustomerDialog flow={customerFlow} onCreated={(id) => { formRef.current?.setValue("customerId", id); formRef.current?.clearError("customerId") }} onOpenChange={setCustomerModalOpen} open={customerModalOpen} />
  </>
}
