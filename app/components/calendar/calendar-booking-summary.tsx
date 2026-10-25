import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import type { CustomerOption } from "~/components/customers/customer-picker"
import { Badge } from "~/components/ui/badge"
import { Card } from "~/components/ui/card"
import { UserAvatar } from "~/components/data-display/user-avatar"
import { formatDateTime, type FormatPreference } from "~/lib/localization/format-preference"

export function CalendarBookingSummary({ service, startsAt, endsAt, member, customer, timeZone, formatPreference, children }: {
  children?: ReactNode
  service: { name: string; durationMinutes: number; color?: string | null }
  startsAt: string
  endsAt: string
  member?: { id: string; name: string; image?: string | null }
  customer?: CustomerOption | null
  timeZone: string
  formatPreference: FormatPreference
}) {
  const { t, i18n } = useTranslation()
  const options = { formatPreference, timeZone, language: i18n.resolvedLanguage === "fi" ? "fi" as const : "en" as const }

  return <Card className="gap-3 rounded-xl bg-muted/15 p-3 shadow-none before:hidden" render={<section aria-label={t("bookingForm.summary")} />}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <span aria-hidden={true} className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: service.color ?? "var(--primary)" }} />
        <h3 className="min-w-0 text-sm leading-5 font-semibold">{service.name}</h3>
      </div>
      <Badge className="shrink-0 tabular-nums" size="sm" variant="secondary">{t("bookingForm.duration", { minutes: service.durationMinutes })}</Badge>
    </div>
    {children}
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <p className="flex items-center gap-1.5"><Icon aria-hidden={true} className="shrink-0 text-muted-foreground" name="calendar" size={14} /><span>{formatDateTime(startsAt, { ...options, includeTime: false, includeYear: false, includeWeekday: true })}</span></p>
      <p className="flex items-center gap-1.5"><Icon aria-hidden={true} className="shrink-0 text-muted-foreground" name="clock" size={14} /><span className="font-medium tabular-nums">{formatDateTime(startsAt, { ...options, includeDate: false })} – {formatDateTime(endsAt, { ...options, includeDate: false })}</span></p>
    </div>
    {member || customer ? <div className="grid min-w-0 gap-2 border-t pt-2">
      {member ? <div className="flex min-w-0 items-center gap-2">
        <UserAvatar className="size-5 shrink-0 text-[9px]" decorative={true} name={member.name} src={member.image} stableId={member.id} />
        <span className="truncate text-xs text-muted-foreground">{member.name}</span>
      </div> : null}
      {customer ? <div className="grid min-w-0 gap-1" data-slot="calendar-booking-customer">
        <p className="flex min-w-0 items-baseline gap-2 text-xs"><span className="shrink-0 text-muted-foreground">{t("bookingForm.customerLabel")}</span><span className="truncate font-medium">{[customer.firstName, customer.lastName].filter(Boolean).join(" ")}</span></p>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {customer.email ? <p className="flex min-w-0 items-center gap-1.5"><Icon aria-hidden={true} className="shrink-0" name="mail" size={14} /><span className="truncate">{customer.email}</span></p> : null}
          {customer.phone ? <p className="flex items-center gap-1.5"><Icon aria-hidden={true} className="shrink-0" name="phone" size={14} /><span className="tabular-nums">{customer.phone}</span></p> : null}
        </div>
      </div> : null}
    </div> : null}
  </Card>
}
