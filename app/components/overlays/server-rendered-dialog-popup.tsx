import { useRef, type CSSProperties, type ReactNode } from "react"

import { getDialogPopupClassName, getDialogViewportClassName } from "~/components/dialog-popup-styles"
import { DialogBackdrop, DialogPopup } from "~/components/ui/dialog"
import { cn } from "~/lib/utils"
import { useHydrated } from "~/lib/use-hydrated"

type ServerRenderedDialogPopupProps = {
  children: ReactNode
  className?: string
  backdropClassName?: string
  forceBackdrop?: boolean
  renderBackdrop?: boolean
  viewportClassName?: string
  open: boolean
  titleId: string
  descriptionId?: string
}

export function ServerRenderedDialogPopup({
  children,
  className,
  backdropClassName,
  forceBackdrop = false,
  renderBackdrop = true,
  viewportClassName,
  open,
  titleId,
  descriptionId,
}: ServerRenderedDialogPopupProps) {
  const hydrated = useHydrated()
  const initiallyServerRendered = useRef(!hydrated)

  if (hydrated) {
    return (
      <DialogPopup
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        backdropClassName={cn(backdropClassName, initiallyServerRendered.current && "data-starting-style:opacity-100")}
        className={cn(className, initiallyServerRendered.current && "data-starting-style:opacity-100 data-starting-style:scale-100")}
        forceBackdrop={forceBackdrop}
        renderBackdrop={renderBackdrop}
        showCloseButton={false}
        viewportClassName={viewportClassName}
      >
        {children}
      </DialogPopup>
    )
  }

  if (!open) return null

  // React portals omit their children during SSR. Keep the initial hydration
  // markup inline, then let Base UI own focus, dismissal, and transitions.
  return (
    <>
      {renderBackdrop ? <DialogBackdrop className={backdropClassName} forceRender={forceBackdrop} hidden={false} /> : null}
      <div
        className={getDialogViewportClassName({ className: viewportClassName })}
        data-open=""
        data-slot="dialog-viewport"
        role="presentation"
      >
        <div
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          aria-modal={true}
          className={getDialogPopupClassName({ className })}
          data-open=""
          data-slot="dialog-popup"
          role="dialog"
          style={{ "--nested-dialogs": 0 } as CSSProperties}
          tabIndex={-1}
        >
          {children}
        </div>
      </div>
    </>
  )
}
