import type { FormApi } from "@rvf/react"
import { useEffect } from "react"
import type { AppFormState } from "~/components/forms/app-form"
import { adminBookingPageFormSchema, type AdminBookingPageFormValues } from "~/lib/schemas/admin-booking-page"

export function BookingPageFormState({ form, saved, onChange }: {
  form: FormApi<AdminBookingPageFormValues>
  saved: AdminBookingPageFormValues
  onChange: (state: AppFormState) => void
}) {
  const isDirty = (Object.keys(adminBookingPageFormSchema.shape) as (keyof AdminBookingPageFormValues)[])
    .some((name) => JSON.stringify(form.value(name)) !== JSON.stringify(saved[name]))
  const isSubmitting = form.formState.isSubmitting

  useEffect(() => {
    onChange({ isDirty, isSubmitting })
  }, [isDirty, isSubmitting, onChange])

  return null
}
