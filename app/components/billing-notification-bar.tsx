import { useTranslation } from "react-i18next"

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import type { BillingNotification } from "~/lib/billing"
import { cn } from "~/lib/utils"

export function BillingNotificationBar({
  notification,
  variant = "banner",
}: {
  notification: BillingNotification | null | undefined
  variant?: "banner" | "inline"
}) {
  const { t } = useTranslation()

  if (!notification) {
    return null
  }

  const isError =
    notification.type === "payment-failed" ||
    notification.type === "payment-method-expired"
  const content = getNotificationContent(notification, t)

  return (
    <Alert
      className={cn(
        "shrink-0 items-center",
        variant === "banner" ? "rounded-none border-x-0 border-t-0 p-4" : "px-3.5 py-3",
      )}
      variant={isError ? "error" : "warning"}
    >
      <AlertTitle>{content.title}</AlertTitle>
      <AlertDescription className="hidden text-xs sm:flex">
        {content.description}
      </AlertDescription>
      <AlertAction className="max-sm:!col-start-3 max-sm:!mt-0 max-sm:!self-center">
        <Button
          className="billing-notification-fix bg-background"
          render={<a href="#settings/billing" />}
          size="sm"
          variant="outline"
        >
          {t("billingNotice.action")}
        </Button>
      </AlertAction>
    </Alert>
  )
}

function getNotificationContent(
  notification: BillingNotification,
  t: ReturnType<typeof useTranslation>["t"],
) {
  switch (notification.type) {
    case "payment-failed":
      return {
        description: t("billingNotice.paymentFailedDescription"),
        title: t("billingNotice.paymentFailedTitle"),
      }
    case "payment-method-expired":
      return {
        description: t("billingNotice.paymentMethodExpiredDescription", {
          card: formatCard(notification.last4),
          date: formatExpirationDate(
            notification.expMonth,
            notification.expYear,
          ),
        }),
        title: t("billingNotice.paymentMethodExpiredTitle"),
      }
    case "payment-method-expiring":
      return {
        description: t("billingNotice.paymentMethodExpiringDescription", {
          card: formatCard(notification.last4),
          date: formatExpirationDate(
            notification.expMonth,
            notification.expYear,
          ),
        }),
        title: t("billingNotice.paymentMethodExpiringTitle"),
      }
    case "payment-method-missing":
      return {
        description: t("billingNotice.paymentMethodMissingDescription"),
        title: t("billingNotice.paymentMethodMissingTitle"),
      }
    case "payment-setup-incomplete":
      return {
        description: t("billingNotice.paymentSetupIncompleteDescription"),
        title: t("billingNotice.paymentSetupIncompleteTitle"),
      }
    case "subscription-inactive":
      return {
        description: t("billingNotice.subscriptionInactiveDescription"),
        title: t("billingNotice.subscriptionInactiveTitle"),
      }
  }
}

function formatCard(last4: string | null) {
  return last4 ? `•••• ${last4}` : ""
}

function formatExpirationDate(expMonth: number, expYear: number) {
  return `${String(expMonth).padStart(2, "0")}/${expYear}`
}
