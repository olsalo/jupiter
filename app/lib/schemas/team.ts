import { z } from "~/lib/zod"

export const inviteFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["member", "admin"]).default("member"),
  sendEmail: z.boolean().default(true),
})

export type InviteFormValues = z.infer<typeof inviteFormSchema>
