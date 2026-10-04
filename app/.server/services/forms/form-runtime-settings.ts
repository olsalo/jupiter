import type { Prisma } from "../../../../generated/prisma/client"
import type { FormSnapshot } from "~/lib/forms/form-types"

export const formRuntimeSettingsSelect = {
  submitButtonText: true,
  successMessage: true,
  redirectUrl: true,
  emailCollection: true,
  limitOneResponsePerEmail: true,
  theme: true,
  accentColor: true,
} as const satisfies Prisma.FormSelect

type RuntimeSettings = Prisma.FormGetPayload<{ select: typeof formRuntimeSettingsSelect }>

export function applyLiveFormSettings(snapshot: FormSnapshot, settings: RuntimeSettings): FormSnapshot {
  return {
    ...snapshot,
    settings: {
      submitButtonText: settings.submitButtonText,
      successMessage: settings.successMessage,
      redirectUrl: settings.redirectUrl,
      emailCollection: settings.emailCollection,
      limitOneResponsePerEmail: settings.limitOneResponsePerEmail,
    },
    appearance: { ...snapshot.appearance, theme: settings.theme, accentColor: settings.accentColor },
  }
}
