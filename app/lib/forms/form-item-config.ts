import { z } from "zod"

// IDs are also RVF field names. Keep them flat and clear of runtime identity keys.
export const formItemIdSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/).refine(
  (id) => !["respondentEmail", "__proto__", "constructor", "prototype"].includes(id),
)

export const textValidationSchema = z.object({
  minLength: z.number().int().min(0).max(100000).optional(),
  maxLength: z.number().int().min(0).max(100000).optional(),
}).strict().refine((value) => value.minLength === undefined || value.maxLength === undefined || value.minLength <= value.maxLength)
export const choiceValidationSchema = z.object({
  minSelections: z.number().int().min(0).max(1).optional(),
  maxSelections: z.number().int().min(1).max(1).optional(),
}).strict()

export const multipleChoiceValidationSchema = z.object({
  minSelections: z.number().int().min(0).max(101).optional(),
  maxSelections: z.number().int().min(1).max(101).optional(),
}).strict().refine((value) => value.minSelections === undefined || value.maxSelections === undefined || value.minSelections <= value.maxSelections)
