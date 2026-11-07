import { isOnboardingCountryCode } from "~/lib/localization/countries"
import { getOnboardingTimezone, isOnboardingCurrency } from "~/lib/localization/onboarding"
import { businessLocationSchema } from "~/lib/schemas/business-location"
import { z } from "~/lib/validation/zod"

export const onboardingFormSchema = z.object({
  businessName: z.string().trim().min(1).max(100),
  currency: z.string().trim().min(1)
    .pipe(z.string().toUpperCase().length(3).refine(isOnboardingCurrency)),
  location: z
    .string()
    .trim()
    .min(1)
    .pipe(z.string().toLowerCase().length(2).refine(isOnboardingCountryCode)),
  name: z.string().trim().min(1).max(100),
  timezone: z.string().trim().min(1).max(100)
    .pipe(z.string()
      .transform((value) => getOnboardingTimezone(value) ?? value)
      .refine((value) => getOnboardingTimezone(value) !== undefined)),
})

export const onboardingLocationSchema = businessLocationSchema.extend({
  addressLine1: businessLocationSchema.shape.addressLine1.min(1),
  postalCode: businessLocationSchema.shape.postalCode.min(1),
  city: businessLocationSchema.shape.city.min(1),
})

export type OnboardingLocationValues = z.infer<typeof onboardingLocationSchema>
