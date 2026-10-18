import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"

export function NotificationsSettingsContent() {
  const { t } = useTranslation("common")

  return (
    <Empty className="min-h-64 flex-1 border-0 bg-transparent">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Icon aria-hidden={true} name="bell" /></EmptyMedia>
        <EmptyTitle>{t("settings.previewTitle")}</EmptyTitle>
        <EmptyDescription>{t("settings.notificationsPlaceholder")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
