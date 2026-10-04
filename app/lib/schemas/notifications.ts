import { z } from "~/lib/zod"

export const notificationSettingsSchema = z.object({
  newResponseEmail: z.boolean(),
})

export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>
