import { RollingNumber } from "@kitlangton/rolling-number/react"
import { useTranslation } from "react-i18next"

import "@kitlangton/rolling-number/styles.css"

import {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressTrack,
  ProgressValue,
} from "~/components/ui/progress"

export type OnboardingStep = number

const percentageFormat = { style: "percent", maximumFractionDigits: 0 } as const

type OnboardingProgressProps = {
  step: OnboardingStep
  total: number
}

export function OnboardingProgress({ step, total }: OnboardingProgressProps) {
  const { i18n, t } = useTranslation("onboarding")

  if (total <= 1) {
    return null
  }

  const progress = total > 0 ? (step / total) * 100 : 0
  const locale = i18n.resolvedLanguage === "fi" ? "fi-FI" : "en-US"

  return (
    <Progress
      aria-label={t("progress.label")}
      locale={locale}
      value={progress}
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <ProgressLabel>
          {t("progress.step", { current: step, total })}
        </ProgressLabel>
        <ProgressValue>
          {(_, value) =>
            value === null ? null : (
              <RollingNumber
                animated={true}
                duration={500}
                format={percentageFormat}
                locales={locale}
                value={value / 100}
              />
            )
          }
        </ProgressValue>
      </div>
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </Progress>
  )
}
