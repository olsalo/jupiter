import { z } from "~/lib/zod"

export const communicationsSettingsSchema = z.object({
  sendBookingConfirmations: z.boolean(),
  sendCancellationEmails: z.boolean(),
  sendRescheduleEmails: z.boolean(),
  enableAppointmentReminders: z.boolean(),
  reminderOffsetsMinutes: z.array(z.number().int().min(1).max(10080)).min(1).max(5).refine((values) => new Set(values).size === values.length, "Choose each reminder once"),
  senderName: z.string().trim().max(120).regex(/^[^\r\n<>]*$/),
  replyToAddress: z.union([z.literal(""), z.string().trim().toLowerCase().max(254).pipe(z.email())]),
})

export const defaultCommunicationsSettings = {
  sendBookingConfirmations: true,
  sendCancellationEmails: true,
  sendRescheduleEmails: true,
  enableAppointmentReminders: true,
  reminderOffsetsMinutes: [1440],
  senderName: "",
  replyToAddress: "",
}

export type CommunicationsSettingsValues = z.infer<typeof communicationsSettingsSchema>

export function readCommunicationsSettings(settings: {
  sendBookingConfirmations: boolean
  sendCancellationEmails: boolean
  sendRescheduleEmails: boolean
  enableAppointmentReminders: boolean
  reminderOffsetsMinutes: number[]
  senderName: string | null
  replyToAddress: string | null
} | null) {
  return communicationsSettingsSchema.parse(settings ? { ...settings, senderName: settings.senderName ?? "", replyToAddress: settings.replyToAddress ?? "" } : defaultCommunicationsSettings)
}
