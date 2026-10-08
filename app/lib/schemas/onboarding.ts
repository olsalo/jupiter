import { isOnboardingCountryCode } from "~/lib/countries"
import { isCurrencyCode } from "~/lib/currencies"
import { z } from "~/lib/zod"

export const onboardingFormSchema = z.object({
  businessName: z.string().trim().min(1).max(100),
  currency: z.string().trim().toUpperCase().length(3).refine(isCurrencyCode),
  location: z
    .string()
    .trim()
    .toLowerCase()
    .length(2)
    .refine(isOnboardingCountryCode),
  name: z.string().trim().min(1).max(100),
  timezone: z.string().trim().min(1).max(100),
})
