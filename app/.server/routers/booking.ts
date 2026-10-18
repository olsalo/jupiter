import type { TRPCRouterRecord } from "@trpc/server"
import { publicProcedure } from "../trpc"
import { bookingCodeInput, createBookingInput, pageInput, publicCancelInput, publicRescheduleInput, publicSlotInput } from "~/lib/schemas/appointments"
import { getBookingPage, resolveBookingPage } from "../services/booking-page"
import { getAvailableSlots } from "../services/availability"
import { changeAppointment, createAppointment, publicAppointment } from "../services/appointments"
import { limitBookingLookup, limitPublicBooking } from "../services/booking-rate-limit"
import { notFound } from "../services/scheduling"

const bookingProcedure = publicProcedure.use(async ({ ctx, next, path }) => {
  const started = performance.now()
  limitBookingLookup(ctx.headers)
  const result = await next()
  console.info(JSON.stringify({
    event: result.ok ? "booking.success" : "booking.error", procedure: path,
    durationMs: Math.round(performance.now() - started), errorCode: result.ok ? undefined : result.error.code,
  }))
  return result
})
async function bookingIdentity(ctx: { prisma: typeof import("~/lib/prisma.server").prisma; headers: Headers }, bookingCode: string, mutation: boolean) {
  const appointment = await ctx.prisma.appointment.findUnique({ where: { bookingCode }, select: { id: true, organizationId: true } })
  if (!appointment) notFound()
  await limitPublicBooking(ctx.prisma, ctx.headers, appointment.organizationId, mutation)
  return appointment
}
export const bookingRouter = {
  getPage: bookingProcedure.input(pageInput).query(async ({ ctx, input }) => {
    const { organization } = await resolveBookingPage(ctx.prisma, input)
    await limitPublicBooking(ctx.prisma, ctx.headers, organization.id, false)
    return getBookingPage(ctx.prisma, input)
  }),
  getAvailableSlots: bookingProcedure.input(publicSlotInput).query(async ({ ctx, input }) => {
    const { organization, locationId, allowedStaffIds } = await resolveBookingPage(ctx.prisma, input)
    await limitPublicBooking(ctx.prisma, ctx.headers, organization.id, false)
    return getAvailableSlots(ctx.prisma, organization.id, { ...input, locationId }, { allowedStaffIds })
  }),
  create: bookingProcedure.input(createBookingInput).mutation(async ({ ctx, input }) => {
    const { organization } = await resolveBookingPage(ctx.prisma, input)
    await limitPublicBooking(ctx.prisma, ctx.headers, organization.id, true)
    const appointment = await createAppointment(ctx.prisma, organization.id, input)
    return publicAppointment(ctx.prisma, appointment.bookingCode)
  }),
  getByCode: bookingProcedure.input(bookingCodeInput).query(async ({ ctx, input }) => {
    await bookingIdentity(ctx, input.bookingCode, false)
    return publicAppointment(ctx.prisma, input.bookingCode)
  }),
  cancel: bookingProcedure.input(publicCancelInput).mutation(async ({ ctx, input }) => {
    const appointment = await bookingIdentity(ctx, input.bookingCode, true)
    await changeAppointment(ctx.prisma, appointment.organizationId, { id: appointment.id, status: "CANCELLED", reason: input.reason }, { public: true })
    return publicAppointment(ctx.prisma, input.bookingCode)
  }),
  reschedule: bookingProcedure.input(publicRescheduleInput).mutation(async ({ ctx, input }) => {
    const appointment = await bookingIdentity(ctx, input.bookingCode, true)
    await changeAppointment(ctx.prisma, appointment.organizationId, { id: appointment.id, startsAt: input.startsAt }, { public: true })
    return publicAppointment(ctx.prisma, input.bookingCode)
  }),
} satisfies TRPCRouterRecord
