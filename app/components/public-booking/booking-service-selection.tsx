import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyContent,
} from "~/components/ui/empty"
import { formatNumber, type FormatPreference } from "~/lib/localization/format-preference"
import type { BookingPageData } from "./booking-types"

export function BookingServiceSelection({
  services,
  onSelect,
  formatPreference,
  selectedServiceId,
}: {
  services: BookingPageData["services"]
  formatPreference: FormatPreference
  selectedServiceId: string
  onSelect: (id: string) => void
}) {
  const { t, i18n } = useTranslation("booking")
  const [search, setSearch] = useState("")
  const headingId = useId()
  const query = search.trim().toLocaleLowerCase()
  const filtered = services.filter((service) =>
    [service.name, service.description, service.category?.name]
      .some((value) => value?.toLocaleLowerCase().includes(query)),
  )
  const categories = [...new Map(
    services.flatMap((service) => service.category
      ? [[service.category.id, service.category] as const]
      : []),
  ).values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, i18n.language))
  const groups = [
    ...categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      services: filtered.filter((service) => service.category?.id === category.id),
    })),
    {
      id: "uncategorized",
      name: categories.length > 0 ? t("otherServices") : null,
      description: null,
      services: filtered.filter((service) => !service.category),
    },
  ].filter((group) => group.services.length > 0)

  return (
    <div className="space-y-6">
      {services.length > 6 ? (
        <InputGroup>
          <InputGroupInput
            aria-label={t("search")}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("search")}
            type="search"
            value={search}
          />
          <InputGroupAddon>
            <Icon aria-hidden={true} name="search" />
          </InputGroupAddon>
        </InputGroup>
      ) : null}
      <div className="space-y-7">
        {groups.map((group) => (
          <section
            aria-labelledby={group.name ? `${headingId}-${group.id}` : undefined}
            key={group.id}
          >
            {group.name ? (
              <div className="mb-3 space-y-1">
                <h2
                  className="text-sm font-medium wrap-anywhere"
                  id={`${headingId}-${group.id}`}
                >
                  {group.name}
                </h2>
                {group.description ? (
                  <p className="text-xs leading-5 wrap-anywhere text-muted-foreground">
                    {group.description}
                  </p>
                ) : null}
              </div>
            ) : null}
            <ul className="space-y-2">
              {group.services.map((service) => (
                <li key={service.id}>
                  <Button
                    aria-pressed={service.id === selectedServiceId}
                    className={cn(
                      "group h-auto min-h-18 w-full justify-start gap-3 rounded-xl border-border/40 px-4 py-3.5 text-left whitespace-normal hover:border-border/70 hover:bg-muted/40 sm:h-auto",
                      service.id === selectedServiceId && "bg-muted/50 hover:bg-muted/60",
                    )}
                    onClick={() => onSelect(service.id)}
                    type="button"
                    variant="ghost"
                  >
                    <span className="min-w-0 flex-1 space-y-1.5">
                      <span className="block text-sm leading-5 font-medium wrap-anywhere">
                        {service.name}
                      </span>
                      {service.description ? (
                        <span className="block line-clamp-2 text-xs leading-5 font-normal wrap-anywhere text-muted-foreground">
                          {service.description}
                        </span>
                      ) : null}
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-normal text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          <Icon aria-hidden={true} className="size-3.5" name="clock" />
                          {t("duration", { minutes: service.durationMinutes })}
                        </span>
                        {service.price !== null ? (
                          <span className="inline-flex items-center gap-3 whitespace-nowrap tabular-nums">
                            <span aria-hidden={true} className="text-muted-foreground/50">·</span>
                            {formatNumber(Number(service.price), formatPreference, {
                              style: "currency",
                              currency: service.currency,
                            })}
                          </span>
                        ) : null}
                        {service.deliveryType === "ONLINE" || service.deliveryType === "PHONE" ? (
                          <span>
                            {t(service.deliveryType === "ONLINE" ? "online" : "telephone")}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <Icon
                      aria-hidden={true}
                      className={cn(
                        "size-4 shrink-0",
                        service.id === selectedServiceId
                          ? "text-foreground"
                          : "text-muted-foreground transition-transform group-hover:translate-x-0.5",
                      )}
                      name={service.id === selectedServiceId ? "check" : "chevronRight"}
                    />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {!filtered.length ? (
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyTitle className="text-sm">{t("noResults")}</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button
              onClick={() => setSearch("")}
              type="button"
              variant="secondary"
            >
              {t("clearSearch")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : null}
    </div>
  )
}
