"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import Icon from "../icons"
import { cn } from "@coss/ui/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getSheetPopupClassName, getSheetViewportClassName } from "~/components/sheet-popup-styles"

const SheetClosingContext = createContext(false)
const sheetExitDuration = 220

type SheetOpenChange = NonNullable<SheetPrimitive.Root.Props["onOpenChange"]>

function Sheet({
  deferClose = true,
  onOpenChange,
  open,
  ...props
}: SheetPrimitive.Root.Props & { deferClose?: boolean }) {
  const [isClosing, setIsClosing] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onOpenChangeRef = useRef(onOpenChange)
  const previousOpenRef = useRef(open)
  const isExternallyClosing = open === false && previousOpenRef.current === true
  const isReopening = open === true && previousOpenRef.current === false

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  }, [onOpenChange])

  const cancelPendingClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }

    setIsClosing(false)
  }, [])

  useEffect(() => {
    const wasOpen = previousOpenRef.current
    previousOpenRef.current = open

    if (open === false && wasOpen === true) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }

      setIsClosing(true)
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null
        setIsClosing(false)
      }, sheetExitDuration)
    } else if (open === true && wasOpen === false) {
      cancelPendingClose()
    }
  }, [cancelPendingClose, open])

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
    },
    [],
  )

  const handleOpenChange = useCallback<SheetOpenChange>(
    (...args) => {
      const [nextOpen] = args

      if (deferClose && open !== undefined && !nextOpen && open) {
        if (isClosing || closeTimerRef.current) {
          return
        }

        setIsClosing(true)
        closeTimerRef.current = setTimeout(() => {
          closeTimerRef.current = null
          onOpenChangeRef.current?.(...args)
        }, sheetExitDuration)
        return
      }

      if (nextOpen) {
        cancelPendingClose()
      }

      onOpenChangeRef.current?.(...args)
    },
    [cancelPendingClose, deferClose, isClosing, open],
  )

  return (
    <SheetClosingContext.Provider value={(isClosing && !isReopening) || isExternallyClosing}>
      {open === undefined ? (
        <SheetPrimitive.Root {...props} onOpenChange={handleOpenChange} />
      ) : (
        <SheetPrimitive.Root
          {...props}
          onOpenChange={handleOpenChange}
          open={open && (!isClosing || isReopening)}
        />
      )}
    </SheetClosingContext.Provider>
  )
}

const SheetPortal = SheetPrimitive.Portal;

function SheetTrigger(props: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetBackdrop({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/32 backdrop-blur-[2px] transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className,
      )}
      data-slot="sheet-backdrop"
      {...props}
    />
  );
}

function SheetViewport({
  className,
  side,
  variant = "default",
  ...props
}: SheetPrimitive.Viewport.Props & {
  side?: "right" | "left" | "top" | "bottom";
  variant?: "default" | "inset";
}) {
  return (
    <SheetPrimitive.Viewport
      className={getSheetViewportClassName({ className: typeof className === "string" ? className : undefined, side, variant })}
      data-slot="sheet-viewport"
      {...props}
    />
  );
}

function SheetPopup({
  className,
  children,
  showCloseButton = true,
  side = "right",
  variant = "default",
  backdropClassName,
  viewportClassName,
  forceBackdrop = false,
  ...props
}: SheetPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  side?: "right" | "left" | "top" | "bottom";
  variant?: "default" | "inset";
  backdropClassName?: string
  viewportClassName?: string
  forceBackdrop?: boolean
}) {
  const isClosing = useContext(SheetClosingContext)
  const previousChildrenRef = useRef(children)

  if (!isClosing) {
    previousChildrenRef.current = children
  }

  return (
    <SheetPortal>
      <SheetBackdrop className={backdropClassName} forceRender={forceBackdrop} />
      <SheetViewport className={viewportClassName} side={side} variant={variant}>
        <SheetPrimitive.Popup
          className={getSheetPopupClassName({ className: typeof className === "string" ? className : undefined, side, variant })}
          data-slot="sheet-popup"
          {...props}
          finalFocus={false}
          initialFocus={false}
        >
          {isClosing ? previousChildrenRef.current : children}
          {showCloseButton && (
            <SheetPrimitive.Close
              aria-label="Close"
              className="absolute inset-e-2 top-2"
              render={<Button size="icon" variant="ghost" />}
            >
              <Icon name={"x"} />
            </SheetPrimitive.Close>
          )}
        </SheetPrimitive.Popup>
      </SheetViewport>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-6 in-[[data-slot=sheet-popup]:has([data-slot=sheet-panel])]:pb-3 max-sm:pb-4",
        className,
      )}
      data-slot="sheet-header"
      {...props}
    />
  );
}

function SheetFooter({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "bare";
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 px-6 sm:flex-row sm:justify-end border-border",
        variant === "default" && "border-t bg-muted/72 py-4",
        variant === "bare" &&
          "in-[[data-slot=sheet-popup]:has([data-slot=sheet-panel])]:pt-3 pt-4 pb-6",
        className,
      )}
      data-slot="sheet-footer"
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      className={cn(
        "font-heading font-semibold text-xl leading-none",
        className,
      )}
      data-slot="sheet-title"
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="sheet-description"
      {...props}
    />
  );
}

function SheetPanel({
  className,
  scrollFade = true,
  ...props
}: React.ComponentProps<"div"> & { scrollFade?: boolean }) {
  return (
    <ScrollArea scrollFade={scrollFade}>
      <div
        className={cn(
          "p-6 in-[[data-slot=sheet-popup]:has([data-slot=sheet-header])]:pt-1 in-[[data-slot=sheet-popup]:has([data-slot=sheet-footer]:not(.border-t))]:pb-1",
          className,
        )}
        data-slot="sheet-panel"
        {...props}
      />
    </ScrollArea>
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetPortal,
  SheetClose,
  SheetBackdrop,
  SheetBackdrop as SheetOverlay,
  SheetPopup,
  SheetPopup as SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetPanel,
};
