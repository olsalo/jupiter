import { createContext, useContext, useEffect, useRef, useState, type ComponentProps } from "react"

import { getDialogPopupClassName, getDialogViewportClassName } from "~/components/dialog-popup-styles"
import { Drawer, DrawerBackdrop, DrawerBar, DrawerClose, DrawerDescription, DrawerFooter, DrawerHeader, DrawerPanel, DrawerPopup, DrawerTitle, DrawerTrigger } from "~/components/ui/drawer"
import { useMediaQuery } from "~/lib/hooks"
import { useHydrated } from "~/lib/use-hydrated"
import { cn } from "~/lib/utils"

const ResponsiveModalContext = createContext({ isMobile: false, initiallyServerRendered: false, open: false })

export function ResponsiveModal({ onOpenChange, open, defaultOpen = false, ...props }: Omit<ComponentProps<typeof Drawer>, "onOpenChange" | "position" | "swipeDirection"> & { onOpenChange?: (open: boolean) => void }) {
  const isMobile = useMediaQuery("max-640px")
  const hydrated = useHydrated()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const currentOpen = open ?? uncontrolledOpen
  const initiallyServerRendered = useRef(!hydrated && currentOpen)
  const [entryReady, setEntryReady] = useState(!hydrated)

  useEffect(() => { setEntryReady(true) }, [])
  useEffect(() => {
    if (!currentOpen) initiallyServerRendered.current = false
  }, [currentOpen])

  return <ResponsiveModalContext.Provider value={{ isMobile, initiallyServerRendered: initiallyServerRendered.current, open: currentOpen }}>
    <Drawer {...props} open={currentOpen && entryReady} swipeDirection="down" onOpenChange={(next, details) => {
      if (!isMobile && details.reason === "swipe") {
        details.cancel()
        return
      }
      if (open === undefined) setUncontrolledOpen(next)
      onOpenChange?.(next)
    }} />
  </ResponsiveModalContext.Provider>
}

export function ResponsiveModalPopup({ children, className, drawerClassName, titleId, descriptionId, forceBackdrop = false, showCloseButton = true, ...props }: Omit<ComponentProps<typeof DrawerPopup>, "ref" | "position" | "presentation" | "variant"> & { drawerClassName?: string; titleId?: string; descriptionId?: string }) {
  const { isMobile, initiallyServerRendered, open } = useContext(ResponsiveModalContext)
  const hydrated = useHydrated()
  const previousChildren = useRef(children)
  if (open) previousChildren.current = children
  const content = open ? children : previousChildren.current

  if (!hydrated) {
    if (!open) return null
    return <>
      <DrawerBackdrop forceRender={true} hidden={false} presentation="dialog" />
      <div className={getDialogViewportClassName({ className: "max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12" })} data-open="" data-slot="dialog-viewport" role="presentation">
        <div aria-describedby={descriptionId} aria-labelledby={titleId} aria-modal={true} className={getDialogPopupClassName({ className: cn("max-sm:not-has-data-[slot=dialog-footer]:pb-[env(safe-area-inset-bottom,0px)] max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0 max-sm:pt-2", className, drawerClassName) })} data-open="" data-slot="dialog-popup" role="dialog" tabIndex={-1}>
          {content}<DrawerBar className="sm:hidden" position="bottom" />
        </div>
      </div>
    </>
  }

  return <DrawerPopup
    {...props}
    aria-describedby={descriptionId}
    aria-labelledby={titleId}
    backdropClassName={initiallyServerRendered ? "data-starting-style:opacity-100" : undefined}
    className={isMobile ? cn(drawerClassName, initiallyServerRendered && "data-starting-style:transform-none") : cn(className, initiallyServerRendered && "data-starting-style:opacity-100 data-starting-style:scale-100")}
    forceBackdrop={forceBackdrop}
    position="bottom"
    presentation={isMobile ? "drawer" : "dialog"}
    showBar={isMobile}
    showCloseButton={showCloseButton}
  >{content}</DrawerPopup>
}

export function ResponsiveModalTrigger(props: ComponentProps<typeof DrawerTrigger>) {
  return <DrawerTrigger {...props} />
}

export function ResponsiveModalClose(props: ComponentProps<typeof DrawerClose>) {
  return <DrawerClose {...props} />
}

export function ResponsiveModalHeader({ className, ...props }: ComponentProps<typeof DrawerHeader>) {
  const { isMobile } = useContext(ResponsiveModalContext)
  return <DrawerHeader {...props} className={cn("in-[[data-slot=dialog-popup]:has([data-slot=dialog-panel])]:pb-3", className)} data-slot={isMobile ? "drawer-header" : "dialog-header"} />
}

export function ResponsiveModalTitle(props: ComponentProps<typeof DrawerTitle>) {
  const { isMobile } = useContext(ResponsiveModalContext)
  return <DrawerTitle {...props} data-slot={isMobile ? "drawer-title" : "dialog-title"} />
}

export function ResponsiveModalDescription(props: ComponentProps<typeof DrawerDescription>) {
  const { isMobile } = useContext(ResponsiveModalContext)
  return <DrawerDescription {...props} data-slot={isMobile ? "drawer-description" : "dialog-description"} />
}

export function ResponsiveModalPanel({ className, ...props }: ComponentProps<typeof DrawerPanel>) {
  const { isMobile } = useContext(ResponsiveModalContext)
  return <DrawerPanel {...props} allowSelection={true} className={cn("in-[[data-slot=dialog-popup]:has([data-slot=dialog-header])]:pt-1 in-[[data-slot=dialog-popup]:has([data-slot=dialog-footer]:not(.border-t))]:pb-1", className)} data-slot={isMobile ? "drawer-panel" : "dialog-panel"} />
}

export function ResponsiveModalFooter({ className, variant = "default", ...props }: ComponentProps<typeof DrawerFooter>) {
  const { isMobile } = useContext(ResponsiveModalContext)
  return <DrawerFooter {...props} allowSelection={true} className={cn("sm:rounded-b-[calc(var(--radius-2xl)-1px)]", variant === "default" ? "sm:pb-4" : "sm:pb-6", className)} data-slot={isMobile ? "drawer-footer" : "dialog-footer"} variant={variant} />
}
