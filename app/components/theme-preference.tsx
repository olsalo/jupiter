import { useMutation } from "@tanstack/react-query"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useRevalidator, useRouteLoaderData } from "react-router"
import type { loader as rootLoader } from "~/root"
import FormLabel from "~/components/form-label"
import { Tabs, TabsList, TabsTab } from "~/components/ui/tabs"
import { syncThemeColor } from "~/lib/theme"
import { useBackgroundSetting } from "~/lib/use-background-setting"
import { useTRPC } from "~/lib/trpc/client"
import { toast } from "~/lib/toast"

export function ThemePreference() {
  const { t } = useTranslation("common")
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const trpc = useTRPC()
  const revalidator = useRevalidator()
  const mutation = useMutation(trpc.profile.updatePreferences.mutationOptions())
  const theme = useBackgroundSetting<"light" | "dark">(`${rootData?.user?.id}:theme`, rootData?.theme ?? "light")
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme.value === "dark")
    syncThemeColor()
  }, [theme.value, rootData?.theme])

  return (
    <div className="flex flex-col gap-5">
      <FormLabel
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1"
        description={t("settings.themeDescription")}
        descriptionClassName="col-start-1 row-start-2"
        label={t("settings.theme")}
        labelGroupClassName="col-start-1 row-start-1"
      >
        <Tabs
          aria-label={t("settings.theme")}
          className="col-start-2 row-span-2 row-start-1"
          onValueChange={(value) => {
            if ((value !== "light" && value !== "dark") || value === theme.value) {
              return
            }

            void theme.set(value, async () => {
              await mutation.mutateAsync({ theme: value })
              await revalidator.revalidate()
            }, () => toast.error(t("settings.profileSaveError")))
          }}
          value={theme.value}
        >
          <TabsList className="grid grid-cols-2">
            <TabsTab disabled={false} value="light">
              {t("settings.themeLight")}
            </TabsTab>
            <TabsTab disabled={false} value="dark">
              {t("settings.themeDark")}
            </TabsTab>
          </TabsList>
        </Tabs>
      </FormLabel>
    </div>
  )
}

