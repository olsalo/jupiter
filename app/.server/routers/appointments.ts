import type { TRPCRouterRecord } from "@trpc/server"
import { permissionProcedure } from "../trpc"
import { appointmentBookingTimesInput, appointmentSlotsInput, cancelInput, createAppointmentInput, createAppointmentWithCustomerInput, idInput, listAppointmentsInput, notesInput, rescheduleInput, updateAppointmentInput } from "~/lib/schemas/appointments"
import { changeAppointment, createAppointment, deleteAppointment, getAppointment } from "../services/appointments"
import { withAppointmentAvailabilityIssues } from "../services/appointment-availability-issues"
import { getAvailableSlots } from "../services/availability"

export const appointmentRouter = {
  createWithCustomer: permissionProcedure({ appointments: ["create"], customers: ["create"] }).input(createAppointmentWithCustomerInput).mutation(({ ctx, input }) => {
    return createAppointment(ctx.prisma, ctx.organizationId, input, ctx.user.id)
  }),
  list: permissionProcedure({ appointments: ["read"] }).input(listAppointmentsInput).query(async ({ ctx, input }) => {
    const appointments = await ctx.prisma.appointment.findMany({ where: { organizationId: ctx.organizationId, startsAt: { lt: input.to }, endsAt: { gt: input.from }, staffMemberId: input.staffMemberId, locationId: input.locationId, customerId: input.customerId, status: input.status ?? ((input.includeCancelled ?? ctx.organization.settings?.showCancelledAppointments ?? true) ? undefined : { not: "CANCELLED" }) }, orderBy: [{ startsAt: "asc" }, { id: "asc" }], select: { id: true, startsAt: true, endsAt: true, timezone: true, status: true, source: true, customer: { select: { id: true, firstName: true, lastName: true } }, staffMember: { select: { id: true, name: true } }, location: { select: { id: true, name: true } }, services: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { serviceId: true, name: true, durationMinutes: true, bufferBeforeMinutes: true, bufferAfterMinutes: true, service: { select: { color: true } } } } } })
    return withAppointmentAvailabilityIssues(ctx.prisma, ctx.organizationId, appointments)
  }),
  get: permissionProcedure({ appointments: ["read"] }).input(idInput).query(async ({ ctx, input }) => {
    const appointment = await getAppointment(ctx.prisma, ctx.organizationId, input.id)
    return (await withAppointmentAvailabilityIssues(ctx.prisma, ctx.organizationId, [appointment]))[0]
  }),
  getSlots: permissionProcedure({ appointments: ["update"] }).input(appointmentSlotsInput).query(async ({ ctx, input }) => {
    const appointment = await getAppointment(ctx.prisma, ctx.organizationId, input.id)
    const snapshot = appointment.services[0]
    if (!snapshot || !appointment.staffMemberId || !["PENDING", "CONFIRMED"].includes(appointment.status)) return { days: [] }
    const result = await getAvailableSlots(ctx.prisma, ctx.organizationId, { serviceId: snapshot.serviceId, staffMemberId: appointment.staffMemberId, locationId: appointment.locationId ?? undefined, from: input.from, to: input.to }, { allowPast: true, allowBreakOverlapStart: input.selectedStart ? +input.selectedStart : undefined, excludeAppointmentId: appointment.id, snapshot, durationMinutes: input.durationMinutes, listStarts: input.durationMinutes !== undefined, useOrganizationDefaults: false, purpose: "reschedule" })
    return { days: result.days.map((day) => ({ ...day, slots: day.slots.filter((slot) => slot.locationId === appointment.locationId) })).filter((day) => day.slots.length > 0) }
  }),
  getBookingTimes: permissionProcedure({ appointments: ["update"] }).input(appointmentBookingTimesInput).query(async ({ ctx, input }) => {
    const appointment = await getAppointment(ctx.prisma, ctx.organizationId, input.id)
    const snapshot = appointment.services[0]
    if (!snapshot || appointment.services.length !== 1 || !appointment.staffMemberId || !["PENDING", "CONFIRMED"].includes(appointment.status)) return { days: [] }
    const replacingService = Boolean(input.serviceId && input.serviceId !== snapshot.serviceId)
    const result = await getAvailableSlots(ctx.prisma, ctx.organizationId, { serviceId: input.serviceId ?? snapshot.serviceId, staffMemberId: input.staffMemberId === null ? undefined : input.staffMemberId ?? appointment.staffMemberId, locationId: appointment.locationId ?? undefined, from: input.from, to: input.to }, { allowPast: true, allowBreakOverlapStart: input.selectedStart ? +input.selectedStart : undefined, excludeAppointmentId: appointment.id, snapshot: replacingService ? undefined : snapshot, replacingService, durationMinutes: input.durationMinutes, listStarts: true, useOrganizationDefaults: false, purpose: "reschedule" })
    return { days: result.days.map((day) => ({ ...day, slots: day.slots.filter((slot) => slot.locationId === appointment.locationId) })).filter((day) => day.slots.length > 0) }
  }),
  update: permissionProcedure({ appointments: ["update"] }).input(updateAppointmentInput).mutation(async ({ ctx, input }) => {
    const appointment = await changeAppointment(ctx.prisma, ctx.organizationId, input, { actorUserId: ctx.user.id })
    return (await withAppointmentAvailabilityIssues(ctx.prisma, ctx.organizationId, [appointment]))[0]
  }),
  create: permissionProcedure({ appointments: ["create"] }).input(createAppointmentInput).mutation(({ ctx, input }) => {
    return createAppointment(ctx.prisma, ctx.organizationId, input, ctx.user.id)
  }),
  delete: permissionProcedure({ appointments: ["update"] }).input(idInput).mutation(({ ctx, input }) => deleteAppointment(ctx.prisma, ctx.organizationId, input.id)),
  updateNotes: permissionProcedure({ appointments: ["update"] }).input(notesInput).mutation(({ ctx, input }) => changeAppointment(ctx.prisma, ctx.organizationId, input, { actorUserId: ctx.user.id })),
  confirm: permissionProcedure({ appointments: ["update"] }).input(idInput).mutation(({ ctx, input }) => changeAppointment(ctx.prisma, ctx.organizationId, { ...input, status: "CONFIRMED" }, { actorUserId: ctx.user.id })),
  cancel: permissionProcedure({ appointments: ["update"] }).input(cancelInput).mutation(({ ctx, input }) => changeAppointment(ctx.prisma, ctx.organizationId, { ...input, status: "CANCELLED" }, { actorUserId: ctx.user.id })),
  reschedule: permissionProcedure({ appointments: ["update"] }).input(rescheduleInput).mutation(({ ctx, input }) => changeAppointment(ctx.prisma, ctx.organizationId, input, { actorUserId: ctx.user.id })),
  checkIn: permissionProcedure({ appointments: ["update"] }).input(idInput).mutation(({ ctx, input }) => changeAppointment(ctx.prisma, ctx.organizationId, { ...input, status: "CHECKED_IN" }, { actorUserId: ctx.user.id })),
  start: permissionProcedure({ appointments: ["update"] }).input(idInput).mutation(({ ctx, input }) => changeAppointment(ctx.prisma, ctx.organizationId, { ...input, status: "IN_PROGRESS" }, { actorUserId: ctx.user.id })),
  complete: permissionProcedure({ appointments: ["update"] }).input(idInput).mutation(({ ctx, input }) => changeAppointment(ctx.prisma, ctx.organizationId, { ...input, status: "COMPLETED" }, { actorUserId: ctx.user.id })),
  markNoShow: permissionProcedure({ appointments: ["update"] }).input(idInput).mutation(({ ctx, input }) => changeAppointment(ctx.prisma, ctx.organizationId, { ...input, status: "NO_SHOW" }, { actorUserId: ctx.user.id })),
} satisfies TRPCRouterRecord
