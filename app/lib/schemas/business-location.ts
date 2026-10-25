import countries from "~/lib/localization/data/countries.json"
import { z } from "~/lib/validation/zod"

export const businessLocationSchema = z.object({
  id: z.string().min(1).max(128).nullable(),
  name: z.string().trim().min(1).max(120),
  addressLine1: z.string().trim().max(200),
  addressLine2: z.string().trim().max(200),
  postalCode: z.string().trim().max(30),
  city: z.string().trim().max(100),
  country: z.string().length(2).refine((value) => countries.some((country) => country.code.toUpperCase() === value)),
  phone: z.string().trim().max(40),
  email: z.string().trim().toLowerCase().pipe(z.union([z.literal(""), z.email()])),
})

export type BusinessLocationValues = z.infer<typeof businessLocationSchema>
