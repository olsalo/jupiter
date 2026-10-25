import { useId, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Link, Outlet, useLocation } from "react-router"

import Icon, { type AppIconName } from "~/components/icons"
import type { PlaceholderTitle } from "~/components/placeholders/route-placeholder"
import { RouteHeader } from "~/components/layout/route-header"
import { ScrollPage } from "~/components/layout/page-layout"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "~/components/ui/card"

export type ArchitectureSection = "calendar" | "customers" | "services" | "bookingPage" | "locations" | "booking" | "communications"

type ArchitectureContent = {
  purpose: string
  access: string
  entry: string
  actions: string[]
  sections: { title: string, surface: string, items: string[] }[]
  note: string
}

export function RouteInformationArchitecture({ section, icon }: { section: ArchitectureSection, icon: AppIconName }) {
  const { t } = useTranslation("ia")
  const headingId = useId()
  const content = t(section, { returnObjects: true }) as ArchitectureContent

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-5 pb-6" data-slot="route-information-architecture" data-section={section}>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{t("preview")}</Badge>
            <Badge variant="outline">{content.access}</Badge>
          </div>
          <CardTitle className="flex items-center gap-2 text-base" render={<h2 id={headingId} />}>
            <Icon aria-hidden={true} className="shrink-0 text-muted-foreground" name={icon} size={20} />
            {t("title")}
          </CardTitle>
          <CardDescription className="max-w-2xl leading-6">{content.purpose}</CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-4">
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">{t("entry")}</p>
            <p className="mt-1 text-sm font-medium">{content.entry}</p>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">{t("actions")}</h3>
            <ul className="flex flex-wrap gap-2">
              {content.actions.map((action) => <li key={action}><Badge className="h-auto whitespace-normal px-2 py-1" variant="secondary">{action}</Badge></li>)}
            </ul>
          </div>
        </CardPanel>
      </Card>

      <div className="grid grid-cols-1 gap-4 @min-[36rem]:grid-cols-2">
        {content.sections.map((item, index) => (
          <Card className="h-full" key={item.title}>
            <CardHeader className="gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span aria-hidden={true} className="flex size-6 shrink-0 items-center justify-center rounded-md border bg-muted/40 font-medium tabular-nums">{index + 1}</span>
                <span>{item.surface}</span>
              </div>
              <CardTitle className="text-base leading-6" render={<h3 />}>{item.title}</CardTitle>
            </CardHeader>
            <CardPanel>
              <ul className="space-y-2.5">
                {item.items.map((label) => (
                  <li className="flex items-start gap-2 text-sm leading-5" key={label}>
                    <Icon aria-hidden={true} className="mt-0.5 shrink-0 text-muted-foreground/60" name="minus" size={16} />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            </CardPanel>
          </Card>
        ))}
      </div>
      <Alert role="note" showIcon={true} variant="info">
        <AlertTitle>{t("ownership")}</AlertTitle>
        <AlertDescription>{content.note}</AlertDescription>
      </Alert>
    </section>
  )
}

export function InformationArchitecturePage({ section, titleKey, icon, createTitleKey, controls }: {
  section: ArchitectureSection
  titleKey: PlaceholderTitle
  icon: AppIconName
  createTitleKey?: PlaceholderTitle
  controls?: ReactNode
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const title = t(`routeTitles.${titleKey}`)

  return (
    <ScrollPage header={<RouteHeader controls={controls} title={title} description={t(`routeDescriptions.${titleKey}`)} showDescriptionOnMobile={false} actions={createTitleKey ? (
        <Button aria-label={t(`routeActions.${createTitleKey}`)} className="max-md:size-9 max-md:p-0" render={<Link to={`new${location.search}`} state={{ returnTo: `${location.pathname}${location.search}` }} />} size="lg" type="button">
          <Icon aria-hidden={true} name="add" size={18} />
          <span className="hidden md:inline">{t(`routeActions.${createTitleKey}`)}</span>
        </Button>
      ) : undefined} />}>
      <title>{title}</title>
      <div className="@container flex min-w-0 flex-col gap-4">
        <RouteInformationArchitecture section={section} icon={icon} />
        <Outlet />
      </div>
    </ScrollPage>
  )
}
