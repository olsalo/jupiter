import type { ReactNode } from "react"

export function SettingsSectionHeader({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="grid gap-1">
      <h3 className="text-sm font-medium">{title}</h3>
      {description ? <p className="text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
    </div>
  )
}
