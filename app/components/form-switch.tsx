import type { ComponentProps, ReactNode } from "react"

import FormLabel from "~/components/form-label"
import { Switch } from "~/components/ui/switch"
import { cn } from "~/lib/utils"

type FormSwitchProps = ComponentProps<typeof Switch> & {
  label: ReactNode
  description?: ReactNode
  error?: ReactNode
  showError?: boolean
}

export function FormSwitch({ label, description, error, showError = true, className, ...props }: FormSwitchProps) {
  return (
    <FormLabel
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1"
      label={label}
      description={description}
      error={error}
      showError={showError}
      labelGroupClassName="col-start-1 row-start-1"
      descriptionClassName="col-start-1 row-start-2"
    >
      <Switch {...props} aria-invalid={Boolean(error)} className={cn("col-start-2 row-span-2 row-start-1 justify-self-end", className)} />
    </FormLabel>
  )
}
