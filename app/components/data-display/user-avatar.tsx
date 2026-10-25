import type { ComponentProps } from "react"

import Icon from "~/components/icons"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { getAvatarColorClass } from "~/lib/preferences/avatar-color"
import { cn } from "~/lib/utils"

type UserAvatarProps = Omit<ComponentProps<typeof Avatar>, "children"> & {
  stableId: string
  name: string
  src?: string | null
  decorative?: boolean
  initialsCount?: 1 | 2
  fallbackClassName?: string
}

export function UserAvatar({ stableId, name, src, decorative = false, initialsCount = 2, className, fallbackClassName, ...props }: UserAvatarProps) {
  const colorClass = getAvatarColorClass(stableId)
  const initials = name.trim().split(/\s+/).map((part) => part.match(/[\p{L}\p{N}]/u)?.[0]).filter(Boolean).slice(0, initialsCount).join("").toUpperCase()

  return (
    <Avatar aria-hidden={decorative || undefined} aria-label={decorative ? undefined : name} className={cn("border border-black/8 dark:border-white/10", colorClass, className)} role={decorative ? undefined : "img"} {...props}>
      {src ? <AvatarImage alt="" draggable={false} src={src} /> : null}
      <AvatarFallback className={cn(colorClass, fallbackClassName)}>{initials || <Icon aria-hidden={true} className="size-1/2" name="user" />}</AvatarFallback>
    </Avatar>
  )
}
