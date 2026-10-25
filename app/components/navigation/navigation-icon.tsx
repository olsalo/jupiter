import Icon, { type AppIconName } from "~/components/icons"
import { cn } from "~/lib/utils"

type NavigationIconProps = {
  active: boolean
  activeIcon?: AppIconName
  icon: AppIconName
  size: number
}

export function NavigationIcon({
  active,
  activeIcon,
  icon,
  size,
}: NavigationIconProps) {
  const hasActiveIcon = Boolean(activeIcon && activeIcon !== icon)

  return (
    <span
      aria-hidden="true"
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ height: size, width: size }}
    >
      <Icon
        className={cn(
          "absolute inset-0 transition-opacity duration-300 ease-out motion-reduce:transition-none",
          active && hasActiveIcon && "opacity-0",
        )}
        name={icon}
        size={size}
      />
      {hasActiveIcon && activeIcon ? (
        <Icon
          className={cn(
            "absolute inset-0 opacity-0 transition-opacity duration-300 ease-out motion-reduce:transition-none",
            active && "opacity-100",
          )}
          name={activeIcon}
          size={size}
        />
      ) : null}
    </span>
  )
}
