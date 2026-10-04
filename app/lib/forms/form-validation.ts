import { z } from "zod"
import type { FormItem, FormSnapshot } from "./form-types"
import { getSetting } from "./form-item-settings"

export function otherValue(item: Pick<FormItem, "id">) {
  return `other:${item.id}`
}

export function otherName(item: Pick<FormItem, "id">) {
  return `${item.id}:other`
}

export function createAnswerSchema(
  items: FormItem[],
  requiredMessage: string,
  otherMessage: string,
) {
  const shape: Record<string, z.ZodType<string | string[], string | string[]>> = {}
  for (const item of items) {
    if (item.type === "SHORT_TEXT" || item.type === "LONG_TEXT") {
      const minimum = getSetting(item.validation, "minLength")
      const maximum = getSetting(item.validation, "maxLength")
      shape[item.id] = z.string().trim().max(typeof maximum === "number" ? maximum : 100000).superRefine((value, context) => {
        if ((item.required && !value) || (value && typeof minimum === "number" && value.length < minimum)) {
          context.addIssue({ code: "custom", message: requiredMessage })
        }
      })
    } else if (item.type === "SINGLE_CHOICE" || item.type === "MULTIPLE_CHOICE") {
      const allowed = item.options.map((option) => option.value)
      if (getSetting(item.settings, "allowOther") === true) {
        allowed.push(otherValue(item))
        shape[otherName(item)] = z.string().trim().max(2000)
      }
      const required = item.required || getSetting(item.validation, "minSelections") === 1
      if (item.type === "MULTIPLE_CHOICE") {
        const minimum = getSetting(item.validation, "minSelections")
        const maximum = getSetting(item.validation, "maxSelections")
        shape[item.id] = z.array(z.string()).max(101).refine(
          (values) => values.length >= Math.max(required ? 1 : 0, typeof minimum === "number" ? minimum : 0)
            && (typeof maximum !== "number" || values.length <= maximum)
            && new Set(values).size === values.length
            && values.every((value) => allowed.includes(value)),
          requiredMessage,
        )
      } else {
        shape[item.id] = z.string().refine(
          (value) => (!required && value === "") || allowed.includes(value),
          requiredMessage,
        )
      }
    }
  }

  return z.object(shape).strict().superRefine((answers, context) => {
    for (const item of items) {
      const value = answers[item.id]
      const selectedOther = item.type === "SINGLE_CHOICE" ? value === otherValue(item)
        : item.type === "MULTIPLE_CHOICE" && Array.isArray(value) && value.includes(otherValue(item))
      if (!selectedOther) continue
      const other = answers[otherName(item)]
      if (typeof other === "string" && other.trim()) continue
      context.addIssue({ code: "custom", message: otherMessage, path: [otherName(item)] })
    }
  })
}

export function createSubmissionSchema(snapshot: FormSnapshot, messages: { required: string, other: string, email: string }) {
  const items = snapshot.sections.flatMap((section) => section.items)
  const emailSchema = z.string().trim().toLowerCase().max(320)
  const shape: Record<string, z.ZodType<string | string[], string | string[]>> & { respondentEmail: typeof emailSchema } = { ...createAnswerSchema(items, messages.required, messages.other).shape, respondentEmail: emailSchema }
  return z.object(shape).strict().superRefine((values, context) => {
    const answers: Record<string, string | string[]> = { ...values }
    delete answers.respondentEmail
    const result = createAnswerSchema(items, messages.required, messages.other).safeParse(answers)
    if (!result.success) result.error.issues.forEach((issue) => context.addIssue({ code: "custom", path: issue.path, message: issue.message }))
    const mode = snapshot.settings.emailCollection
    if ((mode === "REQUIRED" && !values.respondentEmail) || (mode !== "NONE" && values.respondentEmail && !z.email().safeParse(values.respondentEmail).success)) {
      context.addIssue({ code: "custom", path: ["respondentEmail"], message: messages.email })
    }
    if (mode === "NONE" && values.respondentEmail) {
      context.addIssue({ code: "custom", path: ["respondentEmail"], message: messages.email })
    }
  })
}

export function defaultAnswerValues(snapshot: FormSnapshot) {
  return Object.fromEntries([
    ["respondentEmail", ""],
    ...snapshot.sections.flatMap((section) => section.items).filter((item) => item.type !== "TEXT_BLOCK").flatMap((item) => (
      getSetting(item.settings, "allowOther") === true
        ? [[item.id, item.defaultValue ?? (item.type === "MULTIPLE_CHOICE" ? [] : "")], [otherName(item), ""]]
        : [[item.id, item.defaultValue ?? (item.type === "MULTIPLE_CHOICE" ? [] : "")]]
    )),
  ])
}
