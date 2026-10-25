import { useTranslation } from "react-i18next"
import { redirect } from "react-router"

import type { Route } from "./+types/overview"

import Icon, { type AppIconName } from "~/components/icons"
import { JoinedTeamDialog } from "~/components/team/joined-team-dialog"
import { RouteHeader } from "~/components/layout/route-header"
import { ScrollPage } from "~/components/layout/page-layout"
import { Badge } from "~/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { shouldRevalidateAppRoute } from "~/lib/routing/should-revalidate"
import { useOverviewGreeting } from "~/lib/hooks/use-overview-greeting"

export function loader({ request }: Route.LoaderArgs): { greetingDate: string } {
  throw redirect(`/calendar${new URL(request.url).search}`)
}

export function clientLoader({ request }: Route.ClientLoaderArgs): { greetingDate: string } {
  throw redirect(`/calendar${new URL(request.url).search}`)
}

export const shouldRevalidate = shouldRevalidateAppRoute

const sections: { key: "summary" | "activity" | "shortcuts", icon: AppIconName }[] = [
  { key: "summary", icon: "chartBar" },
  { key: "activity", icon: "bolt" },
  { key: "shortcuts", icon: "dashboard" },
]

export default function Overview() {
  const { t } = useTranslation("dashboard")
  const greeting = useOverviewGreeting()

  return (
    <ScrollPage contentClassName="gap-6" header={<RouteHeader
      description={t("description")}
      showDescriptionOnMobile={false}
      title={greeting}
    />}>
      <title>{t("title")}</title>
      <JoinedTeamDialog />
      <Card className="flex-1 border-dashed shadow-none">
        <CardHeader className="flex-1 content-center justify-items-center gap-4 py-12 text-center sm:py-16">
          <div className="flex size-12 items-center justify-center rounded-xl border bg-muted/50">
            <Icon aria-hidden={true} name="dashboard" size={24} />
          </div>
          <Badge variant="secondary">{t("placeholder.label")}</Badge>
          <CardTitle render={<h2 />}>{t("placeholder.title")}</CardTitle>
          <CardDescription className="max-w-md leading-relaxed">
            {t("placeholder.description")}
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {sections.map(({ key, icon }) => (
          <Card key={key}>
            <CardHeader className="gap-3">
              <Icon aria-hidden={true} className="text-muted-foreground" name={icon} size={20} />
              <CardTitle className="text-base" render={<h2 />}>{t(`placeholder.${key}`)}</CardTitle>
              <CardDescription className="leading-relaxed">{t(`placeholder.${key}Description`)}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </ScrollPage>
  )
}
