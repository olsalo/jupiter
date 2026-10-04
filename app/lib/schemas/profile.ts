import { z } from "~/lib/zod"

export const profileFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
})

export type ProfileFormInput = z.infer<typeof profileFormSchema>
