import { dehydrate, useQuery } from "@tanstack/react-query"
import { useOutletContext } from "react-router"

import type { Route } from "./+types/business"
import type { Route as OnboardingRoute } from "./+types/onboarding"
import { BusinessDetailsForm } from "~/components/onboarding/business-details-form"
import { OnboardingStepError, OnboardingStepLoading } from "~/components/onboarding/step-state"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"
import { getClientTRPC, getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"

export async function loader(loaderArgs: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(loaderArgs)
  await queryClient.query(trpc.onboarding.business.queryOptions()).catch(() => undefined)

  return { queryClient: dehydrate(queryClient) }
}

export async function clientLoader() {
  const { queryClient, trpc } = getClientTRPC()
  await queryClient.query(trpc.onboarding.business.queryOptions()).catch(() => undefined)

  return null
}

export const shouldRevalidate = shouldRevalidateAppRoute

export default function BusinessDetailsStep() {
  const { nextStep } =
    useOutletContext<OnboardingRoute.ComponentProps["loaderData"]>()
  const trpc = useTRPC()
  const business = useQuery(trpc.onboarding.business.queryOptions())

  if (business.data) {
    return <BusinessDetailsForm defaultValues={business.data} nextStep={nextStep} />
  }

  if (business.isError) {
    return <OnboardingStepError isFetching={business.isFetching} onRetry={() => void business.refetch()} />
  }

  return <OnboardingStepLoading step="business" />
}
