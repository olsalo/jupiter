import { useMutation } from "@tanstack/react-query"
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import { useTranslation } from "react-i18next"
import {
  data,
  redirect,
  useNavigate,
  useNavigation,
  useRouteLoaderData,
  useSearchParams,
} from "react-router"
import type { FormApi } from "@rvf/react"

import type { Route } from "./+types/onboarding"
import type { loader as rootLoader } from "~/root"
import { AppForm } from "~/components/app-form"
import { AppLogo } from "~/components/app-logo"
import FormLabel from "~/components/form-label"
import Icon from "~/components/icons"
import {
  OnboardingProgress,
  type OnboardingStep,
} from "~/components/onboarding-progress"
import { Badge } from "~/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { InputGroup, InputGroupInput } from "~/components/ui/input-group"
import {
  Tabs,
  TabsList,
  TabsTab,
} from "~/components/ui/tabs"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import { Spinner } from "~/components/ui/spinner"
import { authClient } from "~/lib/auth/client"
import type { BillingInterval } from "~/lib/billing"
import {
  isOnboardingCountryCode,
  onboardingCountries,
} from "~/lib/countries"
import { defaultTimeZone } from "~/lib/format-preference"
import { getIpLocationFromHeaders } from "~/lib/ip-location.server"
import { proPlan } from "~/lib/plans"
import { prisma } from "~/lib/prisma.server"
import { onboardingFormSchema } from "~/lib/schemas/onboarding"
import {
  getStripePrice,
  getStripePriceId,
  type StripePriceData,
} from "~/lib/stripe.server"
import { timezoneItems } from "~/lib/timezones"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import {
  requireAuthMiddleware,
  userContext,
} from "~/middleware/auth"
import { getLocale } from "~/middleware/i18next"
import { stripeBillingEnabled } from "~/lib/auth/server"

export const middleware: Route.MiddlewareFunction[] = [requireAuthMiddleware]

type OnboardingFormValues = {
  businessName: string
  location: string
  name: string
  timezone: string
}

type OnboardingStepId = "business" | "subscription"

type OnboardingStepState = {
  complete: boolean
  id: OnboardingStepId
}

function getOnboardingSteps({
  billingEnabled,
  businessComplete,
  subscriptionComplete,
}: {
  billingEnabled: boolean
  businessComplete: boolean
  subscriptionComplete: boolean
}): OnboardingStepState[] {
  const businessStep = { complete: businessComplete, id: "business" as const }

  if (!billingEnabled) {
    return [businessStep]
  }

  return [
    businessStep,
    { complete: subscriptionComplete, id: "subscription" },
  ]
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext)!

  const membership = await prisma.member.findFirst({
    where: { userId: user.id },
    select: {
      organizationId: true,
      organization: {
        select: {
          name: true,
          settings: {
            select: { location: true, timezone: true },
          },
        },
      },
    },
  })
  const ipLocation = await getIpLocationFromHeaders(request.headers)
  const organizationSettings = membership?.organization.settings
  const ipCountry = ipLocation?.location.country?.toLowerCase()
  const location =
    organizationSettings?.location?.toLowerCase() ??
    (ipCountry && isOnboardingCountryCode(ipCountry) ? ipCountry : "fi")

  const subscription = membership
    ? await prisma.subscription.findFirst({
        select: { id: true },
        where: {
          referenceId: membership.organizationId,
          status: { in: ["active", "past_due", "trialing"] },
        },
      })
    : null
  const firstStepComplete = Boolean(
    organizationSettings?.location && organizationSettings.timezone,
  )

  if (subscription) {
    throw redirect("/")
  }

  const steps = getOnboardingSteps({
    billingEnabled: stripeBillingEnabled,
    businessComplete: firstStepComplete,
    subscriptionComplete: false,
  })
  const currentStepIndex = steps.findIndex((item) => !item.complete)

  if (currentStepIndex === -1) {
    throw redirect("/")
  }

  const currentStep = steps[currentStepIndex]!
  const step: OnboardingStep = currentStepIndex + 1
  const nextStep =
    currentStepIndex < steps.length - 1 ? currentStepIndex + 2 : null

  const requestedStep = new URL(request.url).searchParams.get("step")

  if (requestedStep !== String(step)) {
    throw redirect(`/onboarding?step=${step}`)
  }

  const locale = getLocale(context) === "fi" ? "fi" : "en"
  const prices =
    currentStep.id === "subscription"
      ? await getOnboardingPrices()
      : { month: null, year: null }

  return data({
    billingEnabled: stripeBillingEnabled,
    defaultValues: {
      businessName: membership?.organization.name ?? "",
      location,
      name: user.name,
      timezone:
        organizationSettings?.timezone ??
        ipLocation?.location.timezone ??
        defaultTimeZone,
    },
    organizationId: membership?.organizationId ?? null,
    plan: {
      features: proPlan.features[locale],
      id: proPlan.id,
      name: proPlan.name,
    },
    prices,
    step,
    stepId: currentStep.id,
    totalSteps: steps.length,
    nextStep,
    locale,
  })
}

