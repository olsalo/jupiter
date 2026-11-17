import { useRef, type CSSProperties, type ReactNode } from "react"

import Icon from "../icons/icons"
import { getSheetPopupClassName, getSheetViewportClassName, type SheetSide, type SheetVariant } from "./sheet-popup-styles"
import { Button } from "../button"
import { SheetBackdrop, SheetClose, SheetPopup } from "../sheet"
import { useHydrated } from "../utils/use-hydrated"
import { cn } from "../utils/utils"

type ServerRenderedSheetPopupProps = {
  children: ReactNode
  className?: string
  viewportClassName?: string
  style?: CSSProperties
  side?: SheetSide
  variant?: SheetVariant
  open: boolean
  titleId: string
  descriptionId: string
  closeLabel: string
}

export function ServerRenderedSheetPopup({
  children,
  className,
  viewportClassName,
  style,
  side = "right",
  variant = "default",
  open,
  titleId,
  descriptionId,
  closeLabel,
}: ServerRenderedSheetPopupProps) {
  const hydrated = useHydrated()
  const initiallyServerRendered = useRef(!hydrated)
  const content = <>
    {children}
    <SheetClose
      aria-label={closeLabel}
      className="absolute inset-e-2 top-2 z-1"
      render={<Button size="icon" type="button" variant="ghost" />}
    >
      <Icon aria-hidden={true} name="x" />
    </SheetClose>
  </>

  if (hydrated) {
    return (
      <SheetPopup
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        backdropClassName={initiallyServerRendered.current ? "data-starting-style:opacity-100" : undefined}
        className={cn(className, initiallyServerRendered.current && "data-starting-style:opacity-100 data-starting-style:translate-x-0 data-starting-style:translate-y-0")}
        forceBackdrop={true}
        showCloseButton={false}
        side={side}
        style={style}
        variant={variant}
        viewportClassName={viewportClassName}
      >
        {content}
      </SheetPopup>
    )
  }

  if (!open) return null

  return (
    <>
      <SheetBackdrop forceRender={true} hidden={false} />
      <div className={getSheetViewportClassName({ className: viewportClassName, side, variant })} data-open="" data-slot="sheet-viewport" role="presentation">
        <div
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          aria-modal={true}
          className={getSheetPopupClassName({ className, side, variant })}
          data-open=""
          data-slot="sheet-popup"
          role="dialog"
          style={style}
          tabIndex={-1}
        >
          {content}
        </div>
      </div>
    </>
  )
}
