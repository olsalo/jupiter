import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { BusinessOpeningExceptions } from "~/components/settings/business/business-opening-exceptions"
import { SettingsLoading } from "~/components/settings/settings-loading"
import { Alert, AlertAction, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { localizationDefaults } from "~/lib/localization/defaults"
import { getPrimaryLocation } from "~/lib/locations/primary-location"
import { useTRPC } from "~/lib/trpc/client"

export function BusinessExceptionsSettings() {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const organization = useQuery(trpc.organizations.getCurrent.queryOptions())
  const locations = useQuery(trpc.location.list.queryOptions())
  const isFetching = organization.isFetching || locations.isFetching

  if (organization.isError || locations.isError) return <Alert variant="error">
    <AlertDescription>{t("settings.loadError")}</AlertDescription>
    <AlertAction>
      <Button disabled={isFetching} loading={isFetching} onClick={() => void Promise.all([organization.refetch(), locations.refetch()])} size="sm" type="button" variant="outline">{t("businessSchedule.retry")}</Button>
    </AlertAction>
  </Alert>
  if (!organization.data || !locations.data) return <SettingsLoading />

  const location = getPrimaryLocation(locations.data, organization.data.settings?.defaultLocationId)
  const timezone = location?.timezone ?? organization.data.settings?.timezone ?? localizationDefaults.timezone
  return <BusinessOpeningExceptions disabled={false} timezone={timezone} />
}
