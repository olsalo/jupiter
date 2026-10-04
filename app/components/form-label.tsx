import type { ReactNode } from "react"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"

type FormLabelProps = {
  error?: ReactNode
  label: ReactNode
  description?: ReactNode
  children: ReactNode
  errorPlacement?: "inline" | "below"
  descriptionPlacement?: "before" | "after"
  className?: string
  labelClassName?: string
  labelGroupClassName?: string
  descriptionClassName?: string
  errorClassName?: string
  showError?: boolean
}

export default function FormLabel({
  error,
  label,
  description,
  children,
  errorPlacement = "inline",
  descriptionPlacement = "after",
  className,
  labelClassName,
  labelGroupClassName,
  descriptionClassName,
  errorClassName,
  showError = true,
}: FormLabelProps) {
  const errorMessage = showError && error ? <FieldError className={errorClassName} match>{error}</FieldError> : null
  const heading = (
    <>
      <div className="flex w-full justify-between gap-3">
        <FieldLabel className={labelClassName}>{label}</FieldLabel>
        {errorPlacement === "inline" ? errorMessage : null}
      </div>
      {description && descriptionPlacement === "before" ? <FieldDescription className={descriptionClassName}>{description}</FieldDescription> : null}
    </>
  )

  return (
    <Field className={className} invalid={Boolean(error)}>
      {labelGroupClassName ? <div className={labelGroupClassName}>{heading}</div> : heading}
      {children}
      {errorPlacement === "below" ? errorMessage : null}
      {description && descriptionPlacement === "after" ? <FieldDescription className={descriptionClassName}>{description}</FieldDescription> : null}
    </Field>
  )
}
