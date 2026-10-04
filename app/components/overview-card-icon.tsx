import Icon, { type AppIconName } from "~/components/icons"
import { cn } from "~/lib/utils"

export type OverviewCardIconTone = "green" | "blue" | "violet"

type OverviewCardIconProps = {
  icon: AppIconName
  tone: OverviewCardIconTone
  size?: "sm" | "md"
}

const iconTones = {
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  blue: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
}

export function OverviewCardIcon({ icon, tone, size = "sm" }: OverviewCardIconProps) {
  return (
    <span aria-hidden={true} className={cn(
      "flex shrink-0 items-center justify-center",
      size === "sm" ? "size-8 rounded-lg" : "size-10 rounded-xl",
      iconTones[tone],
    )}>
      <Icon name={icon} size={size === "sm" ? 16 : 20} stroke={1.75} />
    </span>
  )
}
