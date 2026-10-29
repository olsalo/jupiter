import { useId, useMemo, type ReactNode } from "react"
import { useNavigate } from "react-router"

import { ResponsiveSheet, ResponsiveSheetDescription, ResponsiveSheetHeader, ResponsiveSheetPopup, ResponsiveSheetTitle } from "~/components/overlays/responsive-sheet"
import { useRouteSheet } from "~/components/overlays/use-route-sheet"

export function RouteFormSheet({ title, description, closeLabel, returnTo, pending, children, onReopen, drawerClassName, headerClassName }: {
  title: string
  description: string
  closeLabel: string
  returnTo: string
  pending: boolean
  children: (close: () => void) => ReactNode
  onReopen?: () => void
  drawerClassName?: string
  headerClassName?: string
}) {
  const navigate = useNavigate()
  const titleId = useId()
  const descriptionId = useId()
  const { open, version, close, finishClosing } = useRouteSheet({
    onCloseComplete: () => { void navigate(returnTo, { replace: true }) },
    onReopen,
  })
  // Animation state belongs to this shell, so closing does not rebuild the form
  const content = useMemo(() => children(close), [children, close, version])

  return <ResponsiveSheet deferClose={false} open={open} onOpenChange={(next) => { if (!next && !pending) close() }} onOpenChangeComplete={(next) => { if (!next) finishClosing() }}>
    <title>{title}</title>
    <ResponsiveSheetPopup className="sm:max-w-xl" closeLabel={closeLabel} descriptionId={descriptionId} drawerClassName={drawerClassName} open={open} side="right" titleId={titleId} variant="inset">
      <ResponsiveSheetHeader className={headerClassName}>
        <ResponsiveSheetTitle id={titleId}>{title}</ResponsiveSheetTitle>
        <ResponsiveSheetDescription id={descriptionId}>{description}</ResponsiveSheetDescription>
      </ResponsiveSheetHeader>
      <div className="contents" key={version}>{content}</div>
    </ResponsiveSheetPopup>
  </ResponsiveSheet>
}
