import type { Appointment, Service } from "../../../generated/prisma/client"

// Return plain money values so API types match JSON after SuperJSON transport
export function serializeService<T extends Service>(service: T) {
  return { ...service, price: service.price?.toString() ?? null, depositAmount: service.depositAmount?.toString() ?? null }
}

export function serializeAppointment<T extends Appointment>(appointment: T) {
  return {
    ...appointment,
    subtotalAmount: appointment.subtotalAmount.toString(), discountAmount: appointment.discountAmount.toString(),
    taxAmount: appointment.taxAmount.toString(), totalAmount: appointment.totalAmount.toString(), paidAmount: appointment.paidAmount.toString(),
  }
}
