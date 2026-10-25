import { z } from "~/lib/validation/zod"

export const noteFormSchema = z.object({
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(1000),
})
