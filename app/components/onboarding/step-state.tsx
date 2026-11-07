import { useTranslation } from "react-i18next"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"

export function OnboardingStepError({ isFetching, onRetry }: {
  isFetching: boolean
  onRetry: () => void
}) {
  const { t } = useTranslation("onboarding")

  return (
    <Alert variant="error">
      <AlertTitle>{t("errors.load")}</AlertTitle>
      <AlertDescription>{t("errors.retryDescription")}</AlertDescription>
      <AlertAction>
        <Button disabled={isFetching} loading={isFetching} onClick={onRetry} size="sm" type="button" variant="outline">
          {t("actions.retry")}
        </Button>
      </AlertAction>
    </Alert>
  )
}
