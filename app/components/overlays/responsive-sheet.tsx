import { createContext, useContext, useEffect, useRef, useState, type ComponentProps } from "react"

import Icon from "~/components/icons"
import type { ServerRenderedSheetPopup } from "~/components/overlays/server-rendered-sheet-popup"
import { getSheetPopupClassName, getSheetViewportClassName } from "~/components/sheet-popup-styles"
import { Button } from "~/components/ui/button"
import {
  Drawer, DrawerBackdrop, DrawerBar, DrawerClose, DrawerDescription, DrawerFooter,
  DrawerHeader, DrawerPanel, DrawerPopup, DrawerTitle,
} from "~/components/ui/drawer"
import type { Sheet, SheetDescription, SheetFooter, SheetHeader, SheetPanel, SheetTitle } from "~/components/ui/sheet"
import { useMediaQuery } from "~/lib/hooks"
import { useHydrated } from "~/lib/use-hydrated"
import { cn } from "~/lib/utils"

const ResponsiveSheetContext = createContext({ isMobile: false, initiallyServerRendered: false, insideOverlay: false })

export function ResponsiveSheet({ deferClose = true, onOpenChange, open, ...props }: Omit<ComponentProps<typeof Sheet>, "onOpenChange" | "handle"> & {
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useMediaQuery("max-640px")
  const hydrated = useHydrated()
  const initiallyServerRendered = useRef(!hydrated && Boolean(open))
  const [entryReady, setEntryReady] = useState(!hydrated)
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  useEffect(() => { setEntryReady(true) }, [])
  useEffect(() => {
    if (open === false) initiallyServerRendered.current = false
  }, [open])

  useEffect(() => {
    if (open === false) setClosing(false)
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [open])

  function changeOpen(next: boolean) {
    if (!next && deferClose && !isMobile && open === true) {
      if (closeTimer.current) return
      setClosing(true)
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null
        onOpenChangeRef.current?.(false)
      }, 220)
      return
    }
    if (next) {
      if (closeTimer.current) clearTimeout(closeTimer.current)
      closeTimer.current = null
      setClosing(false)
    }
    onOpenChangeRef.current?.(next)
  }

  // One overlay root owns focus, context and children at every viewport size
  return (
    <ResponsiveSheetContext.Provider value={{ isMobile, initiallyServerRendered: initiallyServerRendered.current, insideOverlay: true }}>
      <Drawer {...props} onOpenChange={(next, details) => {
        if (!isMobile && details.reason === "swipe") {
          details.cancel()
          return
        }
        changeOpen(next)
      }} open={open === undefined ? undefined : open && entryReady && !closing} swipeDirection={isMobile ? "down" : "right"} />
    </ResponsiveSheetContext.Provider>
  )
}

