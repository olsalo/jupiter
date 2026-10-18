import { z } from "~/lib/zod"
import { serviceCreateInput } from "./appointments"

export function serviceFormSchema(message: (key: string) => string) {
  const number = (min: number, max: number, error: string) => z.string().trim().min(1, message(error))
    .transform(Number).pipe(z.number().int(message(error)).min(min, message(error)).max(max, message(error)))
  return z.object({
    name: z.string().trim().min(1, message("nameRequired")).max(120, message("nameLength")),
    categoryId: z.string().trim().max(128, message("invalidAssignment")).default("").transform((value) => value || null),
    description: z.string().trim().max(2000, message("descriptionLength")),
    durationMinutes: number(5, 1440, "durationError"),
    bufferBeforeMinutes: number(0, 240, "bufferError"),
    bufferAfterMinutes: number(0, 240, "bufferError"),
    price: z.string().trim().transform((value) => value.replace(",", ".") || null).pipe(z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, message("priceError")).nullable()),
    deliveryType: serviceCreateInput.shape.deliveryType.removeDefault(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, message("colorError")),
    isActive: z.boolean(),
    staffIds: serviceCreateInput.shape.staffIds.removeDefault(),
    locationIds: serviceCreateInput.shape.locationIds.removeDefault(),
  })
}

export type ServiceFormInput = z.input<ReturnType<typeof serviceFormSchema>>
export type ServiceFormValues = z.output<ReturnType<typeof serviceFormSchema>>

export function serviceCategorySchema(message: (key: string) => string) {
  return z.object({
    name: z.string().trim().min(1, message("nameRequired")).max(120, message("nameLength")),
    serviceIds: z.array(z.string().trim().min(1)).max(100, message("categoryServicesError"))
      .refine((ids) => new Set(ids).size === ids.length, message("categoryServicesError")),
  })
}

export type ServiceCategoryValues = z.infer<ReturnType<typeof serviceCategorySchema>>
