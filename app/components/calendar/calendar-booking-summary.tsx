import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Badge } from "~/components/ui/badge"
import { Card } from "~/components/ui/card"
import { UserAvatar } from "~/components/user-avatar"
import { formatDateTime, type FormatPreference } from "~/lib/format-preference"

export function CalendarBookingSummary({ service, startsAt, endsAt, member, timeZone, formatPreference }: {
  service: { name: string; durationMinutes: number; color?: string | null }
  startsAt: string
  endsAt: string
  member?: { id: string; name: string; image?: string | null }
  timeZone: string
  formatPreference: FormatPreference
}) {
  const { t, i18n } = useTranslation()
  const options = { formatPreference, timeZone, language: i18n.resolvedLanguage === "fi" ? "fi" as const : "en" as const }

  return <Card className="gap-4 rounded-xl bg-muted/15 p-4 shadow-none before:hidden" render={<section aria-label={t("bookingForm.summary")} />}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <span aria-hidden={true} className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: service.color ?? "var(--primary)" }} />
        <h3 className="min-w-0 text-sm leading-5 font-semibold">{service.name}</h3>
      </div>
      <Badge className="shrink-0 tabular-nums" size="sm" variant="secondary">{t("bookingForm.duration", { minutes: service.durationMinutes })}</Badge>
    </div>
    <div className="grid gap-2 text-sm">
      <p className="flex items-center gap-2.5"><Icon aria-hidden={true} className="shrink-0 text-muted-foreground" name="calendar" size={16} /><span>{formatDateTime(startsAt, { ...options, includeTime: false, includeYear: false, includeWeekday: true })}</span></p>
      <p className="flex items-center gap-2.5"><Icon aria-hidden={true} className="shrink-0 text-muted-foreground" name="clock" size={16} /><span className="font-medium tabular-nums">{formatDateTime(startsAt, { ...options, includeDate: false })} – {formatDateTime(endsAt, { ...options, includeDate: false })}</span></p>
    </div>
    {member ? <div className="flex items-center gap-2.5 border-t pt-3">
      <UserAvatar className="size-6 text-[10px]" decorative={true} name={member.name} src={member.image} stableId={member.id} />
      <span className="truncate text-sm text-muted-foreground">{member.name}</span>
    </div> : null}
  </Card>
}