export default function Onboarding({ loaderData }: Route.ComponentProps) {
  const { i18n, t } = useTranslation("onboarding")
  const formApi = useRef<FormApi<OnboardingFormValues>>(null)
  const navigate = useNavigate()
  const navigation = useNavigation()
  const [searchParams, setSearchParams] = useSearchParams()
  const trpc = useTRPC()
  const completeMutation = useMutation(
    trpc.onboarding.complete.mutationOptions({
      onSuccess: () => {
        navigate(
          loaderData.nextStep
            ? `/onboarding?step=${loaderData.nextStep}`
            : "/",
          { replace: true },
        )
      },
    }),
  )
  const billingInterval: BillingInterval =
    searchParams.get("billing") === "year" && loaderData.prices.year
      ? "year"
      : "month"
  const [isChoosingSubscription, setIsChoosingSubscription] = useState(false)
  useEffect(() => {
    const resetChoosingSubscription = () => setIsChoosingSubscription(false)

    window.addEventListener("pageshow", resetChoosingSubscription)

    return () => {
      window.removeEventListener("pageshow", resetChoosingSubscription)
    }
  }, [])

  const setBillingInterval = (value: BillingInterval) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)

      if (value === "year") {
        nextParams.set("billing", "year")
      } else {
        nextParams.delete("billing")
      }

      return nextParams
    }, { replace: true })
  }

  const chooseSubscription = async () => {
    if (!loaderData.organizationId || !loaderData.billingEnabled) {
      toast.error(t("errors.billingNotConfigured"))
      return
    }

    setIsChoosingSubscription(true)

    const result = await authClient.subscription.upgrade({
      annual: billingInterval === "year",
      cancelUrl: window.location.href,
      customerType: "organization",
      locale: i18n.resolvedLanguage === "fi" ? "fi" : "en",
      plan: loaderData.plan.id,
      referenceId: loaderData.organizationId,
      successUrl: `${window.location.origin}/`,
    })

    if (result.error) {
      toast.error(t("errors.subscription"))
      setIsChoosingSubscription(false)
    }
  }

  return (
    <OnboardingShell>
      <title>{t("title")}</title>
      <OnboardingProgress
        step={loaderData.step}
        total={loaderData.totalSteps}
      />

      {loaderData.stepId === "business" ? (
        <BusinessDetailsStep
          completeMutation={completeMutation}
          formApi={formApi}
          isFinalStep={loaderData.nextStep === null}
          navigation={navigation}
          t={t}
          defaultValues={loaderData.defaultValues}
        />
      ) : (
        <SubscriptionStep
          billingInterval={billingInterval}
          isChoosingSubscription={isChoosingSubscription}
          onBillingIntervalChange={setBillingInterval}
          onChooseSubscription={() => void chooseSubscription()}
          plan={loaderData.plan}
          prices={loaderData.prices}
          locale={loaderData.locale}
          t={t}
        />
      )}
    </OnboardingShell>
  )
}

