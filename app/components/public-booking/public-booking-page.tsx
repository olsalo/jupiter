import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useRef, useState } from "react"
import { useNavigate, useNavigation } from "react-router"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { AppLogo } from "~/components/navigation/app-logo"
import { LanguageSwitch } from "~/components/settings/preferences/language-switch"
import { UserAvatar } from "~/components/data-display/user-avatar"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Spinner } from "~/components/ui/spinner"
import { FormatPreferenceSwitch } from "~/components/settings/preferences/format-preference-switch"
import { useFormatPreference } from "~/lib/hooks/use-format-preference"
import { useTRPC } from "~/lib/trpc/client"
import { toast } from "~/lib/toast"
import { cn } from "~/lib/utils"
import { bookingPageColorStyle } from "~/lib/booking/booking-page-colors"
import type { FormatPreference } from "~/lib/localization/format-preference"
import { BookingDetailsForm, type BookingDraft } from "./booking-details-form"
import { useBookingNavigation } from "./use-booking-navigation"
import { BookingReview } from "./booking-review"
import { BookingServiceSelection } from "./booking-service-selection"
import { BookingSummary } from "./booking-summary"
import { BookingTimeSelection } from "./booking-time-selection"
import { PublicBookingLoading, PublicBookingUnavailable } from "./public-booking-state"
import type {
  BookingDetails,
  BookingPageData,
  BookingScope,
  BookingScreen,
} from "./booking-types"

export function PublicBookingPage(scope: BookingScope) {
  const { t } = useTranslation("booking")
  const trpc = useTRPC()
  const formatPreference = useFormatPreference()
  const page = useQuery(
    trpc.booking.getPage.queryOptions(scope, { retry: false, retryOnMount: false }),
  )
  const data = page.data

  return (
    <div className="flex h-dvh pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom,0px)] text-foreground" style={bookingPageColorStyle(data?.page?.accentColor)}>
      <title>
        {data
          ? `${data.page?.title ?? t("title")} · ${data.organization.name}`
          : t("title")}
      </title>
      <header className="shrink-0 pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:h-14 sm:px-6 lg:h-20 lg:w-[calc(100%_-_3rem)] lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            {data ? (
              <UserAvatar
                className="size-8 shrink-0 rounded-lg bg-primary text-xs text-primary-foreground"
                fallbackClassName="bg-primary text-primary-foreground"
                decorative={true}
                name={data.organization.name}
                src={data.organization.logo}
                stableId={data.organization.slug}
              />
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground md:size-9">
                <AppLogo aria-hidden={true} className="size-5 md:size-6" />
              </div>
            )}
            <span className="truncate text-sm font-medium">
              {data?.organization.name}
            </span>
            <span
              className="hidden size-4 shrink-0 items-center justify-center sm:flex"
              aria-hidden={!page.isRefetching}
            >
              <Spinner
                aria-label={t("loading")}
                className={cn("size-3.5", !page.isRefetching && "invisible")}
              />
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <FormatPreferenceSwitch
              onValueChange={formatPreference.set}
              value={formatPreference.value}
            />
            <LanguageSwitch />
          </div>
        </div>
      </header>
      {data ? (
        <>
          {page.isError ? (
            <div className="mx-auto w-full max-w-5xl px-4 pb-3 lg:px-0">
              <Alert className="border-0" variant="warning">
                <AlertTitle>{t("refreshError")}</AlertTitle>
                <AlertDescription>{t("refreshHint")}</AlertDescription>
              </Alert>
            </div>
          ) : null}
          {data.services.length > 0 ? (
            <BookingFlow
              data={data}
              formatPreference={formatPreference.value}
              scope={scope}
            />
          ) : (
            <main className="mx-auto w-full max-w-5xl p-4 sm:p-6">
              <Alert className="border-0" variant="info">
                <AlertTitle>{t("noServices")}</AlertTitle>
                <AlertDescription>{t("noServicesHint")}</AlertDescription>
              </Alert>
            </main>
          )}
        </>
      ) : (
        <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 items-center justify-center p-4 sm:p-6">
          {page.isPending ? (
            <PublicBookingLoading label={t("bookingLoading")} />
          ) : (
            <PublicBookingUnavailable
              notFound={page.error?.data?.code === "NOT_FOUND"}
              onRetry={() => void page.refetch()}
              retrying={page.isFetching}
              title={t(page.error?.data?.code === "NOT_FOUND" ? "bookingPageNotFound" : "unavailable")}
            />
          )}
        </main>
      )}
    </div>
  )
}

