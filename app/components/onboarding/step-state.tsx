import { useTranslation } from "react-i18next"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Skeleton } from "~/components/ui/skeleton"

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
        <Button disabled={isFetching} onClick={onRetry} size="sm" type="button" variant="outline">
          {t("actions.retry")}
        </Button>
      </AlertAction>
    </Alert>
  )
}

export function OnboardingStepLoading({ step }: { step: "business" | "subscription" }) {
  const { t } = useTranslation("onboarding")

  return (
    <div aria-busy={true} aria-label={t("loading")} className="flex flex-col gap-5" role="status">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-5 w-full" />
      </div>
      {step === "business" ? (
        <div className="flex flex-col gap-3.5">
          {Array.from({ length: 5 }, (_, index) => (
            <div className="flex flex-col gap-2" key={index}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </>
      )}
      <Skeleton className="h-9 w-full" />
    </div>
  )
}
