import { PlanUsage } from "~/components/billing/plan-usage"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { FormApi } from "@rvf/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ComponentProps, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useRevalidator } from "react-router"

import { RouteInformationArchitecture } from "~/components/information-architecture/route-information-architecture"
import { CommunicationsSettings, communicationsSettingsFormId } from "~/components/settings/communications-settings"
import { getSettingsItemIdFromHash, getVisibleSettingsItems, isSettingsHash, type SettingsItemId } from "~/lib/routing/settings-navigation"
import { ProfilePreferences } from "~/components/settings/profile/profile-preferences"
import { SettingsFormFooter } from "~/components/settings/settings-form-footer"
import type { PersonFormFields } from "~/lib/schemas/team"
import { ProfileSettingsHeader } from "~/components/settings/profile/profile-settings-header"
import { BookingSettings, bookingSettingsFormId } from "~/components/settings/business/booking-settings"
import { BusinessLocationSettings, businessLocationFormId } from "~/components/settings/business/business-location-settings"
import { BusinessScheduleSettings, businessScheduleFormId } from "~/components/settings/business/business-schedule-settings"
import { BusinessSettingsHeader } from "~/components/settings/business/business-settings-header"
import { TeamPersonForm, type SettingsPersonFormState } from "~/components/team/team-person-form"
import { AppForm, type AppFormState } from "~/components/forms/app-form"
import Icon from "~/components/icons"
import FormLabel from "~/components/forms/form-label"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "~/components/ui/card"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer"
import { Input } from "~/components/ui/input"
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "~/components/ui/menu"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import { Radio, RadioGroup } from "~/components/ui/radio-group"
import { Spinner } from "~/components/ui/spinner"
import { Tabs, TabsPanel } from "~/components/ui/tabs"
import {
  Tooltip,
  TooltipPopup,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"
import { authClient } from "~/lib/auth/client"
import { onboardingCountries } from "~/lib/localization/countries"
import { currencyItems } from "~/lib/localization/currencies"
import { formatDateTime } from "~/lib/localization/format-preference"
import { useMediaQuery } from "~/lib/hooks"
import {
  organizationSettingsFormSchema,
  type OrganizationSettingsFormInput,
} from "~/lib/schemas/organization"
import { timezoneItems } from "~/lib/localization/timezones"
import { useTRPC } from "~/lib/trpc/client"
import { toast } from "~/lib/toast"
import { hasOrganizationPermission, isBookableStaff } from "~/lib/auth/permissions"
import { useCurrentOrganizationRole } from "~/lib/hooks/use-organization-access"
import { useAppContext } from "~/lib/hooks/use-app-context"

type GeneralFormState = AppFormState

const generalFormId = "organization-general-form"
const profileFormId = "profile-form"
const settingsHashChangeEvent = "settings-hash-change"

function updateSettingsHash(itemId: SettingsItemId) {
  const url = new URL(window.location.href)
  url.hash = `settings/${itemId}`
  window.history.replaceState(window.history.state, "", url)
  window.dispatchEvent(new Event(settingsHashChangeEvent))
}

function clearSettingsHash() {
  if (!isSettingsHash(window.location.hash)) {
    return
  }

  const url = new URL(window.location.href)
  url.hash = ""
  window.history.replaceState(window.history.state, "", url)
}

export function SettingsModal({
  hashOwner = false,
  showTooltip = false,
  triggerSize = "icon-lg",
}: {
  hashOwner?: boolean
  showTooltip?: boolean
  triggerSize?: ComponentProps<typeof Button>["size"]
}) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery("max-640px")
  const rootData = useAppContext()
  const organizationRole = useCurrentOrganizationRole()
  const visibleSettingsItems = getVisibleSettingsItems(organizationRole)
  const [open, setOpen] = useState(false)
  const [selectedItemId, setActiveItemId] = useState<SettingsItemId>("profile")
  const activeItemId = visibleSettingsItems.find((item) => item.id === selectedItemId)?.id ?? "profile"
  const [bookingFormState, setBookingFormState] = useState<AppFormState>({ isDirty: false, isSubmitting: false })
  const [communicationsFormState, setCommunicationsFormState] = useState<AppFormState>({ isDirty: false, isSubmitting: false })
  const communicationsResetRef = useRef<(() => void) | null>(null)
  const bookingResetRef = useRef<(() => void) | null>(null)
  const [businessTab, setBusinessTab] = useState("general")
  const [businessScheduleState, setBusinessScheduleState] = useState<AppFormState>({ isDirty: false, isSubmitting: false })
  const [businessLocationState, setBusinessLocationState] = useState<AppFormState>({ isDirty: false, isSubmitting: false })
  const businessLocationReset = useRef<(() => void) | null>(null)
  const businessScheduleReset = useRef<(() => void) | null>(null)
  const [profileTab, setProfileTab] = useState("general")
  const [teamPending, setTeamPending] = useState(false)
  const trpc = useTRPC()
  const profilePerson = useQuery({ ...trpc.profile.getTeamProfile.queryOptions(), enabled: open && activeItemId === "profile" })
  useEffect(() => {
    if (open && profilePerson.data && !isBookableStaff(profilePerson.data.staff) && ["availability", "breaks", "time-off"].includes(profileTab)) {
      setProfileTab("general")
    }
  }, [open, profilePerson.data, profileTab])
  const { t: tTeam } = useTranslation("team")
  const [isBillingLoading, setIsBillingLoading] = useState(false)
  const [isGeneralLoading, setIsGeneralLoading] = useState(false)
  const [generalFormState, setGeneralFormState] = useState<GeneralFormState>({
    isDirty: false,
    isSubmitting: false,
  })
  const [profileFormState, setProfileFormState] = useState<SettingsPersonFormState>({
    isDirty: false,
    isSubmitting: false,
    canSubmit: false,
  })
  const [settingsNavOverflow, setSettingsNavOverflow] = useState({
    left: false,
    right: false,
  })
  const settingsNavRef = useRef<HTMLElement>(null)
  const generalFormApi = useRef<FormApi<OrganizationSettingsFormInput>>(null)
  const profileResetRef = useRef<(() => void) | null>(null)
  const profileFormApi = useRef<FormApi<PersonFormFields>>(null)
  const businessFormState = businessTab === "general" ? generalFormState : businessTab === "location" ? businessLocationState : businessScheduleState
  const activeBusinessFormId = businessTab === "general" ? generalFormId : businessTab === "location" ? businessLocationFormId : businessScheduleFormId
  const activeItem = visibleSettingsItems.find((item) => item.id === activeItemId) ?? visibleSettingsItems[0]!
  const Root = isMobile ? Drawer : Dialog
  const Trigger = isMobile ? DrawerTrigger : DialogTrigger
  const Header = isMobile ? DrawerHeader : DialogHeader
  const Title = isMobile ? DrawerTitle : DialogTitle
  const Description = isMobile ? DrawerDescription : DialogDescription
  const Footer = isMobile ? DrawerFooter : DialogFooter
  const viewLoading = (activeItemId === "billing" && isBillingLoading) || (activeItemId === "business" && isGeneralLoading) || (activeItemId === "profile" && profilePerson.isPending)

  // Closing the overlay must not rebuild the profile and its mounted schedule fields.
  const profileForm = useMemo(() => profilePerson.data ? (
    <TeamPersonForm key={profilePerson.data.member?.id ?? profilePerson.data.id} person={profilePerson.data} selfSettings={true} settingsTab={profileTab} onSettingsTabChange={setProfileTab} settingsFormApi={profileFormApi} settingsResetRef={profileResetRef} settingsFormId={profileFormId} onSettingsFormStateChange={setProfileFormState} generalContent={<ProfilePreferences />} close={() => {}} onPendingChange={setTeamPending} />
  ) : null, [profilePerson.data, profileTab])

  // Keep section content stable while the overlay changes its open state.
  const settingsContent = useMemo(() => {
    if (activeItemId === "business") return (
      <>
        <TabsPanel className="m-0" keepMounted={true} value="general">
          <GeneralSettingsContent formApi={generalFormApi} onLoadingChange={setIsGeneralLoading} onFormStateChange={setGeneralFormState} />
        </TabsPanel>
        <TabsPanel className="m-0" keepMounted={true} value="location">
          <BusinessLocationSettings onFormStateChange={setBusinessLocationState} resetRef={businessLocationReset} />
        </TabsPanel>
        <div className={businessTab === "general" || businessTab === "location" ? "hidden" : "flex flex-1 flex-col"}>
          <BusinessScheduleSettings onTabChange={setBusinessTab} onFormStateChange={setBusinessScheduleState} resetRef={businessScheduleReset} />
        </div>
      </>
    )
    if (activeItemId === "booking") return <BookingSettings onFormStateChange={setBookingFormState} resetRef={bookingResetRef} />
    if (activeItemId === "billing") return <BillingSettingsContent onLoadingChange={setIsBillingLoading} />
    if (activeItemId === "communications") return <CommunicationsSettings onFormStateChange={setCommunicationsFormState} resetRef={communicationsResetRef} />
    if (activeItemId === "profile") return null
    return <div className="@container min-w-0"><RouteInformationArchitecture section={activeItemId} icon={activeItem.icon} /></div>
  }, [activeItemId, activeItem.icon, businessTab])

  const updateSettingsNavOverflow = useCallback(() => {
    const nav = settingsNavRef.current

    if (!nav) {
      return
    }

    const maxScrollLeft = nav.scrollWidth - nav.clientWidth

    setSettingsNavOverflow({
      left: nav.scrollLeft > 1,
      right: maxScrollLeft - nav.scrollLeft > 1,
    })
  }, [])
  const settingsNavMask = `linear-gradient(to right, ${
    settingsNavOverflow.left ? "transparent 0, black 1.5rem" : "black 0"
  }, ${
    settingsNavOverflow.right
      ? "black calc(100% - 1.5rem), transparent 100%"
      : "black 100%"
  })`

  useEffect(() => {
    const nav = settingsNavRef.current

    if (!nav) {
      return
    }

    const resizeObserver = new ResizeObserver(updateSettingsNavOverflow)
    resizeObserver.observe(nav)
    Array.from(nav.children).forEach((child) => resizeObserver.observe(child))
    updateSettingsNavOverflow()

    return () => resizeObserver.disconnect()
  }, [organizationRole, open, updateSettingsNavOverflow])

  useEffect(() => {
    if (!hashOwner) {
      setOpen(false)
      return
    }

    const syncWithHash = () => {
      const itemId = getSettingsItemIdFromHash(
        window.location.hash,
        organizationRole,
      )

      if (!itemId) {
        setOpen(false)
        return
      }

      setActiveItemId(itemId)
      setOpen(true)
      if (window.location.hash !== `#settings/${itemId}`) updateSettingsHash(itemId)
    }

    syncWithHash()
    window.addEventListener("hashchange", syncWithHash)
    window.addEventListener(settingsHashChangeEvent, syncWithHash)

    return () => {
      window.removeEventListener("hashchange", syncWithHash)
      window.removeEventListener(settingsHashChangeEvent, syncWithHash)
    }
  }, [organizationRole, hashOwner])

  const trigger = (
    <Trigger
      aria-label={t("settings.open")}
      render={
        <Button
          className="rounded-full text-muted-foreground hover:text-sidebar-accent-foreground active:text-sidebar-accent-foreground"
          size={triggerSize}
          type="button"
          variant="ghost"
        />
      }
    >
      <Icon
        aria-hidden="true"
        className="size-5"
        name="settings"
        size={20}
      />
    </Trigger>
  )

  return (
    <Root
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          const itemId =
            getSettingsItemIdFromHash(
              window.location.hash,
              organizationRole,
            ) ?? visibleSettingsItems[0]!.id

          setActiveItemId(itemId)
          setOpen(hashOwner)
          updateSettingsHash(itemId)
          return
        }

        setOpen(false)

        if (hashOwner) {
          clearSettingsHash()
        }
      }}
      open={open}
    >
      {showTooltip ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={trigger} />
            <TooltipPopup side="right" sideOffset={8}>
              {t("settings.title")}
            </TooltipPopup>
          </Tooltip>
        </TooltipProvider>
      ) : (
        trigger
      )}

      <ResponsiveSettingsPopup isMobile={isMobile}>
        <Header className="min-h-0 gap-4 border-e border-border bg-muted/35 p-3.5 max-sm:rounded-t-2xl max-sm:border-e-0">
          <div className="space-y-1">
            <Title className="text-lg">{t("settings.title")}</Title>
            <Description className="sr-only">
              {t("settings.description")}
            </Description>
          </div>

          <div className="relative min-h-0 min-w-0 max-sm:-mx-3.5 max-sm:overflow-hidden">
            <nav
              aria-label={t("settings.title")}
              className="flex max-h-full min-w-0 flex-col gap-1 overflow-y-auto overscroll-none max-sm:flex-row max-sm:touch-auto max-sm:overflow-x-auto max-sm:overflow-y-hidden max-sm:px-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              onScroll={updateSettingsNavOverflow}
              style={{ maskImage: settingsNavMask, WebkitMaskImage: settingsNavMask }}
              onWheel={(event) => {
                const element = event.currentTarget
                const maxScrollLeft = element.scrollWidth - element.clientWidth

                if (
                  maxScrollLeft <= 0 ||
                  Math.abs(event.deltaY) <= Math.abs(event.deltaX)
                ) {
                  return
                }

                const nextScrollLeft = Math.max(
                  0,
                  Math.min(maxScrollLeft, element.scrollLeft + event.deltaY),
                )

                if (nextScrollLeft !== element.scrollLeft) {
                  event.preventDefault()
                  element.scrollLeft = nextScrollLeft
                }
              }}
              ref={settingsNavRef}
            >
              {visibleSettingsItems.map((item) => {
                const isActive = activeItemId === item.id

                return (
                  <button
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-9 w-full min-w-0 shrink-0 items-center gap-2 overflow-hidden rounded-md px-2 text-start text-sm font-medium outline-none transition-[background-color,color] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-ring max-sm:w-auto max-sm:min-w-max max-sm:px-3 motion-reduce:transition-none",
                      isActive
                        ? "bg-[color-mix(in_oklab,var(--sidebar-accent)_97.5%,black)] text-sidebar-accent-foreground before:absolute before:-left-5 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-sm before:bg-primary before:content-[''] max-sm:before:hidden"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                    key={item.id}
                    onClick={() => {
                      setActiveItemId(item.id)

                      if (hashOwner) {
                        updateSettingsHash(item.id)
                      }
                    }}
                    type="button"
                  >
                    <Icon aria-hidden="true" name={item.icon} size={20} />
                    <span className="min-w-0 truncate whitespace-nowrap">
                      {t(item.labelKey)}
                    </span>
                  </button>
                )
              })}
            </nav>
            {settingsNavOverflow.left ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-3 bg-background/10 backdrop-blur-[2px] max-sm:block"
              />
            ) : null}
            {settingsNavOverflow.right ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-3 bg-background/10 backdrop-blur-[2px] max-sm:block"
              />
            ) : null}
          </div>
        </Header>

        <Tabs className="contents" value={activeItemId === "business" ? businessTab : profileTab} onValueChange={(value) => {
          if (activeItemId === "business") { if (!businessFormState.isSubmitting) setBusinessTab(String(value)) }
          else if (!teamPending && !profileFormState.isSubmitting) setProfileTab(String(value))
        }}>
        <SettingsMainSection isMobile={isMobile}>
          <DialogPanel
            className="flex min-h-full flex-1 flex-col p-0"
            scrollbarClassName="hidden"
            stickyHeader={activeItemId === "profile" ? (
              <ProfileSettingsHeader bookable={isBookableStaff(profilePerson.data ? profilePerson.data.staff : rootData?.staffProfile)} disabled={teamPending || profileFormState.isSubmitting} person={profilePerson.data ?? (rootData?.user ? { name: rootData.user.name, image: rootData.user.image ?? null } : undefined)} />
            ) : activeItemId === "business" ? (
              <BusinessSettingsHeader disabled={businessFormState.isSubmitting} name={rootData?.org?.name} />
            ) : (
              <header className="relative px-5 py-4 max-sm:px-4">
                <div aria-hidden={true} className="pointer-events-none absolute inset-0 bg-background/85 backdrop-blur-[28px] backdrop-saturate-150" />
                <div className="relative">
                  <h2 className="text-xl font-semibold tracking-tight sm:pe-11">{t(activeItem.labelKey)}</h2>
                  <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{t(activeItem.descriptionKey)}</p>
                </div>
              </header>
            )}
            scrollAreaClassName={cn(
              "min-h-0 flex-1 [&_[data-slot=scroll-area-content]]:flex [&_[data-slot=scroll-area-content]]:min-h-full [&_[data-slot=scroll-area-content]]:flex-col",
              activeItemId !== "billing" && activeItemId !== "profile" && activeItemId !== "business" && activeItemId !== "booking" && activeItemId !== "communications" &&
                "[&_[data-slot=scroll-area-content]]:h-full",
              isMobile && "touch-auto",
            )}
          >
            <div
              className={cn(
                "flex min-h-full flex-1 flex-col",
                activeItemId !== "billing" && activeItemId !== "profile" && activeItemId !== "business" && activeItemId !== "booking" && activeItemId !== "communications" && "h-full",
              )}
            >
              <div className={cn("relative flex min-h-[18rem] flex-1 flex-col gap-4 px-5 pb-5 max-sm:min-h-[14rem] max-sm:px-4 max-sm:pb-4", (activeItemId === "profile" || activeItemId === "business") && "pt-5 max-sm:pt-4")}>
                {activeItemId === "profile" ? (
                  profilePerson.isPending ? null : profilePerson.isError ? <Alert variant="error"><AlertTitle>{tTeam("people.loadFailed")}</AlertTitle><AlertDescription>{tTeam("retryDescription")}</AlertDescription><AlertAction><Button disabled={profilePerson.isFetching} onClick={() => void profilePerson.refetch()} size="sm" type="button" variant="outline">{tTeam("retry")}</Button></AlertAction></Alert> : (
                    profileForm
                  )
                ) : settingsContent}
                {viewLoading ? (
                  <div
                    className="absolute inset-0 z-10 flex items-center justify-center bg-background"
                  >
                    <Spinner aria-label={t("settings.loading")} className="size-6 text-muted-foreground" />
                  </div>
                ) : null}
              </div>
            </div>
          </DialogPanel>

          {!viewLoading && activeItemId === "business" && businessFormState.isDirty ? (
            <Footer className={cn("shrink-0", !isMobile && "rounded-b-2xl")}>
              <Button
                disabled={businessFormState.isSubmitting}
                onClick={() => {
                  if (businessTab === "general") generalFormApi.current?.resetForm()
                  else if (businessTab === "location") businessLocationReset.current?.()
                  else businessScheduleReset.current?.()
                }}
                type="button"
                variant="ghost"
              >
                {t("settings.cancel")}
              </Button>
              <Button
                disabled={businessFormState.isSubmitting}
                form={activeBusinessFormId}
                type="submit"
              >
                {businessFormState.isSubmitting ? (
                  <>
                    <Spinner className="size-4" />
                    {t("settings.saving")}
                  </>
                ) : (
                  t("settings.save")
                )}
              </Button>
            </Footer>
          ) : activeItemId === "communications" ? (
            <SettingsFormFooter formId={communicationsSettingsFormId} isMobile={isMobile} state={{ ...communicationsFormState, canSubmit: true }} onCancel={() => communicationsResetRef.current?.()} />
          ) : activeItemId === "booking" ? (
            <SettingsFormFooter formId={bookingSettingsFormId} isMobile={isMobile} state={{ ...bookingFormState, canSubmit: true }} onCancel={() => bookingResetRef.current?.()} />
          ) : !viewLoading && activeItemId === "profile" ? (
            <SettingsFormFooter formId={profileFormId} isMobile={isMobile} state={profileFormState} onCancel={() => profileResetRef.current?.()} />
          ) : null}

        </SettingsMainSection>
        </Tabs>
      </ResponsiveSettingsPopup>
    </Root>
  )
}

