import { useTranslation } from "react-i18next"

import { TabsList, TabsTab } from "~/components/ui/tabs"
import Icon from "~/components/icons"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"

export function BusinessSettingsHeader({ name, disabled = false }: { name?: string; disabled?: boolean }) {
  const { t } = useTranslation("common")
  const initial = name?.match(/[\p{L}\p{N}]/u)?.[0].toUpperCase()

  return (
    <header className="border-b bg-background px-5 pt-5 max-sm:px-4 max-sm:pt-4">
      <div className="flex items-center gap-3 pb-4 pe-8">
        <Avatar className="size-12 rounded-lg text-base">
          <AvatarFallback className="rounded-lg">{initial || <Icon aria-hidden={true} name="buildingStore" size={20} />}</AvatarFallback>
        </Avatar>
        <div className="grid min-w-0 gap-2">
          <h2 className="break-words font-heading text-xl font-semibold leading-none">{name ?? t("settings.business")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.generalDescription")}</p>
        </div>
      </div>
      <div className="min-w-0 overflow-x-auto overflow-y-hidden pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabsList aria-label={t("settings.business")} className="flex w-max min-w-full justify-start gap-0 bg-transparent p-0" variant="underline">
          {(["general", "location", "opening-hours", "holidays"] as const).map((tab) => <TabsTab className="h-10 min-w-0 grow-0 shrink-0 basis-auto rounded-none px-3 text-xs leading-4 whitespace-nowrap sm:text-sm" disabled={disabled} key={tab} value={tab}>{t(`businessSchedule.tabs.${tab}`)}</TabsTab>)}
        </TabsList>
      </div>
    </header>
  )
}
