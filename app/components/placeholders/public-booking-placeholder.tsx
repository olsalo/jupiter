import { useTranslation } from "react-i18next"
import { Link } from "react-router"

import { PlaceholderBody, type PlaceholderTitle } from "./route-placeholder"
import { PageHeader } from "~/components/page-header"
import { Button } from "~/components/ui/button"

export function PublicBookingPlaceholder({ titleKey, management = false, back = false }: {
  titleKey: PlaceholderTitle
  management?: boolean
  back?: boolean
}) {
  const { t } = useTranslation()
  const title = t(`routeTitles.${titleKey}`)
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-6 py-10 sm:py-16">
      <title>{title}</title>
      <PageHeader title={title} />
      <PlaceholderBody />
      <div className="flex flex-wrap gap-2">
        {management ? <>
          <Button render={<Link to="reschedule" />} type="button" variant="outline">{t("routeActions.rescheduleBooking")}</Button>
          <Button render={<Link to="cancel" />} type="button" variant="outline">{t("routeActions.cancelBooking")}</Button>
        </> : null}
        {back ? <Button render={<Link to=".." />} type="button" variant="outline">{t("routePlaceholders.back")}</Button> : null}
      </div>
    </main>
  )
}