function BusinessDetailsStep({
  completeMutation,
  defaultValues,
  formApi,
  isFinalStep,
  navigation,
  t,
}: {
  completeMutation: {
    mutateAsync: (input: OnboardingFormValues) => Promise<unknown>
  }
  defaultValues: OnboardingFormValues
  formApi: RefObject<FormApi<OnboardingFormValues> | null>
  isFinalStep: boolean
  navigation: ReturnType<typeof useNavigation>
  t: ReturnType<typeof useTranslation<"onboarding">>["t"]
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <AppForm
        className="flex flex-col gap-3.5"
        defaultValues={defaultValues}
        otherFormProps={{ noValidate: true }}
        ref={formApi}
        schema={onboardingFormSchema}
        submitFn={async (input) => {
          try {
            await completeMutation.mutateAsync(input)
          } catch (error) {
            const errorMessage =
              error instanceof Error &&
              error.message === "ORGANIZATION_NAME_TAKEN"
                ? t("errors.organizationNameTaken")
                : t("errors.create")

            formApi.current?.unstable_setCustomError(
              "businessName",
              errorMessage,
            )
            throw error
          }
        }}
      >
        {(form) => {
          const isSubmitting =
            form.formState.isSubmitting || navigation.state !== "idle"
          const locationField = form.getControlProps("location")
          const timezoneField = form.getControlProps("timezone")

          return (
            <>
              <FormLabel error={form.error("name")} label={t("name.label")}>
                <InputGroup>
                  <InputGroupInput
                    {...form.getInputProps("name", {
                      "aria-invalid": Boolean(form.error("name")) || undefined,
                      autoComplete: "name",
                      onChange: () => {
                        form.unstable_setCustomError("name", null)
                      },
                      placeholder: t("name.placeholder"),
                      type: "text",
                    })}
                  />
                </InputGroup>
              </FormLabel>

              <Separator />

              <FormLabel
                error={form.error("businessName")}
                label={t("businessName.label")}
              >
                <InputGroup>
                  <InputGroupInput
                    {...form.getInputProps("businessName", {
                      "aria-invalid":
                        Boolean(form.error("businessName")) || undefined,
                      autoComplete: "organization",
                      onChange: () => {
                        form.unstable_setCustomError("businessName", null)
                      },
                      placeholder: t("businessName.placeholder"),
                      type: "text",
                    })}
                  />
                </InputGroup>
              </FormLabel>

              <FormLabel
                error={form.error("location")}
                label={t("location.label")}
              >
                <Select
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
                    <SelectValue placeholder={t("location.placeholder")} />
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
                error={form.error("timezone")}
                label={t("timezone.label")}
              >
                <Select
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
                    <SelectValue placeholder={t("timezone.placeholder")} />
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

              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? (
                  <>
                    <Spinner className="size-4" />
                    {t("actions.creating")}
                  </>
                ) : (
                  t(isFinalStep ? "actions.finishSetup" : "actions.create")
                )}
              </Button>
            </>
          )
        }}
      </AppForm>
    </>
  )
}

