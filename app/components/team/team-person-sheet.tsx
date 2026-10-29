import { useCallback, useId, useMemo, useRef, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router"
import { ResponsiveSheet, ResponsiveSheetPopup, ResponsiveSheetHeader, ResponsiveSheetTitle, ResponsiveSheetDescription } from "~/components/overlays/responsive-sheet"
import { useRouteSheet } from "~/components/overlays/use-route-sheet"

export function TeamPersonSheet({ title, description, children, pending = false, profile = false, basePath = "/team", defaultReturnTo = basePath, onCloseStart }: {
  title: string
  description: string
  children: (close: (destination?: string) => void) => ReactNode
  pending?: boolean
  profile?: boolean
  basePath?: string
  defaultReturnTo?: string
  onCloseStart?: () => void
}) {
  const { t } = useTranslation("team")
  const location = useLocation()
  const navigate = useNavigate()
  const titleId = useId()
  const descriptionId = useId()
  const returnTo = useRef(typeof location.state?.returnTo === "string" && (location.state.returnTo === basePath || location.state.returnTo.startsWith(`${basePath}?`) || location.state.returnTo.startsWith(`${basePath}/`)) ? location.state.returnTo : defaultReturnTo)
  const { open, version, close: startClosing, finishClosing } = useRouteSheet({
    onCloseComplete: () => { void navigate(returnTo.current, { replace: true }) },
    onCloseStart,
  })
  const close = useCallback((destination?: string) => {
    if (destination === "/team?tab=invites") returnTo.current = `${basePath}?tab=invites`
    startClosing()
  }, [basePath, startClosing])
  const content = useMemo(() => children(close), [children, close, version])
  return (
    <ResponsiveSheet deferClose={false} open={open} onOpenChange={(next) => { if (!next && !pending) close() }} onOpenChangeComplete={(next) => { if (!next) finishClosing() }}>
      <ResponsiveSheetPopup closeLabel={t("people.close")} className="sm:max-w-xl [&_[data-slot=scroll-area-content]]:flex [&_[data-slot=scroll-area-content]]:min-h-full [&_[data-slot=scroll-area-content]]:flex-col" open={open} side="right" variant="inset" titleId={titleId} descriptionId={descriptionId}>
        <ResponsiveSheetHeader className={profile ? "sr-only p-0!" : undefined}>
          <ResponsiveSheetTitle id={titleId}>{title}</ResponsiveSheetTitle>
          <ResponsiveSheetDescription id={descriptionId}>{description}</ResponsiveSheetDescription>
        </ResponsiveSheetHeader>
        <div className="flex min-h-0 flex-1 flex-col" data-slot="team-person-sheet-content" key={version}>{content}</div>
      </ResponsiveSheetPopup>
    </ResponsiveSheet>
  )
}
