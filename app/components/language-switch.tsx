import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useRevalidator, useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import { Tabs, TabsList, TabsTab } from "~/components/ui/tabs"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { useBackgroundSetting } from "~/lib/use-background-setting"

export function LanguageSwitch() {
  const { t } = useTranslation()
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const revalidator = useRevalidator()
  const trpc = useTRPC()
  const mutation = useMutation(trpc.profile.updateLocale.mutationOptions())
  const language = useBackgroundSetting<"en" | "fi">(
    `${rootData?.user?.id}:language`,
    rootData?.locale === "fi" ? "fi" : "en",
  )

  return (
    <Tabs
      onValueChange={(value) => {
        if ((value !== "en" && value !== "fi") || value === language.value) {
          return
        }

        void language.set(value, async () => {
          await mutation.mutateAsync({ locale: value })
          await revalidator.revalidate()
        }, () => toast.error(t("language.saveError")))
      }}
      value={language.value}
    >
      <TabsList aria-label={t("language.label")} className="grid grid-cols-2">
        <TabsTab
          aria-label="English"
          className="h-7 px-2 text-xs sm:h-7 sm:text-xs"
          disabled={false}
          title="English"
          value="en"
        >
          EN
        </TabsTab>
        <TabsTab
          aria-label="Suomi"
          className="h-7 px-2 text-xs sm:h-7 sm:text-xs"
          disabled={false}
          title="Suomi"
          value="fi"
        >
          FI
        </TabsTab>
      </TabsList>
    </Tabs>
  )
}
