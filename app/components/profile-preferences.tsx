import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useRevalidator, useRouteLoaderData } from "react-router"
import type { loader as rootLoader } from "~/root"
import { ThemePreference } from "~/components/theme-preference"
import FormLabel from "~/components/form-label"
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Tabs, TabsList, TabsTab } from "~/components/ui/tabs"
import { useBackgroundSetting } from "~/lib/use-background-setting"
import { useTRPC } from "~/lib/trpc/client"
import { toast } from "~/lib/toast"

export function ProfilePreferences() {
  const { i18n, t } = useTranslation("common")
  const trpc = useTRPC()
  const revalidator = useRevalidator()
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const preferenceMutation = useMutation(trpc.profile.updatePreferences.mutationOptions())
  const language = useBackgroundSetting<"en" | "fi">(`${rootData?.user?.id}:language`, i18n.resolvedLanguage === "fi" ? "fi" : "en")
  const format = useBackgroundSetting<"eu" | "us">(`${rootData?.user?.id}:format`, rootData?.formatPreference ?? "eu")
  const savePreference = async (input: { locale?: "en" | "fi"; formatPreference?: "eu" | "us" }) => {
    await preferenceMutation.mutateAsync(input)
    await revalidator.revalidate()
  }
  const currentLanguage = language.value
  const formatPreference = format.value
  const languageItems = { en: t("language.english"), fi: t("language.finnish") }
  const onLanguageChange = (locale: "en" | "fi") => { void language.set(locale, () => savePreference({ locale }), () => toast.error(t("settings.profileSaveError"))) }
  const onFormatChange = (formatPreference: "eu" | "us") => { void format.set(formatPreference, () => savePreference({ formatPreference }), () => toast.error(t("settings.profileSaveError"))) }

  return <div className="flex flex-col gap-5">
      <FormLabel
        description={t("settings.languageDescription")}
        label={t("language.label")}
      >
        <Select
          disabled={false}
          items={languageItems}
          onValueChange={(value) => {
            if ((value !== "en" && value !== "fi") || value === currentLanguage) {
              return
            }

            onLanguageChange(value)
          }}
          value={currentLanguage}
        >
          <SelectTrigger aria-label={t("language.label")}>
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value="en">{t("language.english")}</SelectItem>
            <SelectItem value="fi">{t("language.finnish")}</SelectItem>
          </SelectPopup>
        </Select>
      </FormLabel>

      <FormLabel
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1"
        description={t("settings.regionalFormatDescription")}
        descriptionClassName="col-start-1 row-start-2"
        label={t("settings.regionalFormat")}
        labelGroupClassName="col-start-1 row-start-1"
      >
        <Tabs
          aria-label={t("settings.regionalFormat")}
          className="col-start-2 row-span-2 row-start-1"
          onValueChange={(value) => {
            if (
              (value !== "eu" && value !== "us") ||
              value === formatPreference
            ) {
              return
            }

            onFormatChange(value)
          }}
          value={formatPreference}
        >
          <TabsList className="grid grid-cols-2">
            <TabsTab disabled={false} value="eu">
              {t("settings.regionalFormatEu")}
            </TabsTab>
            <TabsTab disabled={false} value="us">
              {t("settings.regionalFormatUs")}
            </TabsTab>
          </TabsList>
        </Tabs>
      </FormLabel>
      <ThemePreference />
  </div>
}
