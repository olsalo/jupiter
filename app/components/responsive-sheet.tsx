import { createContext, useContext, useRef, type ComponentProps } from "react"

import { AnimatedDrawerPopup } from "~/components/animated-drawer-popup"
import Icon from "~/components/icons"
import { ServerRenderedSheetPopup } from "~/components/server-rendered-sheet-popup"
import { Button } from "~/components/ui/button"
import {
  Drawer, DrawerBar, DrawerClose, DrawerDescription, DrawerFooter,
  DrawerHeader, DrawerPanel, DrawerTitle,
} from "~/components/ui/drawer"
import {
  Sheet, SheetDescription, SheetFooter, SheetHeader, SheetPanel, SheetTitle,
} from "~/components/ui/sheet"
import { useMediaQuery } from "~/lib/hooks"
import { useHydrated } from "~/lib/use-hydrated"
import { cn } from "~/lib/utils"

const ResponsiveSheetContext = createContext({ isMobile: false, initiallyServerRendered: false })

export function ResponsiveSheet({ deferClose, ...props }: Omit<ComponentProps<typeof Sheet>, "onOpenChange" | "handle"> & {
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useMediaQuery("max-640px")
  const hydrated = useHydrated()
  const initiallyServerRendered = useRef(!hydrated)

  return (
    <ResponsiveSheetContext.Provider value={{ isMobile, initiallyServerRendered: initiallyServerRendered.current }}>
      {isMobile ? <Drawer {...props} /> : <Sheet deferClose={deferClose} {...props} />}
    </ResponsiveSheetContext.Provider>
  )
}

export function ResponsiveSheetPopup({
  children,
  className,
  closeLabel,
  descriptionId,
  open,
  titleId,
  ...props
}: ComponentProps<typeof ServerRenderedSheetPopup>) {
  const { isMobile, initiallyServerRendered } = useContext(ResponsiveSheetContext)

  if (isMobile) {
    return (
      <AnimatedDrawerPopup
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        backdropClassName={initiallyServerRendered ? "data-starting-style:opacity-100" : undefined}
        className={initiallyServerRendered ? "data-starting-style:transform-none" : undefined}
        forceBackdrop={true}
        showBar={true}
        showCloseButton={false}
      >
        {children}
        <DrawerClose
          aria-label={closeLabel}
          className="absolute inset-e-2 top-2 z-1"
          render={<Button size="icon" type="button" variant="ghost" />}
        >
          <Icon aria-hidden={true} name="x" />
        </DrawerClose>
      </AnimatedDrawerPopup>
    )
  }

  // The server cannot read the viewport. CSS presents the same single set of
  // server-rendered content as a bottom drawer until the mobile Drawer takes over.
  return (
    <ServerRenderedSheetPopup
      {...props}
      className={cn("max-sm:col-start-1 max-sm:row-start-2 max-sm:w-full max-sm:max-w-none max-sm:rounded-t-2xl max-sm:border-s-0 max-sm:border-t max-sm:pt-2", className)}
      closeLabel={closeLabel}
      descriptionId={descriptionId}
      open={open}
      titleId={titleId}
      viewportClassName="max-sm:grid max-sm:grid-cols-1 max-sm:grid-rows-[1fr_auto] max-sm:justify-normal max-sm:pt-12"
    >
      {children}
      <DrawerBar className="sm:hidden" position="bottom" />
    </ServerRenderedSheetPopup>
  )
}

export function ResponsiveSheetHeader(props: ComponentProps<typeof SheetHeader>) {
  return useContext(ResponsiveSheetContext).isMobile ? <DrawerHeader {...props} /> : <SheetHeader {...props} />
}

export function ResponsiveSheetTitle(props: ComponentProps<typeof SheetTitle>) {
  return useContext(ResponsiveSheetContext).isMobile ? <DrawerTitle {...props} /> : <SheetTitle {...props} />
}

export function ResponsiveSheetDescription(props: ComponentProps<typeof SheetDescription>) {
  return useContext(ResponsiveSheetContext).isMobile ? <DrawerDescription {...props} /> : <SheetDescription {...props} />
}

export function ResponsiveSheetPanel(props: ComponentProps<typeof SheetPanel>) {
  return useContext(ResponsiveSheetContext).isMobile ? <DrawerPanel {...props} /> : <SheetPanel {...props} />
}

export function ResponsiveSheetFooter({ className, ...props }: ComponentProps<typeof SheetFooter>) {
  return useContext(ResponsiveSheetContext).isMobile ? <DrawerFooter className={className} {...props} /> : (
    <SheetFooter className={cn("max-sm:pb-[calc(env(safe-area-inset-bottom,0px)+--spacing(4))]", className)} {...props} />
  )
}
