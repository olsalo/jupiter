import { z } from "~/lib/validation/zod"

export const adminBookingPageSchema = z.object({
  slug: z.string().trim().toLowerCase().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().max(120),
  description: z.string().trim().max(2000),
  successMessage: z.string().trim().max(2000),
  accentColor: z.string().regex(/^#[\da-f]{6}$/i).nullable(),
  isActive: z.boolean(),
  allowStaffSelection: z.boolean(),
  allowLocationSelection: z.boolean(),
  defaultLocationId: z.string(),
  serviceIds: z.array(z.string().min(1)).max(500),
  staffIds: z.array(z.string().min(1)).max(500),
})

export type AdminBookingPageValues = z.output<typeof adminBookingPageSchema>

export const adminBookingPageFormSchema = adminBookingPageSchema.omit({ isActive: true, allowStaffSelection: true })
export type AdminBookingPageFormValues = z.output<typeof adminBookingPageFormSchema>
