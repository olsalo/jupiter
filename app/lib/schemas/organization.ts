import { isOnboardingCountryCode } from "~/lib/countries"
import { z } from "~/lib/zod"

export const organizationSettingsFormSchema = z.object({
  businessName: z.string().trim().min(1).max(100),
  location: z
    .string()
    .trim()
    .toLowerCase()
    .length(2)
    .refine(isOnboardingCountryCode),
  timezone: z.string().trim().min(1).max(100),
})

export type OrganizationSettingsFormInput = z.infer<
  typeof organizationSettingsFormSchema
>
