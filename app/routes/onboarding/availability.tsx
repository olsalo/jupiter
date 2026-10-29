import { dehydrate, useQuery } from "@tanstack/react-query"
import { useOutletContext } from "react-router"

import type { Route } from "./+types/availability"
import type { Route as OnboardingRoute } from "./+types/onboarding"
import { OnboardingScheduleForm } from "~/components/onboarding/schedule-form"
import { OnboardingStepError, OnboardingStepLoading } from "~/components/onboarding/step-state"
import { getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"

export async function loader(loaderArgs: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(loaderArgs)
  await queryClient.query(trpc.onboarding.schedule.queryOptions()).catch(() => undefined)

  return { queryClient: dehydrate(queryClient) }
}

export function clientLoader() {
  // Client queries own fetching and freshness after the initial server render.
  return null
}

export default function AvailabilityStep() {
  const { nextStep } =
    useOutletContext<OnboardingRoute.ComponentProps["loaderData"]>()
  const trpc = useTRPC()
  const business = useQuery(trpc.onboarding.schedule.queryOptions())

  if (business.data) {
    return <OnboardingScheduleForm defaultValues={business.data} nextStep={nextStep} step="availability" />
  }

  if (business.isError) {
    return <OnboardingStepError isFetching={business.isFetching} onRetry={() => void business.refetch()} />
  }

  return <OnboardingStepLoading step="business" />
}
