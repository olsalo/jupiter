import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import { localizationDefaults } from "~/lib/localization/defaults"
import { useAppContext } from "~/lib/hooks/use-app-context"
import type { loader as overviewLoader } from "~/routes/overview"

import { getGreetingPeriod } from "~/lib/overview/overview-time"

export function useOverviewGreeting() {
  const { t } = useTranslation("dashboard")
  const root = useAppContext()
  const overview = useRouteLoaderData<typeof overviewLoader>("routes/overview")
  const [now, setNow] = useState<string | null>(null)

  useEffect(() => {
    const update = () => setNow(new Date().toISOString())
    update()
    const interval = window.setInterval(update, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const date = now ?? overview?.greetingDate
  const period = date
    ? getGreetingPeriod(new Date(date), root?.organizationTimezone ?? localizationDefaults.timezone)
    : "morning"
  const name = root?.user?.name?.trim().split(/\s+/)[0]

  return t(`greeting.${period}${name ? "Named" : ""}`, { name })
}
