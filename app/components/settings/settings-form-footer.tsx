import { useTranslation } from "react-i18next"

import { Button } from "~/components/ui/button"
import { DialogFooter } from "~/components/ui/dialog"
import { DrawerFooter } from "~/components/ui/drawer"
import type { SettingsPersonFormState } from "~/components/team/team-person-form"

export function SettingsFormFooter({ formId, isMobile, onCancel, state }: {
  formId: string
  isMobile: boolean
  onCancel: () => void
  state: SettingsPersonFormState
}) {
  const { t } = useTranslation("common")
  const Footer = isMobile ? DrawerFooter : DialogFooter
  if (!state.isDirty || state.isLoading) return null

  return (
    <Footer className={isMobile ? "shrink-0" : "shrink-0 rounded-b-2xl"}>
      <Button disabled={state.isSubmitting} onClick={onCancel} type="button" variant="ghost">{t("settings.cancel")}</Button>
      <Button disabled={state.isSubmitting} form={formId} loading={state.isSubmitting} type="submit">
        {t("settings.save")}
      </Button>
    </Footer>
  )
}
