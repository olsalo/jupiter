import { dehydrate, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router"

import type { Route } from "./+types/subscription"
import { OnboardingStepError, OnboardingStepLoading } from "~/components/onboarding/step-state"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"
import { getClientTRPC, getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import Icon from "~/components/icons"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Spinner } from "~/components/ui/spinner"
import { Tabs, TabsList, TabsTab } from "~/components/ui/tabs"
import { authClient } from "~/lib/auth/client"
import type { BillingInterval } from "~/lib/billing"
import type { StripePriceData } from "~/lib/stripe.server"
import { toast } from "~/lib/toast"

export async function loader(loaderArgs: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(loaderArgs)
  await queryClient.query(trpc.onboarding.subscription.queryOptions()).catch(() => undefined)

  return { queryClient: dehydrate(queryClient) }
}

export async function clientLoader() {
  const { queryClient, trpc } = getClientTRPC()
  await queryClient.query(trpc.onboarding.subscription.queryOptions()).catch(() => undefined)

  return null
}

export const shouldRevalidate = shouldRevalidateAppRoute

export default function SubscriptionStep() {
  const trpc = useTRPC()
  const subscription = useQuery(trpc.onboarding.subscription.queryOptions())
  const subscriptionData = subscription.data
  const { i18n, t } = useTranslation("onboarding")
  const [searchParams] = useSearchParams()
  const [selectedBillingInterval, setSelectedBillingInterval] = useState<BillingInterval>(
    () => searchParams.get("billing") === "year" ? "year" : "month",
  )
  const billingInterval: BillingInterval =
    selectedBillingInterval === "year" && subscriptionData?.prices.year
      ? "year"
      : "month"
  const setBillingInterval = (value: BillingInterval) => {
    setSelectedBillingInterval(value)

    const url = new URL(window.location.href)
    url.searchParams.set("billing", value)
    window.history.replaceState(window.history.state, "", url)
  }
  const [isChoosingSubscription, setIsChoosingSubscription] = useState(false)
  useEffect(() => {
    const resetChoosingSubscription = () => setIsChoosingSubscription(false)

    window.addEventListener("pageshow", resetChoosingSubscription)

    return () => {
      window.removeEventListener("pageshow", resetChoosingSubscription)
    }
  }, [])

  const chooseSubscription = async () => {
    if (!subscriptionData?.organizationId || !subscriptionData.billingEnabled) {
      toast.error(t("errors.billingNotConfigured"))
      return
    }

    setIsChoosingSubscription(true)

    const result = await authClient.subscription.upgrade({
      annual: billingInterval === "year",
      cancelUrl: window.location.href,
      customerType: "organization",
      locale: i18n.resolvedLanguage === "fi" ? "fi" : "en",
      plan: subscriptionData.plan.id,
      referenceId: subscriptionData.organizationId,
      successUrl: `${window.location.origin}/?welcome=true`,
    })

    if (result.error) {
      toast.error(t("errors.subscription"))
      setIsChoosingSubscription(false)
    }
  }

  if (!subscriptionData) {
    return subscription.isError ? (
      <OnboardingStepError isFetching={subscription.isFetching} onRetry={() => void subscription.refetch()} />
    ) : (
      <OnboardingStepLoading step="subscription" />
    )
  }

  const { plan, prices, locale } = subscriptionData
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
            setBillingInterval(value)
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
        onClick={() => void chooseSubscription()}
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
