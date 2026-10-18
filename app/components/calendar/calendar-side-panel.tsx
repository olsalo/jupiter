import { useEffect, useId, useRef, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router"

import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { DialogHeader } from "~/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerPopup, DrawerTitle } from "~/components/ui/drawer"
import { useRouteSheet } from "~/components/use-route-sheet"
import { useMediaQuery } from "~/lib/hooks"

type CalendarSidePanelProps = {
  title: string
  subtitle?: string
  returnTo: string
  children: ReactNode
}

export function CalendarSidePanel({ title, subtitle, returnTo, children }: CalendarSidePanelProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const isOverlay = useMediaQuery("max-1024px")

  useEffect(() => {
    if (isOverlay) return
    const trigger = document.activeElement
    headingRef.current?.focus({ preventScroll: true })
    return () => {
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [isOverlay])

  if (isOverlay) return <CalendarBookingOverlay returnTo={returnTo} subtitle={subtitle} title={title}>{children}</CalendarBookingOverlay>

  return <aside
    aria-labelledby={titleId}
    className="relative flex min-h-0 w-[min(28rem,80%)] min-w-0 shrink-0 flex-col overflow-hidden border-s bg-popover text-popover-foreground max-lg:hidden"
    data-slot="calendar-side-panel"
  >
    <DialogHeader className="shrink-0 pr-14 pb-3">
      <h2 className="font-heading text-xl leading-none font-semibold outline-none" id={titleId} ref={headingRef} tabIndex={-1}>{title}</h2>
      {subtitle ? <p className="min-w-0 truncate text-sm text-muted-foreground" data-slot="calendar-panel-subtitle">{subtitle}</p> : null}
      <Button aria-label={t("routePlaceholders.close")} className="absolute end-2 top-2" render={<Link preventScrollReset={true} replace={true} to={returnTo} />} size="icon" type="button" variant="ghost">
        <Icon aria-hidden={true} name="x" size={18} />
      </Button>
    </DialogHeader>
    {children}
  </aside>
}

function CalendarBookingOverlay({ title, subtitle, returnTo, children }: CalendarSidePanelProps) {
  const isMobile = useMediaQuery("max-768px")
  const navigate = useNavigate()
  const { open, close, finishClosing } = useRouteSheet({
    onCloseComplete: () => { void navigate(returnTo, { replace: true, preventScrollReset: true }) },
  })

  return <Drawer onOpenChange={(nextOpen, details) => {
    if (!isMobile && details.reason === "swipe") {
      details.cancel()
      return
    }
    if (!nextOpen) close()
  }} onOpenChangeComplete={(nextOpen) => { if (!nextOpen) finishClosing() }} open={open} position={isMobile ? "bottom" : "right"}>
    <DrawerPopup className={isMobile ? "h-[calc(100dvh-3rem)]" : "w-[28rem]"} forceBackdrop={true} position={isMobile ? "bottom" : "right"} presentation={isMobile ? "drawer" : "sheet"} showBar={isMobile} showCloseButton={true} variant={isMobile ? "default" : "inset"}>
      <DrawerHeader className="shrink-0 pr-14 pb-3">
        <DrawerTitle>{title}</DrawerTitle>
        {subtitle ? <DrawerDescription className="min-w-0 truncate" data-slot="calendar-panel-subtitle">{subtitle}</DrawerDescription> : null}
      </DrawerHeader>
      <DrawerContent className="flex min-h-0 flex-1 flex-col">{children}</DrawerContent>
    </DrawerPopup>
  </Drawer>
}
