import { isOnboardingCountryCode } from "~/lib/countries"
import { z } from "~/lib/zod"
import { isCurrencyCode } from "~/lib/currencies"

export const organizationSettingsFormSchema = z.object({
  businessName: z.string().trim().min(1).max(100),
  currency: z.string().trim().toUpperCase().length(3).refine(isCurrencyCode),
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
