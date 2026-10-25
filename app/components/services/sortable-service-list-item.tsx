import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers"
import { closestCorners } from "@dnd-kit/collision"
import { RestrictToElement } from "@dnd-kit/dom/modifiers"
import { useSortable } from "@dnd-kit/react/sortable"
import type { ReactNode, RefObject } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { IconListItem } from "~/components/data-display/icon-list-item"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

export function SortableServiceListItem({ id, index, name, color, disabled, showHandle, containerRef, children, actions }: {
  id: string
  index: number
  name: string
  color: string | null
  disabled: boolean
  showHandle: boolean
  containerRef: RefObject<HTMLUListElement | null>
  children: ReactNode
  actions?: ReactNode
}) {
  const { t } = useTranslation("services")
  const sortable = useSortable({
    id,
    index,
    disabled,
    collisionDetector: closestCorners,
    modifiers: [RestrictToVerticalAxis, RestrictToElement.configure({ element: () => containerRef.current })],
  })

  return <IconListItem
    className={cn("relative cursor-pointer bg-background transition-colors max-sm:gap-3 max-sm:p-3", showHandle ? "max-sm:[&>[data-slot=icon-list-item-content]>a]:pr-24" : actions ? "max-sm:[&>[data-slot=icon-list-item-content]>a]:pr-14" : undefined, sortable.isDragging ? "z-10 rounded-md shadow-lg" : "hover:not-has-[[data-slot=service-list-control]:hover,[data-popup-open]]:bg-muted/40 active:not-has-[[data-slot=service-list-control]:hover,[data-popup-open]]:bg-muted/60")}
    actions={actions ? <div className={cn("relative z-10 shrink-0 max-sm:absolute max-sm:top-3", showHandle ? "max-sm:right-14" : "max-sm:right-3")} data-slot="service-list-control">{actions}</div> : null}
    iconClassName={cn("h-auto w-1 self-stretch", color ? "bg-current" : undefined)}
    iconStyle={color ? { color } : undefined}
    ref={sortable.ref}
    leading={showHandle ? <Button aria-label={t("moveService", { name })} className="relative z-10 touch-none cursor-grab text-muted-foreground hover:bg-transparent active:cursor-grabbing active:bg-transparent max-sm:absolute max-sm:top-3 max-sm:right-3 max-sm:size-9" data-slot="service-list-control" disabled={disabled} ref={sortable.handleRef} size="icon-sm" type="button" variant="ghost"><Icon aria-hidden={true} name="gripVertical" size={16} /></Button> : null}
  >{children}</IconListItem>
}
