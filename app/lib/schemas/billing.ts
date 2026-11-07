import { z } from "~/lib/validation/zod"

export const billingPlanSchema = z.object({
  planId: z.enum(["solo", "team"]),
  interval: z.enum(["month", "year"]),
  extraStaff: z.coerce.number<number>().int().min(0).max(1000),
  disableStaffIds: z.array(z.string().min(1)).max(1003).optional(),
}).superRefine((value, ctx) => {
  if (value.planId === "solo" && value.extraStaff !== 0) ctx.addIssue({ code: "custom", path: ["extraStaff"], message: "Extra people are available with Team" })
})

export type BillingPlanInput = z.infer<typeof billingPlanSchema>

export const billingPlanFormSchema = z.object({
  planId: billingPlanSchema.shape.planId,
  interval: billingPlanSchema.shape.interval,
  bookablePeople: z.number().int().min(1).max(1003),
}).superRefine((value, ctx) => {
  if (value.planId === "team" && value.bookablePeople < 3) ctx.addIssue({ code: "custom", path: ["bookablePeople"], message: "Team includes at least 3 bookable people" })
  if (value.planId === "solo" && value.bookablePeople !== 1) ctx.addIssue({ code: "custom", path: ["planId"], message: "Choose Team for more than one bookable person" })
}).transform(({ planId, interval, bookablePeople }) => ({
  planId,
  interval,
  extraStaff: planId === "team" ? bookablePeople - 3 : 0,
}))

export type BillingPlanFormValues = z.input<typeof billingPlanFormSchema>
