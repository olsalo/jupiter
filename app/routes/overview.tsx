import { useTranslation } from "react-i18next"

import Icon, { type AppIconName } from "~/components/icons"
import { JoinTeamInvitation } from "~/components/join-team-invitation"
import { JoinedTeamDialog } from "~/components/joined-team-dialog"
import { PageHeader } from "~/components/page-header"
import { Badge } from "~/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"
import { useOverviewGreeting } from "~/lib/use-overview-greeting"

export function loader() {
  return { greetingDate: new Date().toISOString() }
}

export function clientLoader() {
  return { greetingDate: new Date().toISOString() }
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
    <section className="flex w-full flex-1 flex-col gap-6">
      <title>{t("title")}</title>
      <JoinTeamInvitation />
      <JoinedTeamDialog />
      <PageHeader
        className="route-mobile-header md:hidden"
        description={t("description")}
        showDescriptionOnMobile={true}
        title={greeting}
      />
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
    </section>
  )
}
