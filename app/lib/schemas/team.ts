import { z } from "~/lib/validation/zod"
import { ruleInput } from "~/lib/schemas/appointments"

export function workingHoursSchema(endTimeError = "End time must be after start time") {
  return z.array(z.object({ ...ruleInput.shape, isActive: z.boolean().default(true) }).superRefine((rule, ctx) => {
    if (rule.endMinute <= rule.startMinute) ctx.addIssue({ code: "custom", path: ["endMinute"], message: endTimeError })
    if (rule.validFrom && rule.validUntil && rule.validUntil <= rule.validFrom) ctx.addIssue({ code: "custom", path: ["endMinute"], message: endTimeError })
  })).max(100).optional()
}

export const inviteFormSchema = z.object({
  staffMemberId: z.string().min(1).max(128).optional(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["member", "admin"]).default("member"),
  sendEmail: z.boolean().default(true),
})

export type InviteFormValues = z.infer<typeof inviteFormSchema>

const optionalEmail = z.string().trim().toLowerCase().max(254).superRefine((value, ctx) => {
  if (!value) return
  const result = z.email().safeParse(value)
  if (!result.success) for (const issue of result.error.issues) ctx.addIssue({ ...issue })
})
const optionalPhone = z.string().trim().max(40).transform((value) => value.replace(/[\s().-]/g, "")).refine((value) => !value || /^\+?[0-9]{5,20}$/.test(value))
const reference = z.string().min(1).max(128)
export const personFields = {
  name: z.string().trim().min(1).max(120),
  email: optionalEmail.default(""),
  phone: optionalPhone.default(""),
  bio: z.string().trim().max(2000).default(""),
  timezone: z.string().trim().max(100).refine((value) => {
    if (!value) return true
    try { new Intl.DateTimeFormat("en", { timeZone: value })
      return true
    } catch { return false }
  }).default(""),
  takesAppointments: z.boolean().default(true),
  isActive: z.boolean().default(true),
  serviceIds: z.array(reference).max(100).refine((ids) => new Set(ids).size === ids.length).default([]),
  locationIds: z.array(reference).max(100).refine((ids) => new Set(ids).size === ids.length).default([]),
}
export const addPersonSchema = z.object({
  ...personFields,
  giveAppAccess: z.boolean().default(false),
  role: z.enum(["member", "admin"]).default("member"),
  sendEmail: z.boolean().default(true),
}).superRefine((value, ctx) => {
  if (value.giveAppAccess && !value.email) {
    const result = z.email().safeParse(value.email)
    if (!result.success) for (const issue of result.error.issues) ctx.addIssue({ ...issue, path: ["email"] })
  }
  if (!value.giveAppAccess && !value.takesAppointments) ctx.addIssue({ code: "custom", path: ["takesAppointments"], message: "Enable appointments or give app access" })
})
export const updatePersonSchema = z.object({ id: reference, ...personFields, workingHours: workingHoursSchema(), breaks: workingHoursSchema() })
export const personIdSchema = z.object({ id: reference })
export const memberRoleSchema = z.object({ memberId: reference, role: z.enum(["member", "admin"]) })
export type AddPersonValues = z.infer<typeof addPersonSchema>
export type UpdatePersonValues = z.infer<typeof updatePersonSchema>

export type AddPersonInput = z.input<typeof addPersonSchema>

export function personFormSchema(editing: boolean, hasStaff: boolean, messages: { useRequired: string; staffRequired: string; endTime?: string }, selfSettings = false) {
  return z.object({ ...addPersonSchema.shape, workingHours: workingHoursSchema(messages.endTime), breaks: workingHoursSchema(messages.endTime) }).superRefine((value, ctx) => {
    if (!editing && value.giveAppAccess && !value.email) {
      const result = z.email().safeParse(value.email)
      if (!result.success) for (const issue of result.error.issues) ctx.addIssue({ ...issue, path: ["email"] })
    }
    if (!editing && !value.giveAppAccess && !value.takesAppointments) ctx.addIssue({ code: "custom", path: ["takesAppointments"], message: messages.useRequired })
    if (editing && !hasStaff && !value.takesAppointments && !selfSettings) ctx.addIssue({ code: "custom", path: ["takesAppointments"], message: messages.staffRequired })
  })
}

export type PersonFormValues = z.infer<ReturnType<typeof personFormSchema>>
export type PersonFormInput = z.input<ReturnType<typeof personFormSchema>>
export type PersonFormFields = Omit<PersonFormValues, "workingHours" | "breaks"> & { workingHours: NonNullable<PersonFormValues["workingHours"]>; breaks: NonNullable<PersonFormValues["breaks"]> }
