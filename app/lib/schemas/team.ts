import { z } from "~/lib/zod"

export const inviteFormSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["member", "admin"]).default("member"),
})

export type InviteFormValues = z.infer<typeof inviteFormSchema>
