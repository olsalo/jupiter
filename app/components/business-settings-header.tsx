import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"

export function BusinessSettingsHeader({ name }: { name?: string }) {
  const { t } = useTranslation("common")
  const initials = name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()

  return (
    <header className="border-b bg-background px-5 pt-5 max-sm:px-4 max-sm:pt-4">
      <div className="flex items-center gap-3 pb-4 pe-8">
        <Avatar className="size-12 rounded-lg text-base">
          <AvatarFallback className="rounded-lg">{initials || <Icon aria-hidden={true} name="buildingStore" size={20} />}</AvatarFallback>
        </Avatar>
        <div className="grid min-w-0 gap-2">
          <h2 className="break-words font-heading text-xl font-semibold leading-none">{name ?? t("settings.business")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.generalDescription")}</p>
        </div>
      </div>
    </header>
  )
}
