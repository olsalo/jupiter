import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "~/.server/main"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import { Badge } from "~/components/ui/badge"
import { formatNumber } from "~/lib/format-preference"

type ServiceDetails = Pick<inferRouterOutputs<AppRouter>["service"]["list"][number], "durationMinutes" | "deliveryType" | "isActive" | "currency" | "description"> & { price: { toString: () => string } | null }

export function ServiceListDetails({ service }: { service: ServiceDetails }) {
  const { t } = useTranslation("services")
  const root = useRouteLoaderData<typeof rootLoader>("root")

  return <>
    <div className="flex flex-wrap items-center gap-2 max-sm:gap-1.5">
      <Badge variant="outline">{service.durationMinutes} {t("minutes")}</Badge>
      <Badge variant="outline">{t(service.deliveryType)}</Badge>
      {!service.isActive ? <Badge variant="secondary">{t("hidden")}</Badge> : null}
      {service.price !== null ? <span className="whitespace-nowrap text-xs leading-4 text-muted-foreground">{formatNumber(Number(service.price), root?.formatPreference ?? "eu", { style: "currency", currency: service.currency })}</span> : null}
    </div>
    {service.description ? <p className="line-clamp-2 wrap-anywhere text-xs leading-relaxed text-muted-foreground">{service.description}</p> : null}
  </>
}
