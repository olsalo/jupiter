import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useRevalidator, useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import Icon from "~/components/icons"
import { Tabs, TabsList, TabsTab } from "~/components/ui/tabs"
import { isTheme, type Theme } from "~/lib/theme"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { useBackgroundSetting } from "~/lib/use-background-setting"

export function ThemeSwitch() {
  const { t } = useTranslation()
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const revalidator = useRevalidator()
  const trpc = useTRPC()
  const mutation = useMutation(trpc.profile.updateTheme.mutationOptions())
  const theme = useBackgroundSetting<Theme>(
    `${rootData?.user?.id}:theme`,
    rootData?.theme ?? "light",
  )

  return (
    <Tabs
      onValueChange={(value) => {
        if (!isTheme(value) || value === theme.value) {
          return
        }

        void theme.set(value, async () => {
          await mutation.mutateAsync({ theme: value })
          await revalidator.revalidate()
        }, () => toast.error(t("settings.themeSaveError")))
      }}
      value={theme.value}
    >
      <TabsList aria-label={t("settings.theme")} className="grid grid-cols-2">
        <TabsTab
          aria-label={t("settings.themeLight")}
          className="size-7 p-0 sm:h-7"
          disabled={false}
          title={t("settings.themeLight")}
          value="light"
        >
          <Icon aria-hidden={true} className="size-4" name="sun" />
        </TabsTab>
        <TabsTab
          aria-label={t("settings.themeDark")}
          className="size-7 p-0 sm:h-7"
          disabled={false}
          title={t("settings.themeDark")}
          value="dark"
        >
          <Icon aria-hidden={true} className="size-4" name="moon" />
        </TabsTab>
      </TabsList>
    </Tabs>
  )
}