export function ResponsiveSheetPopup({
  children,
  className,
  closeLabel,
  descriptionId,
  drawerClassName,
  open,
  titleId,
  side = "right",
  variant = "default",
  viewportClassName,
  style,
}: ComponentProps<typeof ServerRenderedSheetPopup> & { drawerClassName?: string }) {
  const { isMobile, initiallyServerRendered } = useContext(ResponsiveSheetContext)
  const hydrated = useHydrated()
  const content = <>
    {children}
    <DrawerClose aria-label={closeLabel} className="absolute inset-e-2 top-2 z-1" render={<Button size="icon" type="button" variant="ghost" />}>
      <Icon aria-hidden={true} name="x" />
    </DrawerClose>
  </>

  if (!hydrated) {
    if (!open) return null
    // Server markup presents the same content as a bottom drawer on small screens
    return <>
      <DrawerBackdrop data-slot="sheet-backdrop" forceRender={true} hidden={false} presentation="sheet" />
      <div className={getSheetViewportClassName({ className: cn("max-sm:grid max-sm:grid-cols-1 max-sm:grid-rows-[1fr_auto] max-sm:justify-normal max-sm:pt-12", viewportClassName), side, variant })} data-open="" data-slot="sheet-viewport" role="presentation">
        <div aria-describedby={descriptionId} aria-labelledby={titleId} aria-modal={true} className={getSheetPopupClassName({ className: cn("max-sm:h-(--app-drawer-height) max-sm:not-has-data-[slot=sheet-footer]:pb-[env(safe-area-inset-bottom,0px)] max-sm:col-start-1 max-sm:row-start-2 max-sm:w-full max-sm:max-w-none max-sm:rounded-t-2xl max-sm:border-s-0 max-sm:border-t max-sm:pt-2", className, drawerClassName), side, variant })} data-open="" data-slot="sheet-popup" role="dialog" style={style} tabIndex={-1}>
          {content}
          <DrawerBar className="sm:hidden" position="bottom" />
        </div>
      </div>
    </>
  }

  // Change only presentation props, keeping the portal, popup and form mounted
  return (
    <DrawerPopup
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      backdropClassName={initiallyServerRendered ? "data-starting-style:opacity-100" : undefined}
      className={isMobile
        ? cn("h-(--app-drawer-height)", drawerClassName, initiallyServerRendered && "data-starting-style:transform-none")
        : cn(className, initiallyServerRendered && "data-starting-style:opacity-100 data-starting-style:translate-x-0 data-starting-style:translate-y-0")}
      data-slot={isMobile ? "drawer-popup" : "sheet-popup"}
      forceBackdrop={true}
      finalFocus={isMobile ? undefined : false}
      initialFocus={isMobile ? undefined : false}
      position={isMobile ? "bottom" : side}
      presentation={isMobile ? "drawer" : "sheet"}
      showBar={isMobile}
      showCloseButton={false}
      style={style}
      variant={isMobile ? "default" : variant}
      viewportClassName={isMobile ? undefined : viewportClassName}
    >
      {content}
    </DrawerPopup>
  )
}

export function ResponsiveSheetHeader({ className, ...props }: ComponentProps<typeof SheetHeader>) {
  const { isMobile } = useContext(ResponsiveSheetContext)
  return <DrawerHeader {...props} className={cn("in-[[data-slot=sheet-popup]:has([data-slot=sheet-panel])]:pb-3", className)} data-slot={isMobile ? "drawer-header" : "sheet-header"} />
}

export function ResponsiveSheetTitle(props: ComponentProps<typeof SheetTitle>) {
  const { isMobile } = useContext(ResponsiveSheetContext)
  return <DrawerTitle {...props} data-slot={isMobile ? "drawer-title" : "sheet-title"} />
}

export function ResponsiveSheetDescription(props: ComponentProps<typeof SheetDescription>) {
  const { isMobile } = useContext(ResponsiveSheetContext)
  return <DrawerDescription {...props} data-slot={isMobile ? "drawer-description" : "sheet-description"} />
}

export function ResponsiveSheetPanel({ className, ...props }: ComponentProps<typeof SheetPanel> & { scrollable?: boolean }) {
  const { isMobile, insideOverlay } = useContext(ResponsiveSheetContext)
  return <DrawerPanel {...props} allowSelection={insideOverlay} className={cn("in-[[data-slot=sheet-popup]:has([data-slot=sheet-header])]:pt-1 in-[[data-slot=sheet-popup]:has([data-slot=sheet-footer]:not(.border-t))]:pb-1", !insideOverlay && "cursor-auto", className)} data-slot={isMobile ? "drawer-panel" : "sheet-panel"} />
}

export function ResponsiveSheetFooter({ className, variant = "default", ...props }: ComponentProps<typeof SheetFooter>) {
  const { isMobile, insideOverlay } = useContext(ResponsiveSheetContext)
  return <DrawerFooter {...props} allowSelection={insideOverlay} className={cn(variant === "default" ? "sm:pb-4" : "sm:pb-6", !insideOverlay && "cursor-auto", className)} data-slot={isMobile ? "drawer-footer" : "sheet-footer"} variant={variant} />
}
