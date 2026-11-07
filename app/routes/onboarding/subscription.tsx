import { dehydrate, useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router"
import type { Route } from "./+types/subscription"
import { BillingPlanForm } from "~/components/billing/billing-plan-form"
import { OnboardingStepError } from "~/components/onboarding/step-state"
import { getClientTRPC, getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { getAfterOnboardingRedirect } from "~/lib/auth/redirect"

export async function loader(loaderArgs: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(loaderArgs)
  await Promise.all([
    queryClient.query(trpc.onboarding.subscription.queryOptions()).catch(() => undefined),
    queryClient.query(trpc.billing.plan.queryOptions()).catch(() => undefined),
  ])

  return { queryClient: dehydrate(queryClient) }
}

export async function clientLoader() {
  const { queryClient, trpc } = getClientTRPC()
  await Promise.all([
    queryClient.query(trpc.onboarding.subscription.queryOptions()).catch(() => undefined),
    queryClient.query(trpc.billing.plan.queryOptions()).catch(() => undefined),
  ])

  return null
}

export default function SubscriptionStep() {
  const trpc = useTRPC()
  const subscription = useQuery(trpc.onboarding.subscription.queryOptions())
  const { t } = useTranslation("onboarding")
  const [searchParams] = useSearchParams()
  if (!subscription.data) return subscription.isError ? <OnboardingStepError isFetching={subscription.isFetching} onRetry={() => void subscription.refetch()} /> : null
  return <div className="flex flex-col gap-5">
    <div className="space-y-1.5"><h1 className="text-2xl font-semibold">{t("subscription.title")}</h1><p className="text-sm text-muted-foreground">{t("subscription.description")}</p></div>
    <BillingPlanForm onboarding={true} successUrl={typeof window === "undefined" ? undefined : `${window.location.origin}${getAfterOnboardingRedirect(searchParams, true)}`} />
  </div>
}
