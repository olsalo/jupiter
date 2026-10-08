"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
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
import { getDialogPopupClassName, getDialogViewportClassName } from "~/components/dialog-popup-styles"

const DialogCreateHandle = DialogPrimitive.createHandle;

const overlayExitDuration = 220
const DialogClosingContext = createContext(false)

type DialogOpenChange = NonNullable<DialogPrimitive.Root.Props["onOpenChange"]>

function Dialog({
  onCloseStart,
  onOpenChange,
  open,
  ...props
}: DialogPrimitive.Root.Props & { onCloseStart?: () => void }) {
  const [isClosing, setIsClosing] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onOpenChangeRef = useRef(onOpenChange)
  const previousOpenRef = useRef(open)
  const isExternallyClosing = open === false && previousOpenRef.current === true

  useEffect(() => {
    previousOpenRef.current = open
  }, [open])

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
    if (open) {
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

  const handleOpenChange = useCallback<DialogOpenChange>(
    (...args) => {
      const [nextOpen] = args

      if (open !== undefined && !nextOpen && open) {
        if (closeTimerRef.current) return
        onCloseStart?.()
        cancelPendingClose()
        setIsClosing(true)
        closeTimerRef.current = setTimeout(() => {
          closeTimerRef.current = null
          setIsClosing(false)
          onOpenChangeRef.current?.(...args)
        }, overlayExitDuration)
        return
      }

      if (nextOpen) {
        cancelPendingClose()
      }

      onOpenChangeRef.current?.(...args)
    },
    [cancelPendingClose, onCloseStart, open],
  )

  return (
    <DialogClosingContext.Provider value={isClosing || isExternallyClosing}>
      {open === undefined ? (
        <DialogPrimitive.Root {...props} onOpenChange={handleOpenChange} />
      ) : (
        <DialogPrimitive.Root {...props} onOpenChange={handleOpenChange} open={open && !isClosing} />
      )}
    </DialogClosingContext.Provider>
  )
}

const DialogPortal = DialogPrimitive.Portal;

function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogBackdrop({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/32 backdrop-blur-[2px] transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className,
      )}
      data-slot="dialog-backdrop"
      {...props}
    />
  );
}

function DialogViewport({
  className,
  ...props
}: DialogPrimitive.Viewport.Props) {
  return (
    <DialogPrimitive.Viewport
      className={getDialogViewportClassName({ className: typeof className === "string" ? className : undefined })}
      data-slot="dialog-viewport"
      {...props}
    />
  );
}

function DialogPopup({
  className,
  children,
  showCloseButton = true,
  bottomStickOnMobile = false,
  centered = true,
  backdropClassName,
  forceBackdrop = false,
  renderBackdrop = true,
  viewportClassName,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  bottomStickOnMobile?: boolean;
  centered?: boolean
  backdropClassName?: string
  forceBackdrop?: boolean
  renderBackdrop?: boolean
  viewportClassName?: string
}) {
  const isClosing = useContext(DialogClosingContext)
  const previousChildrenRef = useRef(children)

  if (!isClosing) {
    previousChildrenRef.current = children
  }

  return (
    <DialogPortal>
      {renderBackdrop ? <DialogBackdrop className={backdropClassName} forceRender={forceBackdrop} /> : null}
      <DialogViewport
        className={cn(
          !centered && "grid-rows-[1fr_auto_3fr]",
          bottomStickOnMobile &&
            "max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12",
          viewportClassName,
        )}
      >
        <DialogPrimitive.Popup
          className={getDialogPopupClassName({
            bottomStickOnMobile,
            className: typeof className === "string" ? className : undefined,
          })}
          data-slot="dialog-popup"
          {...props}
          finalFocus={false}
          initialFocus={false}
        >
          {isClosing ? previousChildrenRef.current : children}
          {showCloseButton && (
            <DialogPrimitive.Close
              aria-label="Close"
              className="absolute end-2 top-2 z-50"
              render={<Button size="icon" variant="ghost" />}
            >
              <Icon name={"x"} />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </DialogViewport>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-6 in-[[data-slot=dialog-popup]:has([data-slot=dialog-panel])]:pb-3 max-sm:pb-4",
        className,
      )}
      data-slot="dialog-header"
      {...props}
    />
  );
}

function DialogFooter({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "bare";
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 px-6 sm:flex-row sm:justify-end sm:rounded-b-[calc(var(--radius-2xl)-1px)]",
        variant === "default" && "border-t border-border bg-muted/72 py-4",
        variant === "bare" &&
          "in-[[data-slot=dialog-popup]:has([data-slot=dialog-panel])]:pt-3 pt-4 pb-6",
        className,
      )}
      data-slot="dialog-footer"
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn(
        "font-heading font-semibold text-xl leading-none",
        className,
      )}
      data-slot="dialog-title"
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="dialog-description"
      {...props}
    />
  );
}

function DialogPanel({
  className,
  scrollAreaClassName,
  scrollbarClassName,
  stickyHeader,
  scrollFade = true,
  ...props
}: React.ComponentProps<"div"> & {
  scrollAreaClassName?: string
  scrollbarClassName?: string
  scrollFade?: boolean
  stickyHeader?: React.ReactNode
}) {
  return (
    <ScrollArea
      className={scrollAreaClassName}
      scrollbarClassName={scrollbarClassName}
      scrollFade={scrollFade}
      stickyHeader={stickyHeader}
    >
      <div
        className={cn(
          "p-6 in-[[data-slot=dialog-popup]:has([data-slot=dialog-header])]:pt-1 in-[[data-slot=dialog-popup]:has([data-slot=dialog-footer]:not(.border-t))]:pb-1",
          className,
        )}
        data-slot="dialog-panel"
        {...props}
      />
    </ScrollArea>
  );
}

export {
  DialogCreateHandle,
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogBackdrop,
  DialogBackdrop as DialogOverlay,
  DialogPopup,
  DialogPopup as DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogViewport,
};
