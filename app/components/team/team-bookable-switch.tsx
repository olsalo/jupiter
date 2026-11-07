import type { ComponentProps } from "react"
import { FormSwitch } from "~/components/forms/form-switch"
import { SubscriptionRequiredAlert } from "~/components/billing/subscription-required-alert"

export function TeamBookableSwitch({ subscriptionInactive, dimLabels = true, label, description, ...props }: ComponentProps<typeof FormSwitch> & { subscriptionInactive: boolean; dimLabels?: boolean }) {
  return <>
    <FormSwitch {...props} label={<span className={subscriptionInactive && dimLabels ? "opacity-64" : undefined}>{label}</span>} description={description ? <span className={subscriptionInactive && dimLabels ? "opacity-64" : undefined}>{description}</span> : undefined} disabled={Boolean(props.disabled || subscriptionInactive)} />
    {subscriptionInactive ? <SubscriptionRequiredAlert /> : null}
  </>
}
