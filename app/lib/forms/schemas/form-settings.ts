import { z } from "~/lib/zod"
import { formIdInput } from "./form-draft"

export const formSettingsFieldsSchema = z.object({
  emailCollection: z.enum(["NONE", "OPTIONAL", "REQUIRED"]),
  limitOneResponsePerEmail: z.boolean(),
  status: z.boolean(),
  startsAt: z.iso.datetime({ offset: true }).nullable(),
  closesAt: z.iso.datetime({ offset: true }).nullable(),
  submitButtonText: z.string().trim().min(1).max(100),
  successMessage: z.string().trim().min(1).max(2000),
  redirectUrl: z.string().trim().pipe(z.url({ protocol: /^https?$/ })).nullable(),
  theme: z.enum(["SYSTEM", "LIGHT", "DARK"]),
  accentColor: z.string().regex(/^#[\da-f]{6}$/i).nullable(),
}).strict()

export const formSettingsSchema = formSettingsFieldsSchema.superRefine((settings, context) => {
  if (settings.limitOneResponsePerEmail && settings.emailCollection !== "REQUIRED") {
    context.addIssue({ code: "custom", path: ["emailCollection"], message: "emailRequired" })
  }
  if (!isFormScheduleValid(settings)) {
    context.addIssue({ code: "custom", path: ["closesAt"], message: "invalidSchedule" })
  }
})

export type FormScheduleSettings = Pick<z.infer<typeof formSettingsFieldsSchema>, "startsAt" | "closesAt">

export function isFormScheduleValid({ startsAt, closesAt }: FormScheduleSettings) {
  return !startsAt || !closesAt || new Date(closesAt).getTime() > new Date(startsAt).getTime()
}

// Each settings row owns its form. Read the other date from the current schedule,
// rather than from the row's initial defaults, which may now be out of date.
export function createFormSettingSchema(field: keyof FormSettingsInput, settings: FormScheduleSettings) {
  return formSettingsFieldsSchema.superRefine((values, context) => {
    if (field !== "startsAt" && field !== "closesAt") return
    const schedule = {
      startsAt: field === "startsAt" ? values.startsAt : settings.startsAt,
      closesAt: field === "closesAt" ? values.closesAt : settings.closesAt,
    }
    if (!isFormScheduleValid(schedule)) {
      context.addIssue({ code: "custom", path: [field], message: "invalidSchedule" })
    }
  })
}

export const updateFormSettingsInput = formIdInput.extend({
  settings: formSettingsFieldsSchema.partial().refine((settings) => Object.keys(settings).length > 0),
})

export type FormSettings = z.infer<typeof formSettingsSchema>
export type FormSettingsInput = FormSettings
export type FormSettingsPatch = z.infer<typeof updateFormSettingsInput>["settings"]
