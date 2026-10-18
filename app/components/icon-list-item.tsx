import { useLayoutEffect, useRef, type ReactNode, type Ref, type CSSProperties } from "react"
import { cn } from "~/lib/utils"

import Icon, { type AppIconName } from "~/components/icons"

export function IconListItem({ icon, children, actions, leading, className, ref, iconStyle, iconClassName }: { icon: AppIconName; children: ReactNode; actions?: ReactNode; leading?: ReactNode; className?: string; ref?: Ref<HTMLLIElement>; iconStyle?: CSSProperties; iconClassName?: string }) {
  const itemRef = useRef<HTMLLIElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const item = itemRef.current
    const content = contentRef.current
    if (!item || !content) return

    const updateSize = () => {
      item.style.setProperty("--content-height", `${content.getBoundingClientRect().height}px`)
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  return (
    <li className={cn("flex items-center gap-3 rounded-lg border bg-background p-4", className)} data-slot="icon-list-item" ref={(element) => {
      itemRef.current = element
      if (typeof ref === "function") return ref(element)
      if (ref) ref.current = element
    }}>
      {leading}
      <span className={cn("flex size-[var(--content-height,2.75rem)] shrink-0 items-center justify-center rounded-md bg-muted", iconClassName)} data-slot="icon-list-item-icon" style={iconStyle}>
        <Icon aria-hidden={true} className="size-5.5 sm:size-5" name={icon} size={22} />
      </span>
      <div className="grid min-w-0 flex-1 gap-1.5" data-slot="icon-list-item-content" ref={contentRef}>{children}</div>
      {actions}
    </li>
  )
}
