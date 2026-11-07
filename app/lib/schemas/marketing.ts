import { z } from "~/lib/validation/zod"

export const marketingAccessRequestSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()),
})
