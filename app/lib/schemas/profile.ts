import { z } from "~/lib/validation/zod"

export const profileFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
})

export type ProfileFormInput = z.infer<typeof profileFormSchema>
