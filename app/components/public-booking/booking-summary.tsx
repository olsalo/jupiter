import { useTranslation } from "react-i18next"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { UserAvatar } from "~/components/user-avatar"
import { formatDateTime, formatNumber, type FormatPreference } from "~/lib/format-preference"
import type {
  BookingPageData,
  BookingScreen,
  BookingService,
  BookingSlot,
} from "./booking-types"

export function BookingSummary({
  data,
  service,
  slot,
  formatPreference,
  onChange,
  compact = false,
}: {
  data: BookingPageData
  service?: BookingService
  slot: BookingSlot | null
  formatPreference: FormatPreference
  onChange: (screen: BookingScreen) => void
  compact?: boolean
}) {
  const { t, i18n } = useTranslation("booking")
  const options = {
    formatPreference,
    language:
      i18n.resolvedLanguage === "fi" ? ("fi" as const) : ("en" as const),
    timeZone: data.settings.timezone,
  }
  const person =
    data.page?.allowStaffSelection === false
      ? undefined
      : data.staff.find((member) => member.id === slot?.staffMemberId)
  const location = data.locations.find((place) => place.id === slot?.locationId)
  const delivery =
    service?.deliveryType === "ONLINE"
      ? t("online")
      : service?.deliveryType === "PHONE"
        ? t("telephone")
        : null
  const startTime = slot
    ? formatDateTime(slot.startsAt, { ...options, includeDate: false })
    : ""
  const endTime = slot
    ? formatDateTime(slot.endsAt, { ...options, includeDate: false })
    : ""

  const price = service?.price != null
    ? formatNumber(Number(service.price), formatPreference, {
        style: "currency",
        currency: service.currency,
      })
    : null

  if (compact && service)
    return (
      <div
        className="flex flex-col gap-1 px-4 pt-4 sm:px-6 sm:pt-4"
        data-slot="public-booking-summary"
      >
        <div className="flex items-baseline justify-between gap-4">
          <p className="min-w-0 text-sm leading-5 font-medium wrap-anywhere">
            {service.name}
          </p>
        </div>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs leading-5 tabular-nums text-muted-foreground">
          <span className="whitespace-nowrap">{t("duration", { minutes: service.durationMinutes })}{price !== null ? ` · ${price}` : ""}</span>
          {slot ? (
            <>
              <span aria-hidden={true}>·</span>
              <span>
                {formatDateTime(slot.startsAt, {
                  ...options,
                  includeTime: false,
                  includeYear: false,
                })}
              </span>
              <span className="whitespace-nowrap">{startTime} – {endTime}</span>
            </>
          ) : null}
        </p>
        {person || location || delivery ? (
          <p className="text-xs leading-5 wrap-anywhere text-muted-foreground">
            {[person?.name, location?.name ?? delivery]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </div>
    )

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-medium">{t("summary")}</h2>
      <div className="space-y-5 text-sm">
        <div className="space-y-1.5">
          <div className="flex min-h-6 items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{t("service")}</p>
            {service && data.services.length > 1 ? (
              <Button
                aria-label={`${t("change")} ${t("service").toLocaleLowerCase()}`}
                className="-mr-2"
                onClick={() => onChange("service")}
                size="xs"
                type="button"
                variant="ghost"
              >
                {t("change")}
              </Button>
            ) : null}
          </div>
          <p
            className={service ? "font-medium wrap-anywhere" : "text-muted-foreground"}
          >
            {service?.name ?? t("notSelected")}
          </p>
          {service ? (
            <p className="text-xs tabular-nums text-muted-foreground">
              {t("duration", { minutes: service.durationMinutes })}{price !== null ? ` · ${price}` : ""}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5 border-t border-border/50 pt-4">
          <div className="flex min-h-6 items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{t("date")}</p>
            {slot ? (
              <Button
                aria-label={`${t("change")} ${t("date").toLocaleLowerCase()}`}
                className="-mr-2"
                onClick={() => onChange("time")}
                size="xs"
                type="button"
                variant="ghost"
              >
                {t("change")}
              </Button>
            ) : null}
          </div>
          {slot ? (
            <>
              <p className="wrap-anywhere">
                {formatDateTime(slot.startsAt, {
                  ...options,
                  includeTime: false,
                  includeYear: false,
                  includeWeekday: true,
                })}
              </p>
              <p className="font-medium tabular-nums">{startTime} – {endTime}</p>
            </>
          ) : (
            <p className="text-muted-foreground">{t("notSelected")}</p>
          )}
        </div>
        {person || location || delivery ? (
          <div className="space-y-4 border-t border-border/50 pt-4">
            {person ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("staff")}</p>
                <div className="flex items-center gap-2">
                  <UserAvatar
                    className="size-5 text-[9px]"
                    decorative={true}
                    name={person.name}
                    src={person.image}
                    stableId={person.id}
                  />
                  <span className="min-w-0 wrap-anywhere">{person.name}</span>
                </div>
              </div>
            ) : null}
            {location ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("location")}</p>
                <div className="flex items-start gap-2">
                  <Icon
                    aria-hidden={true}
                    className="size-4 shrink-0 text-muted-foreground"
                    name="buildingStore"
                  />
                  <div className="min-w-0">
                    <p className="wrap-anywhere">{location.name}</p>
                    <p className="mt-1 text-xs leading-5 wrap-anywhere text-muted-foreground">
                      {[location.addressLine1, location.city]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            ) : delivery ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon
                  aria-hidden={true}
                  className="size-4"
                  name={service?.deliveryType === "ONLINE" ? "plug" : "phone"}
                />
                {delivery}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
