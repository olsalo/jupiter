import { z } from "~/lib/zod"
import { singleChoiceFormItemSchema, textFormItemSchema } from "./form-item"
import { choiceValidationSchema, multipleChoiceValidationSchema, formItemIdSchema, textValidationSchema } from "../form-item-config"

export const formIdInput = z.object({ id: z.string().min(1) })
export const formHeadingSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(2000),
})
export type FormHeadingInput = z.input<typeof formHeadingSchema>
const layout = {
  row: z.number().int().min(0).optional(),
  column: z.number().int().min(0).max(11).optional(),
  width: z.number().int().min(1).max(12).optional(),
}
const inputConfig = {
  ...layout,
  placeholder: z.string().max(500).nullable().optional(),
  defaultValue: z.string().nullable().optional(),
}
const draftTextItemSchema = textFormItemSchema.extend({
  label: z.string().trim().max(500),
  ...inputConfig,
  validation: textValidationSchema.nullable().optional(),
})
const draftTextBlockSchema = z.object({
  id: formItemIdSchema,
  type: z.literal("TEXT_BLOCK"),
  label: z.string().trim().max(500),
  description: z.string().trim().max(2000),
  ...layout,
})
const draftChoiceItemSchema = singleChoiceFormItemSchema.extend({
  label: z.string().trim().max(500),
  ...inputConfig,
  validation: choiceValidationSchema.nullable().optional(),
  options: z.array(z.object({
    id: z.string().min(1).max(200),
    label: z.string().trim().max(500),
    value: z.string().min(1),
  })).min(1).max(100),
})
export const draftItemSchema = z.discriminatedUnion("type", [
  draftTextBlockSchema,
  draftTextItemSchema.extend({
    id: formItemIdSchema,
    type: z.literal("SHORT_TEXT"),
  }),
  draftTextItemSchema.extend({
    id: formItemIdSchema,
    type: z.literal("LONG_TEXT"),
  }),
  draftChoiceItemSchema.extend({
    id: formItemIdSchema,
    type: z.literal("SINGLE_CHOICE"),
  }),
  draftChoiceItemSchema.extend({
    id: formItemIdSchema,
    type: z.literal("MULTIPLE_CHOICE"),
    defaultValue: z.array(z.string()).max(101).nullable().optional(),
    validation: multipleChoiceValidationSchema.nullable().optional(),
  }),
  z.object({
    id: formItemIdSchema,
    type: z.enum([
      "EMAIL", "PHONE", "URL", "NUMBER", "DATE", "TIME", "DATETIME",
      "DROPDOWN", "CHECKBOX", "FILE",
      "HEADING", "DIVIDER", "IMAGE", "LINEAR_SCALE", "RATING", "MULTIPLE_CHOICE_GRID", "CHECKBOX_GRID",
    ]),
  }),
])
export const saveDraftInput = z.object({
  id: z.string().min(1),
  revision: z.number().int().min(0),
  title: z.string().trim().max(500).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  sections: z.array(z.object({
    id: z.string().min(1),
    items: z.array(draftItemSchema).max(500),
  })).min(1).max(100),
})
