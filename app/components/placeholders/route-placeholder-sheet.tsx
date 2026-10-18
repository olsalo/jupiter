import { useId, useRef, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation, useMatches, useNavigate } from "react-router"

import { PlaceholderBody, type PlaceholderTitle } from "./route-placeholder"
import { Button } from "~/components/ui/button"
import {
  ResponsiveSheet, ResponsiveSheetPopup, ResponsiveSheetHeader,
  ResponsiveSheetTitle, ResponsiveSheetDescription, ResponsiveSheetPanel, ResponsiveSheetFooter,
} from "~/components/responsive-sheet"
import { useRouteSheet } from "~/components/use-route-sheet"

export function RoutePlaceholderSheet({ titleKey, returnTo, children }: {
  titleKey: PlaceholderTitle
  returnTo: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const matches = useMatches()
  const titleId = useId()
  const descriptionId = useId()
  const destination = useRef(typeof location.state?.returnTo === "string" && location.state.returnTo.startsWith(`${returnTo}?`) ? location.state.returnTo : returnTo)
  const detailTitle = matches.flatMap((match) => {
    const handle = match.handle as { placeholderTitle?: PlaceholderTitle } | undefined
    return handle?.placeholderTitle ? [handle.placeholderTitle] : []
  }).at(-1) ?? titleKey
  const title = t(`routeTitles.${detailTitle}`)

  const { open, close: startClosing, finishClosing } = useRouteSheet({
    onCloseComplete: () => { void navigate(destination.current, { replace: true }) },
  })

  return (
    <ResponsiveSheet
      deferClose={false}
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) startClosing() }}
      onOpenChangeComplete={(nextOpen) => { if (!nextOpen) finishClosing() }}
    >
      <title>{title}</title>
      <ResponsiveSheetPopup className="sm:max-w-lg" closeLabel={t("routePlaceholders.close")} descriptionId={descriptionId} open={open} side="right" titleId={titleId} variant="inset">
        <ResponsiveSheetHeader>
          <ResponsiveSheetTitle id={titleId}>{title}</ResponsiveSheetTitle>
          <ResponsiveSheetDescription id={descriptionId}>{t("routePlaceholders.description")}</ResponsiveSheetDescription>
        </ResponsiveSheetHeader>
        <ResponsiveSheetPanel>{children}</ResponsiveSheetPanel>
        <ResponsiveSheetFooter>
          <Button onClick={startClosing} type="button" variant="ghost">{t("routePlaceholders.close")}</Button>
        </ResponsiveSheetFooter>
      </ResponsiveSheetPopup>
    </ResponsiveSheet>
  )
}

export function PlaceholderSheetContent({ edit = false, back = false, reschedule = false, intake = false, availability = false }: {
  edit?: boolean
  back?: boolean
  reschedule?: boolean
  intake?: boolean
  availability?: boolean
}) {
  const { t } = useTranslation()
  const location = useLocation()
  return (
    <div className="flex flex-col gap-4">
      <PlaceholderBody />
      <div className="flex flex-wrap gap-2">
        {[
          ...(back ? [{ to: "..", label: t("routePlaceholders.back") }] : []),
          ...(edit ? [{ to: "edit", label: t("routePlaceholders.edit") }] : []),
          ...(reschedule ? [{ to: "reschedule", label: t("routeTitles.rescheduleAppointment") }] : []),
          ...(intake ? [{ to: "intake", label: t("routeTitles.serviceIntake") }] : []),
          ...(availability ? [{ to: "availability", label: t("routeTitles.staffAvailability") }] : []),
        ].map(({ to, label }) => (
          <Button key={to} render={<Link to={`${to}${location.search}`} replace={true} state={location.state} />} type="button" variant="outline">{label}</Button>
        ))}
      </div>
    </div>
  )
}
