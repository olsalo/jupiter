import { z } from "~/lib/zod"

const notice = z.number().int().min(0).max(525600)

export const bookingSettingsSchema = z.object({
  bookingEnabled: z.boolean(),
  minBookingNoticeMinutes: notice,
  maxBookingAdvanceDays: z.number().int().min(1).max(730).nullable(),
  allowCustomerCancellation: z.boolean(),
  cancellationNoticeMinutes: notice,
  allowCustomerRescheduling: z.boolean(),
  rescheduleNoticeMinutes: notice,
  requireCustomerEmail: z.boolean(),
  requireCustomerPhone: z.boolean(),
})

export type BookingSettingsValues = z.output<typeof bookingSettingsSchema>

export const bookingWindowSchema = bookingSettingsSchema.pick({
  minBookingNoticeMinutes: true,
  maxBookingAdvanceDays: true,
  cancellationNoticeMinutes: true,
  rescheduleNoticeMinutes: true,
})

export type BookingWindowValues = z.output<typeof bookingWindowSchema>

export const defaultBookingSettings: BookingSettingsValues = {
  bookingEnabled: true,
  minBookingNoticeMinutes: 0,
  maxBookingAdvanceDays: null,
  allowCustomerCancellation: true,
  cancellationNoticeMinutes: 0,
  allowCustomerRescheduling: true,
  rescheduleNoticeMinutes: 0,
  requireCustomerEmail: true,
  requireCustomerPhone: false,
}