function ResponsiveSettingsPopup({
  children,
  isMobile,
}: {
  children: ReactNode
  isMobile: boolean
}) {
  if (isMobile) {
    return (
      <DrawerPopup
        className="grid h-(--app-drawer-height) w-full grid-cols-1 grid-rows-[auto_minmax(0,1fr)] p-0 has-data-[slot=drawer-bar]:pt-0"
        showBar={true}
      >
        {children}
      </DrawerPopup>
    )
  }

  return (
    <DialogPopup
      bottomStickOnMobile={false}
      className="grid h-[min(90vh,42rem)] w-[min(90vw,48rem)] max-w-none grid-cols-[14rem_minmax(0,1fr)] grid-rows-1 overflow-hidden rounded-2xl p-0 max-sm:row-start-1 max-sm:h-full max-sm:max-h-full max-sm:w-full max-sm:max-w-none max-sm:grid-cols-1 max-sm:grid-rows-[auto_minmax(0,1fr)]"
      viewportClassName="max-sm:grid-rows-[minmax(0,1fr)] max-sm:p-3"
    >
      {children}
    </DialogPopup>
  )
}

function SettingsMainSection({
  children,
  isMobile,
}: {
  children: ReactNode
  isMobile: boolean
}) {
  const className = "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"

  return isMobile ? (
    <DrawerContent className={className}>{children}</DrawerContent>
  ) : (
    <div className={className}>{children}</div>
  )
}

