import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers"
import { closestCorners } from "@dnd-kit/collision"
import { RestrictToElement } from "@dnd-kit/dom/modifiers"
import { useSortable } from "@dnd-kit/react/sortable"
import type { ReactNode, RefObject } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { cn } from "~/lib/utils"

type SortableItemCardProps = {
  active: boolean
  children: ReactNode
  containerRef: RefObject<HTMLDivElement | null>
  id: string
  index: number
  label: string
  onActivate: (id: string) => void
}

export function SortableItemCard({ active, children, containerRef, id, index, label, onActivate }: SortableItemCardProps) {
  const { t } = useTranslation("forms")
  const sortable = useSortable({
    collisionDetector: closestCorners,
    id,
    index,
    modifiers: [
      RestrictToVerticalAxis,
      RestrictToElement.configure({ element: () => containerRef.current }),
    ],
  })

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-border bg-background p-4 shadow-xs",
        active && "border-foreground/20",
        sortable.isDragging && "z-10 shadow-lg",
      )}
      data-form-input-card=""
      onFocusCapture={() => onActivate(id)}
      onPointerDownCapture={() => onActivate(id)}
      ref={sortable.ref}
      tabIndex={0}
    >
      <button
        aria-label={t("workspace.moveQuestion", { title: label })}
        className={cn(
          "absolute -left-6 top-0 flex h-full w-6 cursor-grab items-center justify-center text-muted-foreground outline-none touch-none transition-opacity active:cursor-grabbing focus-visible:opacity-100 focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          active || sortable.isDragging
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100",
        )}
        data-form-drag-handle=""
        ref={sortable.handleRef}
        type="button"
      >
        <Icon aria-hidden="true" className="pointer-events-none shrink-0" name="gripVertical" size={16} />
      </button>
      {children}
    </div>
  )
}
