import { useTranslation } from "react-i18next"

import Icon, { type AppIconName } from "~/components/ui/icons/icons"
import { TabsList, TabsTab } from "~/components/ui/tabs"
import { cn } from "~/components/ui/utils/utils"

export function getTeamPersonSections(mode: "view" | "edit") {
  const sections: { value: string; labelKey: string; icon: AppIconName }[] = [
    { value: mode === "edit" ? "profile" : "about", labelKey: "people.profile", icon: "user" },
    ...(mode === "edit" ? [{ value: "access", labelKey: "people.appAccess", icon: "lock" as const }] : []),
    { value: "services", labelKey: "people.services", icon: "forms" },
    { value: "availability", labelKey: "people.availability", icon: "clock" },
    { value: "breaks", labelKey: "people.breaks", icon: "coffee" },
    { value: "extra-hours", labelKey: "common:calendarExtraHours.tab", icon: "calendarEvent" },
    { value: "time-off", labelKey: "timeOff.tab", icon: "calendarOff" },
  ]
  return sections
}

export function TeamPersonTabs({ mode, disabled = false }: { mode: "view" | "edit"; disabled?: boolean }) {
  const { t } = useTranslation("team")

  return (
    <TabsList aria-label={t(mode === "edit" ? "people.edit" : "people.details")} className={cn("grid w-full min-w-0", mode === "edit" ? "grid-cols-7" : "grid-cols-6")} variant="underline">
      {getTeamPersonSections(mode).map((section) => <TabsTab aria-label={t(section.labelKey)} className="min-w-0 px-1 text-xs sm:text-sm" disabled={disabled} key={section.value} title={t(section.labelKey)} value={section.value}>
        <Icon aria-hidden={true} className="hidden size-4 shrink-0 @max-[32rem]/profile-header:block" name={section.icon} size={16} />
        <span className="min-w-0 truncate @max-[32rem]/profile-header:sr-only">{t(section.labelKey)}</span>
      </TabsTab>)}
    </TabsList>
  )
}
