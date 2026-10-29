import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers"
import { closestCorners } from "@dnd-kit/collision"
import { RestrictToElement } from "@dnd-kit/dom/modifiers"
import { useSortable } from "@dnd-kit/react/sortable"
import type { Ref, RefObject } from "react"
import { useTranslation } from "react-i18next"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

export function SortableBookingPageChoice({ id, index, name, disabled, sortableDisabled, containerRef, visible, onToggleVisibility, inputRef }: {
  id: string
  index: number
  name: string
  disabled: boolean
  sortableDisabled: boolean
  visible: boolean
  onToggleVisibility: () => void
  inputRef?: Ref<HTMLButtonElement>
  containerRef: RefObject<HTMLUListElement | null>
}) {
  const { t } = useTranslation("services")
  const { t: common } = useTranslation()
  const sortable = useSortable({
    id,
    index,
    disabled: sortableDisabled,
    collisionDetector: closestCorners,
    modifiers: [RestrictToVerticalAxis, RestrictToElement.configure({ element: () => containerRef.current })],
  })

  return <li
    className={cn("relative flex min-h-12 items-center gap-2 bg-background px-2 py-1.5 first:rounded-t-lg last:rounded-b-lg", sortable.isDragging && "z-10 rounded-lg shadow-md ring-1 ring-border")}
    ref={sortable.ref}
  >
    <Button aria-label={t("moveService", { name })} className="size-9 shrink-0 touch-none cursor-grab text-muted-foreground active:cursor-grabbing" disabled={sortableDisabled} ref={sortable.handleRef} size="icon" type="button" variant="ghost"><Icon aria-hidden={true} name="gripVertical" size={16} /></Button>
    <span className={cn("min-w-0 flex-1 py-1 pr-2 text-sm wrap-anywhere", !visible && "text-muted-foreground")}>{name}</span>
    <Button aria-label={common(visible ? "adminBookingPage.hideService" : "adminBookingPage.showService", { name })} className="min-w-20" disabled={disabled} onClick={onToggleVisibility} ref={inputRef} size="sm" type="button" variant="ghost"><Icon aria-hidden={true} name={visible ? "eye" : "eyeOff"} size={16} />{common(visible ? "adminBookingPage.hide" : "adminBookingPage.show")}</Button>
  </li>
}
