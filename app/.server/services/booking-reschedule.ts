import { TRPCError } from "@trpc/server"
import { getAvailableSlots, type Slot } from "./availability"
import type { Database } from "./scheduling"
import { bookingManagementContext } from "./booking-management"
import { localDate } from "./time"

export { getBookingManagementPage as getReschedulePage } from "./booking-management"

export async function getRescheduleSlots(db: Database, input: { bookingCode: string; from: Date; to: Date }) {
  const { appointment, snapshot, policy, canReschedule } = await bookingManagementContext(db, input.bookingCode)
  if (!canReschedule || !snapshot || !appointment.staffMemberId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Contact the business to change this appointment" })
  }
  const result = await getAvailableSlots(db, appointment.organizationId, {
    serviceId: snapshot.serviceId,
    staffMemberId: appointment.staffMemberId,
    locationId: appointment.locationId ?? undefined,
    from: input.from,
    to: input.to,
  }, {
    purpose: "reschedule",
    excludeAppointmentId: appointment.id,
    snapshot,
    bookingPolicy: policy,
    useOrganizationDefaults: false,
  })
  const days = new Map<string, Slot[]>()
  for (const slot of result.days.flatMap((day) => day.slots)) {
    if (slot.locationId !== appointment.locationId || slot.startsAt === appointment.startsAt.toISOString()) continue
    const date = localDate(new Date(slot.startsAt), appointment.timezone)
    days.set(date, [...(days.get(date) ?? []), slot])
  }
  return { days: [...days].map(([date, slots]) => ({ date, slots })) }
}