function SubscriptionStep({
  billingInterval,
  isChoosingSubscription,
  onBillingIntervalChange,
  onChooseSubscription,
  plan,
  prices,
  locale,
  t,
}: {
  billingInterval: BillingInterval
  isChoosingSubscription: boolean
  onBillingIntervalChange: (value: BillingInterval) => void
  onChooseSubscription: () => void
  plan: {
    features: readonly string[]
    id: string
    name: string
  }
  prices: {
    month: StripePriceData | null
    year: StripePriceData | null
  }
  locale: string
  t: ReturnType<typeof useTranslation<"onboarding">>["t"]
}) {
  const annualEnabled = Boolean(prices.year)
  const annualDiscount = calculateAnnualDiscount(prices)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold">{t("subscription.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subscription.description")}
        </p>
      </div>

      <Tabs
        className="w-full"
        onValueChange={(value) => {
          if (value === "month" || (value === "year" && annualEnabled)) {
            onBillingIntervalChange(value)
          }
        }}
        value={billingInterval}
      >
        <TabsList
          aria-label={t("subscription.billingLabel")}
          className="grid w-full grid-cols-2"
        >
          <TabsTab value="month">{t("subscription.monthly")}</TabsTab>
          <TabsTab disabled={!annualEnabled} value="year">
            {t("subscription.yearly")}
            {annualDiscount !== null ? (
              <Badge size="sm" variant="success">
                -{annualDiscount}%
              </Badge>
            ) : null}
          </TabsTab>
        </TabsList>
      </Tabs>

      <Card className="overflow-hidden">
        <CardHeader className="!flex !p-[18px] flex-row items-center gap-4 border-b bg-muted/30">
          <CardTitle className="shrink-0 whitespace-nowrap text-2xl">
            {plan.name}
          </CardTitle>
          <div className="ms-auto flex shrink-0 items-baseline gap-1 whitespace-nowrap">
            <p className="font-heading text-2xl font-semibold leading-none">
              {formatPrice(
                prices[billingInterval],
                locale,
                t("subscription.priceUnavailable"),
              )}
            </p>
            <span className="text-sm text-muted-foreground">
              {billingInterval === "month"
                ? t("subscription.perMonth")
                : t("subscription.perYear")}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-[18px]">
          <ul className="flex flex-col gap-3">
            {plan.features.map((feature) => (
              <li className="flex items-center gap-2.5 text-sm" key={feature}>
                <Icon
                  className="shrink-0 text-primary"
                  name="circleCheckFilled"
                  size={18}
                />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Button
        disabled={
          isChoosingSubscription ||
          (!annualEnabled && billingInterval === "year")
        }
        onClick={onChooseSubscription}
        type="button"
      >
        {isChoosingSubscription ? (
          <>
            <Spinner className="size-4" />
            {t("actions.choosingSubscription")}
          </>
        ) : (
          t("actions.chooseSubscription")
        )}
      </Button>
    </div>
  )
}

async function getOnboardingPrices() {
  const [month, year] = await Promise.all([
    getStripePrice(getStripePriceId(proPlan.id, "month")),
    getStripePrice(getStripePriceId(proPlan.id, "year")),
  ])

  return { month, year }
}

function formatPrice(
  price: StripePriceData | null,
  locale: string,
  fallback: string,
) {
  if (price?.unitAmount === null || price?.unitAmount === undefined) {
    return fallback
  }

  return new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-US", {
    currency: price.currency.toUpperCase(),
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(price.unitAmount / 100)
}

function calculateAnnualDiscount({
  month,
  year,
}: {
  month: StripePriceData | null
  year: StripePriceData | null
}) {
  const monthlyAmount = month?.unitAmount
  const annualAmount = year?.unitAmount

  if (
    monthlyAmount === null ||
    monthlyAmount === undefined ||
    annualAmount === null ||
    annualAmount === undefined ||
    monthlyAmount <= 0 ||
    annualAmount >= monthlyAmount * 12
  ) {
    return null
  }

  return Math.round((1 - annualAmount / (monthlyAmount * 12)) * 100)
}

function OnboardingShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation("onboarding")
  const navigate = useNavigate()
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const isElectron = Boolean(rootData?.isElectron)

  const logOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate("/auth", { replace: true })
        },
      },
    })
  }

  return (
    <main
      className="auth-layout relative flex min-h-dvh bg-background text-foreground"
      data-electron={isElectron}
    >
      {isElectron ? (
        <div
          aria-hidden="true"
          className="electron-drag absolute inset-x-0 top-0 z-20 h-8"
        />
      ) : null}
      <section
        className={`flex flex-1 flex-col gap-4 p-5 md:p-4 ${isElectron ? "pt-[52px] md:pt-12" : ""}`}
      >
        <header className="flex items-center justify-between">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground md:size-9">
            <AppLogo aria-hidden="true" className="size-5 md:size-6" />
          </div>
          <Button
            aria-label={t("actions.logOut")}
            onClick={logOut}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Icon name="logOut" size={18} />
          </Button>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-md flex-col gap-5">
            {children}
          </div>
        </div>
      </section>
    </main>
  )
}
