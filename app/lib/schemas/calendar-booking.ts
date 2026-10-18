import { customerInput, id } from "~/lib/schemas/appointments"
import { z } from "~/lib/zod"

export const calendarBookingCustomerSchema = z.object({
  name: customerInput.shape.firstName,
  email: z.union([z.literal(""), customerInput.shape.email.unwrap().unwrap()]).transform((value) => value || null),
  phone: z.union([z.literal(""), customerInput.shape.phone.unwrap().unwrap()]).transform((value) => value || null),
  notes: z.string().trim().max(2000),
})

export const calendarCustomerCreateSchema = calendarBookingCustomerSchema.omit({ notes: true })

export const calendarBookingSchema = z.object({
  customerId: id,
  notes: z.string().trim().max(2000),
})
