import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import type { Route } from "./+types/form-settings"
import { FormSettingsEditor, FormSettingsSkeleton } from "~/components/forms/form-settings-editor"
import { PageLayout } from "~/components/page-layout"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"
import { useTRPC } from "~/lib/trpc/client"

export function clientLoader() {
  return null
}

export const shouldRevalidate = shouldRevalidateAppRoute

export default function FormSettings({ params }: Route.ComponentProps) {
  const { t } = useTranslation("forms")
  const trpc = useTRPC()
  const settings = useQuery(trpc.forms.settings.get.queryOptions({ id: params.id }))
  const loading = settings.isLoading

  return (
    <PageLayout
      description={t("settings.description")}
      title={t("workspace.settings")}
    >
      {loading ? <FormSettingsSkeleton /> : settings.data ? (
        <FormSettingsEditor formId={params.id} key={params.id} settings={settings.data} />
      ) : settings.isError ? (
        <Alert variant="error">
          <AlertTitle>{t("settings.loadError")}</AlertTitle>
          <AlertDescription>{t("errors.retry")}</AlertDescription>
          <AlertAction>
            <Button disabled={settings.isFetching} onClick={() => { void settings.refetch() }} size="sm" type="button" variant="outline">
              {t("retry")}
            </Button>
          </AlertAction>
        </Alert>
      ) : (
        <FormSettingsSkeleton />
      )}
    </PageLayout>
  )
}