function BookingFlow({
  data,
  scope,
  formatPreference,
}: {
  data: BookingPageData
  scope: BookingScope
  formatPreference: FormatPreference
}) {
  const { t } = useTranslation("booking")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const [ready, setReady] = useState(false)
  const [savedDetails, setDetails] = useState<{ serviceId: string; values: BookingDetails } | null>(null)
  const draft = useRef<BookingDraft | null>(null)
  const [conflict, setConflict] = useState(false)
  const scroll = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const create = useMutation(trpc.booking.create.mutationOptions())
  const bookingNavigation = useBookingNavigation(data, savedDetails?.serviceId)
  const { serviceId, service, screen, slot, locationChoice, staffChoice, setSlot, setLocationChoice, setStaffChoice } = bookingNavigation
  const details = savedDetails?.serviceId === serviceId ? savedDetails.values : null
  const stage =
    screen === "service" || screen === "time" ? 0 : screen === "details" ? 1 : 2
  const requiresConfirmation =
    service?.requiresConfirmation === true ||
    !data.settings.autoConfirmAppointments
  const saveDraft = useCallback((value: BookingDraft) => {
    draft.current = value
  }, [])

  function goTo(next: BookingScreen) {
    bookingNavigation.goTo(next)
    scroll.current?.scrollTo({ top: 0 })
    requestAnimationFrame(() => heading.current?.focus())
  }

  function selectService(id: string) {
    if (id !== serviceId) {
      setDetails(null)
      draft.current = null
      setReady(false)
    }
    setConflict(false)
    bookingNavigation.selectService(id)
    scroll.current?.scrollTo({ top: 0 })
    requestAnimationFrame(() => heading.current?.focus())
  }

  async function confirm() {
    if (!service || !slot || !details || !ready || create.isPending) return
    try {
      const saved = await create.mutateAsync({
        ...scope,
        serviceId,
        startsAt: new Date(slot.startsAt),
        staffMemberId:
          data.page?.allowStaffSelection === false
            ? undefined
            : slot.staffMemberId,
        locationId:
          data.page?.allowLocationSelection === false
            ? undefined
            : (slot.locationId ?? undefined),
        ...details,
      })
      queryClient.setQueryData(trpc.booking.getByCode.queryKey({ bookingCode: saved.bookingCode }), saved)
      toast.success(t(saved.status === "PENDING" ? "pending" : "success"))
      await navigate(`/booking/${encodeURIComponent(saved.bookingCode)}`, { replace: true, state: { confirmationMessage: data.page?.successMessage ?? null } })
    } catch (error) {
      const code =
        error && typeof error === "object" && "data" in error
          ? (error.data as { code?: string; appCode?: string } | undefined)
          : undefined
      if (code?.appCode === "SLOT_UNAVAILABLE" || code?.code === "CONFLICT") {
        setConflict(true)
        setSlot(null)
        setReady(false)
        await queryClient.invalidateQueries(
          trpc.booking.getAvailableSlots.pathFilter(),
        )
        goTo("time")
      } else toast.error(t("error"), t("errorHint"))
    }
  }

  const back =
    screen === "review"
      ? "details"
      : screen === "details"
        ? "time"
        : data.services.length > 1 && screen === "time"
          ? "service"
          : null
  const title =
    screen === "service"
      ? t("chooseService")
      : screen === "time"
        ? t("chooseTime")
        : screen === "details"
          ? t("details")
          : t("review")

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="shrink-0">
        <div className="mx-auto flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:h-14 lg:w-[calc(100%_-_3rem)] lg:max-w-5xl lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            {back ? (
              <Button
                aria-label={t("back")}
                className="max-sm:size-11 sm:-ml-2 lg:hidden"
                disabled={create.isPending}
                onClick={() => goTo(back)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Icon aria-hidden={true} name="arrowLeft" />
              </Button>
            ) : null}
            <h1
              className="text-lg font-medium outline-none sm:text-xl"
              ref={heading}
              tabIndex={-1}
            >
              {title}
            </h1>
          </div>
          <p className="shrink-0 text-xs text-muted-foreground sm:hidden">
            {t("step", { current: stage + 1, total: 3 })}
          </p>
          <nav
            aria-label={t("title")}
            className="hidden items-center gap-1 sm:flex"
          >
            {(["appointment", "details", "reviewStep"] as const).map(
              (label, index) => (
                <div className="flex items-center gap-1" key={label}>
                  {index > 0 ? (
                    <Icon
                      aria-hidden={true}
                      className="size-3 text-muted-foreground"
                      name="chevronRight"
                    />
                  ) : null}
                  <Button
                    aria-current={stage === index ? "step" : undefined}
                    className={cn(
                      "text-xs",
                      stage !== index && "font-normal text-muted-foreground",
                    )}
                    disabled={index > stage || create.isPending}
                    onClick={() =>
                      goTo(
                        index === 0
                          ? service
                            ? "time"
                            : "service"
                          : index === 1
                            ? "details"
                            : "review",
                      )
                    }
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {t(label)}
                  </Button>
                </div>
              ),
            )}
          </nav>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ScrollArea
              className="h-auto min-h-0 flex-1"
              scrollbarClassName="max-lg:hidden"
              scrollFade={true}
              viewportProps={{ ref: scroll }}
            >
              <div className="min-w-0 space-y-5 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-5 lg:mx-auto lg:w-[calc(100%_-_3rem)] lg:max-w-5xl lg:pt-4 lg:pb-8 lg:pr-[344px] lg:pl-8">
                {(screen === "service" || (screen === "time" && data.services.length === 1)) && data.page?.description ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {data.page.description}
                  </p>
                ) : null}
                {screen === "service" ? (
                  <BookingServiceSelection
                    formatPreference={formatPreference}
                    onSelect={selectService}
                    selectedServiceId={serviceId}
                    services={data.services}
                  />
                ) : null}
                {service ? (
                  <div className="space-y-5" hidden={screen !== "time"}>
                    {conflict ? (
                      <Alert className="border-0" variant="warning">
                        <AlertTitle>{t("conflict")}</AlertTitle>
                        <AlertDescription>{t("conflictHint")}</AlertDescription>
                      </Alert>
                    ) : null}
                    <BookingTimeSelection
                      data={data}
                      formatPreference={formatPreference}
                      key={serviceId}
                      locationChoice={locationChoice}
                      onLocationChange={(id) => {
                        setLocationChoice(id)
                        setReady(false)
                      }}
                      onReadyChange={setReady}
                      onSelect={setSlot}
                      onStaffChange={(id) => {
                        setStaffChoice(id)
                        setReady(false)
                      }}
                      scope={scope}
                      service={service}
                      slot={slot}
                      staffChoice={staffChoice}
                    />
                  </div>
                ) : null}
                {screen === "details" && service ? (
                  <BookingDetailsForm
                    data={data}
                    defaultValues={draft.current}
                    onDraftChange={saveDraft}
                    serviceId={serviceId}
                    submit={(values) => {
                      setDetails({ serviceId, values })
                      goTo("review")
                    }}
                  />
                ) : null}
                {screen === "review" && service && slot && details ? (
                  <BookingReview
                    data={data}
                    details={details}
                    formatPreference={formatPreference}
                    onEdit={() => goTo("details")}
                    onChange={goTo}
                    service={service}
                    slot={slot}
                  />
                ) : null}
              </div>
            </ScrollArea>
          </main>
        </div>
        <div className="pointer-events-none absolute inset-0 mx-auto hidden lg:block lg:w-[calc(100%_-_3rem)] lg:max-w-5xl">
          <aside
            aria-label={t("summary")}
            className="pointer-events-auto absolute top-4 right-8 hidden w-[280px] min-h-0 rounded-xl border border-border/50 bg-muted/30 lg:block"
          >
            <ScrollArea
              className="h-auto"
              scrollbarClassName="max-lg:hidden"
              scrollFade={true}
              viewportProps={{ className: "max-h-[calc(100dvh-18rem)]" }}
            >
              <div className="p-5">
                <BookingSummary
                  data={data}
                  formatPreference={formatPreference}
                  onChange={goTo}
                  service={service}
                  slot={slot}
                />
              </div>
            </ScrollArea>
          </aside>
        </div>
      </div>
      <footer
        className={cn(
          "sticky bottom-0 z-20 shrink-0 border-t border-border/50 bg-background pb-4 lg:h-20 lg:border-t-0 lg:py-0",
          screen === "service" && !service && "hidden",
        )}
      >
        {service ? (
          <div className="lg:hidden">
            <BookingSummary
              compact={true}
              data={data}
              formatPreference={formatPreference}
              onChange={goTo}
              service={service}
              slot={slot}
            />
          </div>
        ) : null}
        <div className="mx-auto flex h-auto flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:gap-3 sm:px-6 sm:pt-4 lg:h-full lg:w-[calc(100%_-_3rem)] lg:max-w-5xl lg:px-8 lg:pt-0">
          <Button
            className={cn("hidden h-12 px-4 sm:h-12 lg:inline-flex", !back && "invisible")}
            disabled={!back || create.isPending}
            onClick={() => {
              if (back) goTo(back)
            }}
            type="button"
            variant="ghost"
          >
            <Icon aria-hidden={true} name="arrowLeft" />
            {t("back")}
          </Button>
          {screen === "details" ? (
            <Button
              className="h-12 w-full gap-2.5 px-6 text-base sm:ml-auto sm:h-12 sm:w-auto sm:min-w-44 sm:text-base"
              form="public-booking-details"
              key="details"
              type="submit"
            >
              {t("continue")}
              <Icon aria-hidden={true} name="arrowRight" />
            </Button>
          ) : (
            <Button
              className="h-12 w-full gap-2.5 px-6 text-base sm:ml-auto sm:h-12 sm:w-auto sm:min-w-44 sm:text-base"
              disabled={
                screen === "service"
                  ? !service
                  : screen === "time"
                    ? !ready
                    : !ready || create.isPending || navigation.state !== "idle"
              }
              key={screen}
              loading={create.isPending || navigation.state !== "idle"}
              onClick={() =>
                screen === "service"
                  ? goTo("time")
                  : screen === "time"
                    ? goTo("details")
                    : void confirm()
              }
              type="button"
            >
              {screen === "review" ? (
                <Icon
                  aria-hidden={true}
                  className="size-5"
                  name={requiresConfirmation ? "send" : "check"}
                />
              ) : null}
              {t(
                screen === "review"
                  ? requiresConfirmation
                    ? "request"
                    : "confirm"
                  : "continue",
              )}
              {screen !== "review" ? (
                <Icon aria-hidden={true} name="arrowRight" />
              ) : null}
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}
