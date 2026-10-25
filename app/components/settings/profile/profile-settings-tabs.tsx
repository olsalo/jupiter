import { useTranslation } from "react-i18next"

import { TabsList, TabsTab } from "~/components/ui/tabs"

const profileTabs = [
  { value: "general", label: "ownSettings.general" },
  { value: "appointments", label: "people.appointments" },
  { value: "availability", label: "people.availability" },
  { value: "breaks", label: "people.breaks" },
  { value: "time-off", label: "timeOff.tab" },
]

export function ProfileSettingsTabs({ disabled, bookable }: { disabled: boolean; bookable: boolean }) {
  const { t } = useTranslation("team")
  return (
    <div className="min-w-0 overflow-x-auto overflow-y-hidden pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <TabsList aria-label={t("ownSettings.tabs")} className="flex w-max min-w-full justify-start gap-0 bg-transparent p-0" variant="underline">
        {profileTabs.filter((tab) => bookable || tab.value === "general" || tab.value === "appointments").map((tab) => <TabsTab aria-label={t(tab.label)} className="h-10 min-w-0 grow-0 shrink-0 basis-auto rounded-none px-3 text-xs leading-4 whitespace-nowrap sm:text-sm" disabled={disabled} key={tab.value} value={tab.value}>
          <span className="min-w-0 whitespace-nowrap text-center">{t(tab.label)}</span>
        </TabsTab>)}
      </TabsList>
    </div>
  )
}
