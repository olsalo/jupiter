import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation, useSearchParams } from "react-router"

import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"
import { cn } from "~/lib/utils"
import { getTeamPersonSections } from "./team-person-tabs"

export function TeamPersonNavigationLayout({ enabled, mode, value, onValueChange, disabled = false, children }: {
  enabled: boolean
  mode: "view" | "edit"
  value: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  children: ReactNode
}) {
  const { t } = useTranslation("team")
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const sections = getTeamPersonSections(mode)

  if (!enabled) return children

  return (
    <div className="flex min-h-0 min-w-0 flex-1" data-slot="team-person-navigation-layout">
      <aside aria-label={t(mode === "edit" ? "people.edit" : "people.details")} className="hidden min-h-0 w-64 shrink-0 flex-col border-r lg:w-80 @min-[80rem]/team:flex" data-slot="team-person-navigation">
        <h2 className="px-4 pb-3 pt-4 text-sm font-medium">{t(mode === "edit" ? "people.edit" : "people.details")}</h2>
        <ScrollArea className="min-h-0 flex-1" overscrollContain={true} scrollFade={true}>
          <nav aria-label={t(mode === "edit" ? "people.edit" : "people.details")} className="grid gap-1 px-2 pb-4">
            {sections.map((section) => {
              const params = new URLSearchParams(searchParams)
              params.set(mode === "edit" ? "editTab" : "profileTab", section.value)
              return <Button
                aria-current={value === section.value ? "page" : undefined}
                className={cn("h-auto min-h-10 w-full justify-start gap-3 whitespace-normal px-3 py-2 text-left font-normal", value === section.value && "bg-muted font-medium")}
                disabled={disabled}
                key={section.value}
                onClick={onValueChange ? () => onValueChange(section.value) : undefined}
                render={onValueChange ? undefined : <Link to={{ pathname: location.pathname, search: `?${params}` }} replace={true} state={location.state} preventScrollReset={true} />}
                type="button"
                variant="ghost"
              ><Icon aria-hidden={true} className="size-4 shrink-0" name={section.icon} size={16} /><span>{t(section.labelKey)}</span></Button>
            })}
          </nav>
        </ScrollArea>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
