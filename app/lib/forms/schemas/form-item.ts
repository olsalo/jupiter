import { z } from "~/lib/zod"

export const textFormItemSchema = z.object({
  label: z.string().trim().max(500),
  description: z.string().trim().max(2000),
  required: z.boolean(),
})

export type TextFormItemInput = z.input<typeof textFormItemSchema>

export const textBlockSchema = z.object({
  label: z.string().trim().max(500),
  description: z.string().trim().max(2000),
})

export type TextBlockInput = z.input<typeof textBlockSchema>

export const singleChoiceFormItemSchema = textFormItemSchema.extend({
  options: z.array(z.object({
    id: z.string().min(1),
    label: z.string().trim().min(1).max(500),
    value: z.string().min(1),
  })).min(1).max(100),
  allowOther: z.boolean(),
})

export type SingleChoiceFormItemInput = z.input<typeof singleChoiceFormItemSchema>
