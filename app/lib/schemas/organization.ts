import { isOnboardingCountryCode } from "~/lib/localization/countries"
import countries from "~/lib/localization/data/countries.json"
import { z } from "~/lib/validation/zod"
import { isCurrencyCode } from "~/lib/localization/currencies"

export const timezone = z.string().trim().min(1).max(100).refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value })
    return true
  } catch { return false }
})
const country = z.string().trim().toUpperCase().length(2).refine((value) => countries.some((country) => country.code.toUpperCase() === value))
const currency = z.string().trim().toUpperCase().length(3).refine(isCurrencyCode)
const minutes = z.number().int().min(0).max(525600)
const reference = z.string().min(1).max(128).nullable().optional()

export const appointmentSettingsInput = z.object({
  businessName: z.string().trim().min(1).max(100).optional(),
  businessId: z.string().trim().max(50).nullable().optional(),
  timezone: timezone.optional(), country: country.optional(), currency: currency.optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
  bookingEnabled: z.boolean().optional(),
  allowSimultaneousBookings: z.boolean().optional(),
  defaultSlotIntervalMinutes: z.number().int().min(5).max(120).optional(),
  minBookingNoticeMinutes: minutes.optional(),
  maxBookingAdvanceDays: z.number().int().min(1).max(730).nullable().optional(),
  cancellationNoticeMinutes: minutes.optional(), rescheduleNoticeMinutes: minutes.optional(),
  requireCustomerEmail: z.boolean().optional(), requireCustomerPhone: z.boolean().optional(),
  autoConfirmAppointments: z.boolean().optional(),
  allowCustomerCancellation: z.boolean().optional(), allowCustomerRescheduling: z.boolean().optional(),
  defaultLocationId: reference, bookingTimezone: timezone.nullable().optional(), defaultBookingPageId: reference,
  defaultCalendarView: z.enum(["day", "week", "month", "agenda"]).optional(),
  defaultStartHour: z.number().int().min(0).max(23).optional(),
  defaultEndHour: z.number().int().min(1).max(24).optional(),
  showWeekends: z.boolean().optional(), showCancelledAppointments: z.boolean().optional(),
  calendarSlotIntervalMinutes: z.number().int().min(5).max(120).optional(),
  sendBookingConfirmations: z.boolean().optional(), sendCancellationEmails: z.boolean().optional(), sendRescheduleEmails: z.boolean().optional(),
  enableAppointmentReminders: z.boolean().optional(),
  reminderOffsetsMinutes: z.array(z.number().int().min(1).max(10080)).min(1).max(5).refine((values) => new Set(values).size === values.length, "Choose each reminder once").optional(),
  senderName: z.string().trim().min(1).max(120).regex(/^[^\r\n<>]+$/).nullable().optional(),
  replyToAddress: z.string().trim().toLowerCase().max(254).pipe(z.email()).nullable().optional(),
}).refine((value) => value.defaultStartHour === undefined || value.defaultEndHour === undefined || value.defaultStartHour < value.defaultEndHour, { path: ["defaultEndHour"], message: "Choose an end hour after the start hour" })

export const organizationSettingsFormSchema = z.object({
  businessName: z.string().trim().min(1).max(100),
  currency: z.string().trim().toUpperCase().length(3).refine(isCurrencyCode),
  location: z
    .string()
    .trim()
    .toLowerCase()
    .length(2)
    .refine(isOnboardingCountryCode),
  timezone,
  businessId: z.string().trim().max(50).nullable().optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
})

export type OrganizationSettingsFormInput = z.infer<
  typeof organizationSettingsFormSchema
>
