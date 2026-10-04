import { useTranslation } from "react-i18next"

import {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressTrack,
  ProgressValue,
} from "~/components/ui/progress"

export type OnboardingStep = number

type OnboardingProgressProps = {
  step: OnboardingStep
  total: number
}

export function OnboardingProgress({ step, total }: OnboardingProgressProps) {
  const { t } = useTranslation("onboarding")

  if (total <= 1) {
    return null
  }

  const progress = total > 0 ? (step / total) * 100 : 0

  return (
    <Progress
      aria-label={t("progress.label")}
      value={progress}
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <ProgressLabel>
          {t("progress.step", { current: step, total })}
        </ProgressLabel>
        <ProgressValue />
      </div>
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </Progress>
  )
}
