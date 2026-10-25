import { useTranslation } from "react-i18next"
import { Link } from "react-router"

import { PlaceholderBody, type PlaceholderTitle } from "./route-placeholder"
import { PageHeading } from "~/components/page-heading"
import { Button } from "~/components/ui/button"

export function PublicBookingPlaceholder({ titleKey, management = false, back = false }: {
  titleKey: PlaceholderTitle
  management?: boolean
  back?: boolean
}) {
  const { t } = useTranslation()
  const title = t(`routeTitles.${titleKey}`)
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 pl-[calc(1.5rem+env(safe-area-inset-left,0px))] pr-[calc(1.5rem+env(safe-area-inset-right,0px))] py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(2.5rem+env(safe-area-inset-top,0px))] sm:py-16 sm:pb-[calc(4rem+env(safe-area-inset-bottom,0px))] sm:pt-[calc(4rem+env(safe-area-inset-top,0px))]">
      <title>{title}</title>
      <PageHeading title={title} />
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
