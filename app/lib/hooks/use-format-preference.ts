import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useRevalidator, useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import type { FormatPreference } from "~/lib/localization/format-preference"
import { toast } from "~/lib/toast"
import { useBackgroundSetting } from "~/lib/hooks/use-background-setting"
import { useTRPC } from "~/lib/trpc/client"

export function useFormatPreference() {
  const { t } = useTranslation()
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const trpc = useTRPC()
  const revalidator = useRevalidator()
  const mutation = useMutation(
    trpc.profile.updateFormatPreference.mutationOptions(),
  )
  const preference = useBackgroundSetting<FormatPreference>(
    `${root?.user?.id}:format`,
    root?.formatPreference ?? "eu",
  )

  return {
    value: preference.value,
    set: (value: FormatPreference) => {
      if (value === preference.value) return
      void preference.set(
        value,
        async () => {
          await mutation.mutateAsync({ formatPreference: value })
          await revalidator.revalidate()
        },
        () => toast.error(t("dateTimeFormat.saveError")),
      )
    },
  }
}
