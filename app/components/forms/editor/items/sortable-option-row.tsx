import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers"
import { closestCorners } from "@dnd-kit/collision"
import { RestrictToElement } from "@dnd-kit/dom/modifiers"
import { useSortable } from "@dnd-kit/react/sortable"
import type { ReactNode, RefObject } from "react"

import { Field } from "~/components/ui/field"
import Icon from "~/components/icons"

type SortableOptionRowProps = {
  children: ReactNode
  containerRef: RefObject<HTMLDivElement | null>
  id: string
  index: number
  invalid: boolean
  label: string
}

export function SortableOptionRow({
  children,
  containerRef,
  id,
  index,
  invalid,
  label,
}: SortableOptionRowProps) {
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
    <Field className="min-w-0 gap-0" invalid={invalid} ref={sortable.ref}>
      <div className="relative flex h-8.5 w-full items-center gap-2.5 sm:h-7.5">
        <button
          aria-label={label}
          className="flex h-full w-6 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring"
          ref={sortable.handleRef}
          type="button"
        >
          <Icon aria-hidden="true" className="pointer-events-none shrink-0" name="gripVertical" size={16} />
        </button>
        {children}
      </div>
    </Field>
  )
}
