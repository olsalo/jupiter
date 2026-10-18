import type { ComponentProps } from "react"

import Icon from "~/components/icons"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { getAvatarColorClass } from "~/lib/avatar-color"
import { cn } from "~/lib/utils"

type UserAvatarProps = Omit<ComponentProps<typeof Avatar>, "children"> & {
  stableId: string
  name: string
  src?: string | null
  decorative?: boolean
}

export function UserAvatar({ stableId, name, src, decorative = false, className, ...props }: UserAvatarProps) {
  const colorClass = getAvatarColorClass(stableId)
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => Array.from(part)[0]).join("").toUpperCase()

  return (
    <Avatar aria-hidden={decorative || undefined} aria-label={decorative ? undefined : name} className={cn("border border-black/8 dark:border-white/10", colorClass, className)} role={decorative ? undefined : "img"} {...props}>
      {src ? <AvatarImage alt="" draggable={false} src={src} /> : null}
      <AvatarFallback className={colorClass}>{initials || <Icon aria-hidden={true} className="size-1/2" name="user" />}</AvatarFallback>
    </Avatar>
  )
}
