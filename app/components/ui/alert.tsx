import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"

import Icon from "~/components/icons"
import { cn } from "@coss/ui/lib/utils"

const alertVariants = cva(
  "@container/alert relative grid w-full min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 rounded-xl border px-3.5 py-3 text-card-foreground text-sm has-[>svg]:has-data-[slot=alert-action]:grid-cols-[calc(var(--spacing)*4)_minmax(0,1fr)_auto] has-[>svg]:grid-cols-[calc(var(--spacing)*4)_minmax(0,1fr)] has-data-[slot=alert-action]:grid-cols-[minmax(0,1fr)_auto] [&>svg]:h-lh [&>svg]:w-4",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default:
          "bg-transparent dark:bg-input/32 [&>svg]:text-muted-foreground",
        error:
          "border-destructive/32 bg-destructive/4 [&>svg]:text-destructive",
        info: "border-info/32 bg-info/4 [&>svg]:text-info",
        success: "border-success/32 bg-success/4 [&>svg]:text-success",
        warning: "border-warning/32 bg-warning/4 [&>svg]:text-warning",
      },
    },
  },
)

const alertIcons = {
  default: "alertCircle",
  info: "alertCircle",
  success: "circleCheck",
  warning: "alertTriangle",
  error: "exclamationCircle",
} as const

function Alert({
  className,
  variant,
  children,
  showIcon = true,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants> & { showIcon?: boolean }) {
  return (
    <div
      className={cn(alertVariants({ variant }), className)}
      data-slot="alert"
      role="alert"
      {...props}
    >
      {showIcon ? <Icon aria-hidden={true} name={alertIcons[variant ?? "default"]} /> : null}
      {children}
    </div>
  )
}

function AlertTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("col-start-1 -col-end-1 min-w-0 font-medium wrap-anywhere [svg~&]:col-start-2 @sm/alert:col-end-auto", className)}
      data-slot="alert-title"
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "col-start-1 -col-end-1 flex min-w-0 flex-col gap-2.5 text-muted-foreground wrap-anywhere [svg~&]:col-start-2 @sm/alert:col-end-auto",
        className,
      )}
      data-slot="alert-description"
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "col-start-1 -col-end-1 mt-2 flex flex-wrap items-center gap-2 [svg~&]:col-start-2 @sm/alert:col-start-2 @sm/alert:col-end-auto @sm/alert:row-start-1 @sm/alert:row-end-3 @sm/alert:mt-0 @sm/alert:self-center @sm/alert:[svg~&]:col-start-3",
        className,
      )}
      data-slot="alert-action"
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