type BillingInterval = "month" | "year"

function BillingSettingsContent({
  onLoadingChange,
}: {
  onLoadingChange: (isLoading: boolean) => void
}) {
  const { i18n, t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const rootData = useAppContext()
  const [pendingAction, setPendingAction] = useState<
    | "billing-interval"
    | "cancel"
    | "checkout"
    | "payment-method"
    | "portal"
    | "restart"
    | "view-all"
    | null
  >(null)
  const [pendingDefaultPaymentMethodId, setPendingDefaultPaymentMethodId] =
    useState<string | null>(null)
  useEffect(() => {
    const resetPendingAction = () => setPendingAction(null)

    window.addEventListener("pageshow", resetPendingAction)

    return () => {
      window.removeEventListener("pageshow", resetPendingAction)
    }
  }, [])
  const organizationId = rootData?.org?.id ?? null
  const organizationQuery = useQuery(
    trpc.organizations.general.queryOptions(),
  )
  const paymentMethodPortalMutation = useMutation(
    trpc.billing.paymentMethodPortal.mutationOptions(),
  )
  const setDefaultPaymentMethodMutation = useMutation(
    trpc.billing.setDefaultPaymentMethod.mutationOptions(),
  )
  const cancellationPortalMutation = useMutation(
    trpc.billing.cancellationPortal.mutationOptions(),
  )
  const billingIntervalMutation = useMutation(
    trpc.billing.changeInterval.mutationOptions({
      onSuccess: () => toast.success(t("settings.billingCycleUpdated")),
      onError: () => toast.error(t("settings.billingCycleUpdateError")),
    }),
  )
  const canManage = hasOrganizationPermission(useCurrentOrganizationRole(), { billing: ["manage"] })
  const paymentMethodsQuery = useQuery({
    ...trpc.billing.paymentMethods.queryOptions(),
    enabled: Boolean(rootData?.billingEnabled && organizationId && canManage),
  })
  const invoicesQuery = useQuery({
    ...trpc.billing.invoices.queryOptions(),
    enabled: Boolean(rootData?.billingEnabled && organizationId && canManage),
  })
  const nextChargeQuery = useQuery({
    ...trpc.billing.nextCharge.queryOptions(),
    enabled: Boolean(rootData?.billingEnabled && organizationId && canManage),
  })
  const [billingRefreshSnapshot, setBillingRefreshSnapshot] = useState<{
    billingInterval: BillingInterval
    nextCharge: typeof nextChargeQuery.data
  } | null>(null)
  const subscriptionQuery = useQuery({
    ...trpc.billing.subscriptions.queryOptions(),
    enabled: Boolean(rootData?.billingEnabled && organizationId && canManage),
  })
  const activeSubscription = subscriptionQuery.data?.find((item) =>
    ["active", "past_due", "trialing"].includes(item.status) &&
    !item.cancelAtPeriodEnd &&
    !item.cancelAt &&
    !item.canceledAt &&
    !item.endedAt,
  )
  const subscription =
    activeSubscription ??
    subscriptionQuery.data?.find((item) =>
      ["canceled", "paused"].includes(item.status),
    ) ??
    subscriptionQuery.data?.find(
      (item) =>
        item.cancelAtPeriodEnd ||
        item.cancelAt ||
        item.canceledAt ||
        item.endedAt,
    ) ??
    subscriptionQuery.data?.[0]
  const currentBillingInterval: BillingInterval =
    subscription?.billingInterval === "year" ? "year" : "month"
  const [selectedBillingInterval, setSelectedBillingInterval] =
    useState<BillingInterval | null>(null)
  useEffect(() => {
    if (subscriptionQuery.isPending) {
      return
    }

    setSelectedBillingInterval(currentBillingInterval)
  }, [currentBillingInterval, subscriptionQuery.isPending])
  const billingAnnualEnabled = Boolean(rootData?.billingAnnualEnabled)
  const canChooseBillingInterval = billingAnnualEnabled
  const canCancelSubscription = Boolean(
    activeSubscription?.stripeSubscriptionId &&
      !activeSubscription.cancelAtPeriodEnd &&
      !activeSubscription.cancelAt,
  )
  const canRestartSubscription = Boolean(
    subscription?.stripeSubscriptionId &&
      (["canceled", "paused"].includes(subscription.status) ||
        subscription.cancelAtPeriodEnd ||
        subscription.cancelAt ||
        subscription.canceledAt ||
        subscription.endedAt),
  )
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const defaultPaymentMethod = paymentMethodsQuery.data?.find(
    (paymentMethod) => paymentMethod.isDefault,
  )
  const shouldUpdatePaymentMethod = ["expired", "expiring"].includes(
    defaultPaymentMethod?.status ?? "",
  )
  const organizationLoading = organizationQuery.isLoading
  const subscriptionLoading = subscriptionQuery.isLoading
  const nextChargeLoading = nextChargeQuery.isLoading
  const paymentMethodsLoading = paymentMethodsQuery.isLoading
  const invoicesLoading = invoicesQuery.isLoading
  const isStripeDataLoading =
    organizationLoading ||
    (canManage &&
      (subscriptionLoading ||
        nextChargeLoading ||
        paymentMethodsLoading ||
        invoicesLoading))

  useEffect(() => {
    onLoadingChange(isStripeDataLoading)

    return () => {
      onLoadingChange(false)
    }
  }, [isStripeDataLoading, onLoadingChange])

  const formatSubscriptionDate = (value: Date | string | null | undefined) =>
    value
      ? formatDateTime(value, {
          formatPreference: rootData?.formatPreference ?? "eu",
          includeTime: false,
          language,
          timeZone: rootData?.organizationTimezone,
        })
      : null

  async function startCheckout() {
    if (!organizationId) {
      return
    }

    setPendingAction("checkout")

    const result = await authClient.subscription.upgrade({
      annual: selectedBillingInterval === "year",
      cancelUrl: window.location.href,
      customerType: "organization",
      plan: "pro",
      locale: language,
      referenceId: organizationId,
      subscriptionId: activeSubscription?.stripeSubscriptionId ?? undefined,
      successUrl: window.location.href,
    })

    if (result.error) {
      toast.error(t("settings.billingActionError"))
    }

    setPendingAction(null)
  }

  async function openBillingPortal(action: "portal" | "view-all" = "portal") {
    if (!organizationId) {
      return
    }

    setPendingAction(action)

    const result = await authClient.subscription.billingPortal({
      customerType: "organization",
      locale: language,
      referenceId: organizationId,
      returnUrl: window.location.href,
    })

    if (result.error) {
      toast.error(t("settings.billingActionError"))
    }

    setPendingAction(null)
  }

  async function openPaymentMethodPortal() {
    if (!organizationId) {
      return
    }

    setPendingAction("payment-method")

    try {
      const result = await paymentMethodPortalMutation.mutateAsync({
        locale: language,
        returnUrl: window.location.href,
      })

      window.location.assign(result.url)
    } catch {
      toast.error(t("settings.billingActionError"))
      setPendingAction(null)
    }
  }

  async function makePaymentMethodDefault(paymentMethodId: string) {
    setPendingDefaultPaymentMethodId(paymentMethodId)

    try {
      await setDefaultPaymentMethodMutation.mutateAsync({ paymentMethodId })
      await queryClient.invalidateQueries(
        trpc.billing.paymentMethods.queryFilter(),
      )
    } catch {
      toast.error(t("settings.billingPaymentMethodDefaultError"))
    } finally {
      setPendingDefaultPaymentMethodId(null)
    }
  }

  async function openCancellationPortal() {
    if (!organizationId || !activeSubscription?.stripeSubscriptionId) {
      return
    }

    setPendingAction("cancel")

    try {
      const result = await cancellationPortalMutation.mutateAsync({
        locale: language,
        returnUrl: window.location.href,
        subscriptionId: activeSubscription.stripeSubscriptionId,
      })

      window.location.assign(result.url)
    } catch {
      toast.error(t("settings.billingActionError"))
      setPendingAction(null)
    }
  }

  async function switchBillingInterval(interval: BillingInterval) {
    if (!organizationId || !activeSubscription?.stripeSubscriptionId) {
      return
    }

    if (interval === currentBillingInterval) {
      return
    }

    setPendingAction("billing-interval")
    setBillingRefreshSnapshot({
      billingInterval: currentBillingInterval,
      nextCharge: nextChargeQuery.data,
    })

    try {
      await billingIntervalMutation.mutateAsync({
        interval,
      })

      await Promise.all([
        invoicesQuery.refetch(),
        subscriptionQuery.refetch(),
        nextChargeQuery.refetch(),
      ])
    } catch {
      setSelectedBillingInterval(currentBillingInterval)
    } finally {
      setBillingRefreshSnapshot(null)
      setPendingAction(null)
    }
  }

  async function restartSubscription() {
    if (!organizationId || !subscription?.stripeSubscriptionId) {
      return
    }

    setPendingAction("restart")

    const hasPendingCancellation = Boolean(
      subscription.cancelAtPeriodEnd || subscription.cancelAt,
    )
    const restartInterval =
      selectedBillingInterval ?? currentBillingInterval
    const shouldChangeBillingInterval =
      restartInterval !== currentBillingInterval

    if (
      hasPendingCancellation &&
      ["active", "trialing"].includes(subscription.status)
    ) {
      const result = await authClient.subscription.restore({
        customerType: "organization",
        referenceId: organizationId,
        subscriptionId: subscription.stripeSubscriptionId,
      })

      if (result.error) {
        toast.error(t("settings.billingActionError"))
        setPendingAction(null)
        return
      }

      if (shouldChangeBillingInterval) {
        try {
          await billingIntervalMutation.mutateAsync({
            interval: restartInterval,
          })
        } catch {
          setSelectedBillingInterval(currentBillingInterval)
        }
      }

      setBillingRefreshSnapshot({
        billingInterval: currentBillingInterval,
        nextCharge: nextChargeQuery.data,
      })
      try {
        await Promise.all([
          invoicesQuery.refetch(),
          subscriptionQuery.refetch(),
          nextChargeQuery.refetch(),
        ])
      } finally {
        setBillingRefreshSnapshot(null)
      }
      setPendingAction(null)
      return
    }

    const result = await authClient.subscription.upgrade({
      annual: selectedBillingInterval === "year",
      cancelUrl: window.location.href,
      customerType: "organization",
      locale: language,
      plan: "pro",
      referenceId: organizationId,
      subscriptionId: subscription.stripeSubscriptionId,
      successUrl: window.location.href,
    })

    if (result.error) {
      toast.error(t("settings.billingActionError"))
      setPendingAction(null)
    }
  }

  if (!rootData?.billingEnabled) {
    return (
      <Alert variant="info">
        <AlertTitle>{t("settings.billingNotConfiguredTitle")}</AlertTitle>
        <AlertDescription>
          {t("settings.billingNotConfiguredDescription")}
        </AlertDescription>
      </Alert>
    )
  }

  if (!canManage) {
    return (
      <Alert variant="info">
        <AlertTitle>{t("settings.billingOwnerTitle")}</AlertTitle>
        <AlertDescription>
          {t("settings.billingOwnerDescription")}
        </AlertDescription>
      </Alert>
    )
  }

  if (isStripeDataLoading) {
    return null
  }

  if (subscriptionQuery.isError) {
    return (
      <Alert variant="error">
        <AlertTitle>{t("settings.billingLoadError")}</AlertTitle>
        <AlertDescription>{t("settings.billingLoadErrorDescription")}</AlertDescription>
      </Alert>
    )
  }

  const effectiveStatus =
    subscription?.cancelAtPeriodEnd ||
    subscription?.cancelAt ||
    subscription?.canceledAt ||
    subscription?.endedAt
      ? "canceled"
      : subscription?.status
  let statusLabel = t("settings.billingNotActive")

  if (subscription) {
    statusLabel =
      {
        active: t("settings.billingStatusActive"),
        canceled: t("settings.billingStatusCanceled"),
        incomplete: t("settings.billingStatusIncomplete"),
        incomplete_expired: t("settings.billingStatusIncompleteExpired"),
        past_due: t("settings.billingStatusPastDue"),
        paused: t("settings.billingStatusPaused"),
        trialing: t("settings.billingStatusTrialing"),
        unpaid: t("settings.billingStatusUnpaid"),
      }[effectiveStatus ?? ""] ??
      effectiveStatus ??
      t("settings.billingNotActive")
  }

  const statusVariant =
    ({
      active: "success",
      canceled: "error",
      incomplete: "warning",
      incomplete_expired: "error",
      past_due: "warning",
      paused: "warning",
      trialing: "info",
      unpaid: "error",
    } as const)[effectiveStatus ?? ""] ?? "secondary"

  const cancellationLabel = subscription?.cancelAt
    ? t("settings.billingCancelsOn", {
        date: formatSubscriptionDate(subscription.cancelAt),
      })
    : subscription?.canceledAt
      ? t("settings.billingCanceledOn", {
          date: formatSubscriptionDate(subscription.canceledAt),
        })
      : subscription?.endedAt
        ? t("settings.billingEndedOn", {
            date: formatSubscriptionDate(subscription.endedAt),
          })
        : subscription?.cancelAtPeriodEnd
          ? t("settings.billingCancelsAtPeriodEnd")
          : null

  return (
    <div className="flex min-h-full flex-1 flex-col gap-8">
      {canManage ? <PlanUsage /> : null}
      <Card className="overflow-hidden">
        <CardHeader className="gap-2 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon aria-hidden="true" name="creditCard" size={19} />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">
                  {subscription?.plan
                    ? formatSubscriptionPlan(subscription.plan)
                    : t("settings.billingPlan")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {effectiveStatus === "trialing"
                    ? t("settings.billingTrialDescription")
                    : effectiveStatus === "canceled"
                      ? t("settings.billingInactivePlanDescription")
                      : subscription
                        ? t("settings.billingPlanDescription")
                        : t("settings.billingNotActiveDescription")}
                </CardDescription>
              </div>
            </div>
            <Badge
              className="!h-7 !min-h-0 !min-w-0 rounded-full !px-2.5 !py-1 !text-sm sm:!h-7 sm:!min-h-0 sm:!min-w-0 sm:!px-2.5 sm:!py-1 sm:!text-sm"
              variant={statusVariant}
            >
              {statusLabel}
            </Badge>
          </div>
        </CardHeader>

        {subscription ? (
          <CardPanel className="px-4 pb-4 pt-0">
            <dl className="grid gap-3 sm:grid-cols-2">
              <BillingDetail
                label={
                  cancellationLabel
                    ? t("settings.billingCancellation")
                    : t("settings.billingStatus")
                }
                value={cancellationLabel ?? statusLabel}
              />
              <BillingDetail
                label={t("settings.billingBillingInterval")}
                value={formatBillingInterval(
                  billingRefreshSnapshot?.billingInterval ??
                    subscription.billingInterval,
                  t,
                )}
              />
              <BillingDetail
                label={t("settings.billingNextChargeDate")}
                value={
                  nextChargeQuery.isPending
                    ? t("settings.billingLoading")
                    : (billingRefreshSnapshot?.nextCharge ??
                          nextChargeQuery.data
                        )?.date
                      ? formatSubscriptionDate(
                          (billingRefreshSnapshot?.nextCharge ??
                            nextChargeQuery.data)!.date,
                        ) ??
                        t("settings.billingNotAvailable")
                      : t("settings.billingNoUpcomingCharge")
                }
              />
              <BillingDetail
                label={t("settings.billingNextChargeAmount")}
                value={
                  nextChargeQuery.isPending ? (
                    t("settings.billingLoading")
                  ) : (
                    <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span>
                        {formatChargeAmount(
                          (billingRefreshSnapshot?.nextCharge ??
                            nextChargeQuery.data)?.amount,
                          (billingRefreshSnapshot?.nextCharge ??
                            nextChargeQuery.data)?.currency,
                          language,
                          t("settings.billingNotAvailable"),
                        )}
                      </span>
                      {(billingRefreshSnapshot?.nextCharge ??
                        nextChargeQuery.data)?.taxAmount ? (
                        <span className="text-xs font-normal text-muted-foreground">
                          + {t("settings.billingVat")} {formatChargeAmount(
                            (billingRefreshSnapshot?.nextCharge ??
                              nextChargeQuery.data)!.taxAmount,
                            (billingRefreshSnapshot?.nextCharge ??
                              nextChargeQuery.data)!.currency,
                            language,
                            t("settings.billingNotAvailable"),
                          )}
                        </span>
                      ) : null}
                    </span>
                  )
                }
              />
            </dl>
          </CardPanel>
        ) : null}

        <CardFooter className="flex flex-col items-stretch gap-3 border-t p-4">
          {canChooseBillingInterval ? (
            <div className="flex flex-col gap-3 border-b border-border pb-3">
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <p className="shrink-0 text-sm font-medium">
                  {t("settings.billingCycle")}
                </p>
                <p className="min-w-0 text-right text-xs text-muted-foreground">
                  {activeSubscription
                    ? t("settings.billingCycleChangeDescription")
                    : canRestartSubscription
                      ? t("settings.billingCycleRestartDescription")
                      : t("settings.billingCycleNewDescription")}
                </p>
              </div>
              <RadioGroup
                aria-label={t("settings.billingCycle")}
                className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
                onValueChange={(value) => {
                  if (value !== "month" && value !== "year") {
                    return
                  }

                  const interval = value as BillingInterval
                  setSelectedBillingInterval(interval)

                  if (activeSubscription) {
                    void switchBillingInterval(interval)
                  }
                }}
                value={selectedBillingInterval ?? currentBillingInterval}
              >
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 transition-colors has-data-[checked]:border-primary has-data-[checked]:bg-primary/5 has-data-[disabled]:cursor-not-allowed has-data-[disabled]:opacity-64">
                  <Radio disabled={pendingAction !== null} value="month" />
                  <span className="text-sm font-medium">
                    {t("settings.billingCycleMonthly")}
                  </span>
                </label>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 transition-colors has-data-[checked]:border-primary has-data-[checked]:bg-primary/5 has-data-[disabled]:cursor-not-allowed has-data-[disabled]:opacity-64">
                  <Radio
                    disabled={pendingAction !== null}
                    value="year"
                  />
                  <span className="text-sm font-medium">
                    {t("settings.billingCycleYearly")}
                  </span>
                </label>
              </RadioGroup>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {!activeSubscription && !canRestartSubscription ? (
              <Button
                disabled={pendingAction !== null}
                loading={pendingAction === "checkout"}
                onClick={() => void startCheckout()}
              >
                {t("settings.billingChoosePlan")}
              </Button>
            ) : null}
            {activeSubscription ? (
              <>
                {canRestartSubscription ? (
                  <Button
                    disabled={pendingAction !== null}
                    loading={pendingAction === "restart"}
                    onClick={() => void restartSubscription()}
                    variant="default"
                  >
                    {t("settings.billingRestartSubscription")}
                  </Button>
                ) : canCancelSubscription ? (
                  <Button
                    disabled={pendingAction !== null}
                    loading={pendingAction === "cancel"}
                    onClick={() => void openCancellationPortal()}
                    variant="destructive-outline"
                  >
                    {t("settings.billingCancelSubscription")}
                  </Button>
                ) : null}
                <Button
                  disabled={pendingAction !== null}
                  loading={pendingAction === "portal"}
                  onClick={() => void openBillingPortal()}
                  variant="outline"
                >
                  {t("settings.billingManage")}
                </Button>
              </>
            ) : canRestartSubscription ? (
              <>
                <Button
                  disabled={pendingAction !== null}
                  loading={pendingAction === "restart"}
                  onClick={() => void restartSubscription()}
                  variant="default"
                >
                  {t("settings.billingRestartSubscription")}
                </Button>
                {effectiveStatus === "canceled" ? (
                  <Button
                    disabled={pendingAction !== null}
                    loading={pendingAction === "portal"}
                    onClick={() => void openBillingPortal()}
                    variant="outline"
                  >
                    {t("settings.billingManage")}
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </CardFooter>
      </Card>

      {canManage ? (
        <Card className="shrink-0 border-0 p-0 shadow-none">
          <CardHeader className="flex flex-row flex-nowrap items-center justify-between gap-3 p-0">
            <CardTitle className="min-w-0 text-base">
              {t("settings.billingPaymentMethods")}
            </CardTitle>
            <Button
              className="shrink-0"
              disabled={pendingAction !== null}
              loading={pendingAction === "payment-method"}
              onClick={() => void openPaymentMethodPortal()}
              size="sm"
              variant="outline"
            >
              {shouldUpdatePaymentMethod
                ? t("settings.billingUpdateCard")
                : t("settings.billingAddPaymentMethod")}
            </Button>
          </CardHeader>
          <CardPanel className="flex flex-col gap-2 p-0">
            {paymentMethodsQuery.isPending ? (
              <div className="flex items-center gap-2 rounded-lg bg-muted/35 px-3 py-3 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                {t("settings.billingPaymentMethodsLoading")}
              </div>
            ) : paymentMethodsQuery.isError ? (
              <div className="rounded-lg bg-destructive/8 px-3 py-3 text-sm text-destructive">
                {t("settings.billingPaymentMethodsError")}
              </div>
            ) : paymentMethodsQuery.data.length > 0 ? (
              paymentMethodsQuery.data.map((paymentMethod) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5"
                  key={paymentMethod.id}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon aria-hidden="true" name="creditCard" size={17} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {formatPaymentMethodBrand(paymentMethod.brand)}
                        {" ···· "}
                        {paymentMethod.last4}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("settings.billingPaymentMethodExpires", {
                          date: `${String(paymentMethod.expMonth).padStart(2, "0")}/${paymentMethod.expYear}`,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {paymentMethod.status !== "active" ? (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {formatPaymentMethodStatus(paymentMethod.status, t)}
                      </span>
                    ) : null}
                    {paymentMethodsQuery.data.length > 1 &&
                    !paymentMethod.isDefault ? (
                      <Menu>
                        <MenuTrigger
                          aria-label={t(
                            "settings.billingPaymentMethodActions",
                          )}
                          render={
                            <Button
                              size="icon-sm"
                              variant="ghost"
                            />
                          }
                        >
                          <Icon aria-hidden="true" name="dotsVertical" />
                        </MenuTrigger>
                        <MenuPopup align="end" sideOffset={6}>
                          <MenuItem
                            disabled={pendingDefaultPaymentMethodId !== null}
                            onClick={() =>
                              void makePaymentMethodDefault(paymentMethod.id)
                            }
                          >
                            {pendingDefaultPaymentMethodId ===
                            paymentMethod.id ? (
                              <Spinner className="size-4" />
                            ) : null}
                            {t("settings.billingPaymentMethodMakeDefault")}
                          </MenuItem>
                        </MenuPopup>
                      </Menu>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <Alert variant="info">
                <AlertDescription>
                  {t("settings.billingNoPaymentMethods")}
                </AlertDescription>
              </Alert>
            )}
          </CardPanel>
        </Card>
      ) : null}

      <Card className="shrink-0 border-0 p-0 shadow-none">
        <CardHeader className="flex flex-row flex-nowrap items-center justify-between gap-3 p-0">
            <CardTitle className="min-w-0 text-base">
            {t("settings.billingRecentTransactions")}
          </CardTitle>
          <Button
            className="shrink-0"
            disabled={pendingAction !== null}
            loading={pendingAction === "view-all"}
            onClick={() => void openBillingPortal("view-all")}
            size="sm"
            variant="outline"
          >
            {t("settings.billingViewAll")}
          </Button>
        </CardHeader>
        <CardPanel className="flex flex-col gap-2 p-0">
          {invoicesQuery.isPending ? (
            <div className="flex items-center gap-2 rounded-lg bg-muted/35 px-3 py-3 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              {t("settings.billingRecentTransactionsLoading")}
            </div>
          ) : invoicesQuery.isError ? (
            <Alert variant="info">
              <AlertDescription>
                {t("settings.billingRecentTransactionsError")}
              </AlertDescription>
            </Alert>
          ) : invoicesQuery.data.length > 0 ? (
            invoicesQuery.data.map((invoice) => (
              <div
                className="flex min-w-0 flex-nowrap items-center gap-5 overflow-hidden rounded-lg border bg-muted/20 px-3 py-2.5"
                key={invoice.id}
              >
                <div className="min-w-0 flex-1 text-sm font-medium">
                  <span className="flex flex-nowrap items-baseline gap-x-1.5 whitespace-nowrap">
                    <span>
                      {formatChargeAmount(
                        invoice.amount,
                        invoice.currency,
                        language,
                        t("settings.billingNotAvailable"),
                      )}
                    </span>
                    {invoice.taxAmount ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        + {t("settings.billingVat")} {formatChargeAmount(
                          invoice.taxAmount,
                          invoice.currency,
                          language,
                          t("settings.billingNotAvailable"),
                        )}
                      </span>
                    ) : null}
                  </span>
                </div>
                <Badge
                  size="sm"
                  variant={formatInvoiceStatusVariant(invoice.status)}
                >
                  {formatInvoiceStatus(invoice.status, t)}
                </Badge>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatSubscriptionDate(invoice.date) ??
                    t("settings.billingNotAvailable")}
                </span>
                {invoice.url ? (
                  <Button
                    render={
                      <a
                        href={invoice.url}
                        rel="noreferrer"
                        target="_blank"
                      />
                    }
                    size="xs"
                    variant="link"
                  >
                    {t("settings.billingViewInvoice")}
                  </Button>
                ) : null}
              </div>
            ))
          ) : (
            <Alert variant="info">
              <AlertDescription>
                {t("settings.billingNoTransactions")}
              </AlertDescription>
            </Alert>
          )}
        </CardPanel>
      </Card>
    </div>
  )
}

function BillingDetail({
  className,
  label,
  value,
  valueClassName,
}: {
  className?: string
  label: string
  value: ReactNode
  valueClassName?: string
}) {
  return (
    <div className={cn("min-w-0 rounded-lg bg-muted/35 px-3 py-2.5", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-sm font-medium", valueClassName)}>{value}</dd>
    </div>
  )
}

function formatBillingInterval(
  interval: string | null | undefined,
  t: (key: string) => string,
) {
  switch (interval) {
    case "day":
      return t("settings.billingDaily")
    case "week":
      return t("settings.billingWeekly")
    case "month":
      return t("settings.billingMonthly")
    case "year":
      return t("settings.billingYearly")
    default:
      return t("settings.billingNotAvailable")
  }
}

function formatDateRange(start: string | null, end: string | null, fallback: string) {
  if (!start && !end) {
    return fallback
  }

  return `${start ?? fallback} – ${end ?? fallback}`
}

function formatSubscriptionPlan(plan: string) {
  return plan.slice(0, 1).toUpperCase() + plan.slice(1)
}

function formatChargeAmount(
  amount: number | null | undefined,
  currency: string | null | undefined,
  language: "en" | "fi",
  fallback: string,
) {
  if (amount === null || amount === undefined || !currency) {
    return fallback
  }

  return new Intl.NumberFormat(language === "fi" ? "fi-FI" : "en-US", {
    currency,
    style: "currency",
  }).format(amount / 100)
}

function formatPaymentMethodBrand(brand: string) {
  return brand.slice(0, 1).toUpperCase() + brand.slice(1)
}

function formatPaymentMethodStatus(
  status: "active" | "default" | "expired" | "expiring",
  t: (key: string) => string,
) {
  switch (status) {
    case "default":
      return t("settings.billingPaymentMethodStatusDefault")
    case "expired":
      return t("settings.billingPaymentMethodStatusExpired")
    case "expiring":
      return t("settings.billingPaymentMethodStatusExpiring")
    default:
      return t("settings.billingPaymentMethodStatusActive")
  }
}

function formatInvoiceStatus(
  status: string,
  t: (key: string) => string,
) {
  switch (status) {
    case "paid":
      return t("settings.billingInvoiceStatusPaid")
    case "open":
      return t("settings.billingInvoiceStatusOpen")
    case "uncollectible":
      return t("settings.billingInvoiceStatusUncollectible")
    case "void":
      return t("settings.billingInvoiceStatusVoid")
    default:
      return status
  }
}

function formatInvoiceStatusVariant(
  status: string,
): "error" | "info" | "secondary" | "success" | "warning" {
  switch (status) {
    case "paid":
      return "success"
    case "open":
      return "warning"
    case "uncollectible":
      return "error"
    case "void":
      return "secondary"
    default:
      return "info"
  }
}

function GeneralSettingsContent({
  formApi,
  onLoadingChange,
  onFormStateChange,
}: {
  formApi: { current: FormApi<OrganizationSettingsFormInput> | null }
  onLoadingChange: (isLoading: boolean) => void
  onFormStateChange: (state: GeneralFormState) => void
}) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const revalidator = useRevalidator()
  const settingsQuery = useQuery(trpc.organizations.general.queryOptions())
  const loading = settingsQuery.isLoading
  const canManage = settingsQuery.data?.canManage === true
  useEffect(() => {
    onLoadingChange(loading)

    return () => {
      onLoadingChange(false)
    }
  }, [onLoadingChange, loading])
  const handleFormStateChange = useCallback(
    (state: AppFormState) => {
      onFormStateChange({
        ...state,
        isDirty: canManage && state.isDirty,
      })
    },
    [canManage, onFormStateChange],
  )
  const updateMutation = useMutation(
    trpc.organizations.updateGeneral.mutationOptions({
      onError: () => {
        toast.error(t("settings.saveError"))
      },
    }),
  )

  if (settingsQuery.isError) {
    return (
      <Alert variant="error">
        <AlertDescription>{t("settings.loadError")}</AlertDescription>
      </Alert>
    )
  }

  if (loading || !settingsQuery.data) {
    return null
  }

  return (
    <AppForm<
      OrganizationSettingsFormInput,
      OrganizationSettingsFormInput,
      unknown
    >
      className="flex flex-col gap-5"
      defaultValues={{
        businessName: settingsQuery.data.businessName,
        currency: settingsQuery.data.currency,
        location: settingsQuery.data.location,
        timezone: settingsQuery.data.timezone,
      }}
      id={generalFormId}
      onSubmitSuccess={async () => {
        const values = formApi.current?.transient.value()

        if (values) {
          formApi.current?.resetForm(values)
        }

        await queryClient.invalidateQueries(trpc.organizations.general.queryFilter())
        await revalidator.revalidate()
      }}
      ref={formApi}
      schema={organizationSettingsFormSchema}
      onFormStateChange={handleFormStateChange}
      submitFn={(input) => updateMutation.mutateAsync(input)}
    >
      {(form) => (
        <GeneralSettingsFields
          canManage={settingsQuery.data.canManage}
          form={form}
        />
      )}
    </AppForm>
  )
}

function GeneralSettingsFields({
  canManage,
  form,
}: {
  canManage: boolean
  form: FormApi<OrganizationSettingsFormInput>
}) {
  const { t } = useTranslation()

  const locationField = form.getControlProps("location")
  const currencyField = form.getControlProps("currency")
  const timezoneField = form.getControlProps("timezone")

  return (
    <div className="flex flex-col gap-5">
      <FormLabel
        description={t("settings.businessNameDescription")}
        error={form.error("businessName")}
        label={t("settings.businessName")}
      >
        <Input
          {...form.getInputProps("businessName", {
            "aria-invalid": Boolean(form.error("businessName")) || undefined,
            autoComplete: "off",
            disabled: !canManage,
            onChange: () => {
              form.unstable_setCustomError("businessName", null)
            },
          })}
        />
      </FormLabel>

      <FormLabel
        description={t("settings.locationDescription")}
        error={form.error("location")}
        label={t("settings.location")}
      >
        <Select
          disabled={!canManage}
          items={onboardingCountries.map((country) => ({
            label: country.name,
            value: country.code,
          }))}
          onValueChange={(value) => {
            if (typeof value !== "string") {
              return
            }

            locationField.onChange(value)
            form.unstable_setCustomError("location", null)
          }}
          value={locationField.value}
        >
          <SelectTrigger
            aria-invalid={Boolean(form.error("location")) || undefined}
            onBlur={locationField.onBlur}
            ref={locationField.ref}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {onboardingCountries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.name}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </FormLabel>

      <FormLabel
        error={form.error("currency")}
        label={t("settings.currency")}
      >
        <Select
          disabled={!canManage}
          items={currencyItems}
          onValueChange={(value) => {
            if (typeof value !== "string") {
              return
            }

            currencyField.onChange(value)
            form.unstable_setCustomError("currency", null)
          }}
          value={currencyField.value}
        >
          <SelectTrigger
            aria-invalid={Boolean(form.error("currency")) || undefined}
            onBlur={currencyField.onBlur}
            ref={currencyField.ref}
          >
            <SelectValue>
              {(value) => currencyItems.find((item) => item.value === value)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectPopup>
            {currencyItems.map((currency) => (
              <SelectItem key={currency.value} value={currency.value}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{currency.label}</span>
                  <span className="shrink-0 text-muted-foreground">{currency.value}</span>
                </span>
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </FormLabel>

      <FormLabel
        description={t("settings.timezoneDescription")}
        error={form.error("timezone")}
        label={t("settings.timezone")}
      >
        <Select
          disabled={!canManage}
          items={timezoneItems}
          onValueChange={(value) => {
            if (typeof value !== "string") {
              return
            }

            timezoneField.onChange(value)
            form.unstable_setCustomError("timezone", null)
          }}
          value={timezoneField.value}
        >
          <SelectTrigger
            aria-invalid={Boolean(form.error("timezone")) || undefined}
            onBlur={timezoneField.onBlur}
            ref={timezoneField.ref}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {timezoneItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </FormLabel>

      {!canManage ? (
        <p className="text-xs leading-5 text-muted-foreground">
          {t("settings.readOnly")}
        </p>
      ) : null}
    </div>
  )
}
