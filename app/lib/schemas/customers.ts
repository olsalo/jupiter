import { customerInput } from "~/lib/schemas/appointments"
import { z } from "~/lib/zod"

export const customerFormSchema = customerInput.pick({ firstName: true, lastName: true, email: true, phone: true }).extend({
  lastName: z.string().trim().max(120).transform((value) => value || null),
  email: z.union([z.literal(""), customerInput.shape.email.unwrap().unwrap()]).transform((value) => value || null),
  phone: z.union([z.literal(""), customerInput.shape.phone.unwrap().unwrap()]).transform((value) => value || null),
})

export const customerNoteSchema = z.object({ body: z.string().trim().min(1).max(4000) })
