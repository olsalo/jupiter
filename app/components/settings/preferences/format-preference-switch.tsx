import { useTranslation } from "react-i18next"

import { Tabs, TabsList, TabsTab } from "~/components/ui/tabs"
import {
  isFormatPreference,
  type FormatPreference,
} from "~/lib/localization/format-preference"

export function FormatPreferenceSwitch({
  value,
  onValueChange,
}: {
  value: FormatPreference
  onValueChange: (value: FormatPreference) => void
}) {
  const { t } = useTranslation()
  return (
    <Tabs
      onValueChange={(next) => {
        if (isFormatPreference(next)) onValueChange(next)
      }}
      value={value}
    >
      <TabsList
        aria-label={t("dateTimeFormat.label")}
        className="grid grid-cols-2"
      >
        <TabsTab
          aria-label={t("dateTimeFormat.eu")}
          className="h-7 px-2 text-xs sm:h-7 sm:text-xs"
          disabled={false}
          title={t("dateTimeFormat.euHint")}
          value="eu"
        >
          EU
        </TabsTab>
        <TabsTab
          aria-label={t("dateTimeFormat.us")}
          className="h-7 px-2 text-xs sm:h-7 sm:text-xs"
          disabled={false}
          title={t("dateTimeFormat.usHint")}
          value="us"
        >
          US
        </TabsTab>
      </TabsList>
    </Tabs>
  )
}
