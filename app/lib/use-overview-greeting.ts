import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import type { loader as overviewLoader } from "~/routes/overview"
import { defaultTimeZone } from "~/lib/format-preference"
import { getGreetingPeriod } from "~/lib/overview-time"

export function useOverviewGreeting() {
  const { t } = useTranslation("dashboard")
  const root = useRouteLoaderData<typeof rootLoader>("root")
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
    ? getGreetingPeriod(new Date(date), root?.organizationTimezone ?? defaultTimeZone)
    : "morning"
  const name = root?.user?.name?.trim().split(/\s+/)[0]

  return t(`greeting.${period}${name ? "Named" : ""}`, { name })
}
