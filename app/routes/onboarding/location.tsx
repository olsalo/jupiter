import { dehydrate, useQuery } from "@tanstack/react-query"
import { useOutletContext } from "react-router"

import type { Route } from "./+types/location"
import type { Route as OnboardingRoute } from "./+types/onboarding"
import { OnboardingLocationForm } from "~/components/onboarding/location-form"
import { OnboardingStepError } from "~/components/onboarding/step-state"
import { getClientTRPC, getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"

export async function loader(loaderArgs: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(loaderArgs)
  await queryClient.query(trpc.onboarding.location.queryOptions()).catch(() => undefined)

  return { queryClient: dehydrate(queryClient) }
}

export async function clientLoader() {
  const { queryClient, trpc } = getClientTRPC()
  await queryClient.query(trpc.onboarding.location.queryOptions()).catch(() => undefined)

  return null
}

export default function LocationStep() {
  const { nextStep } =
    useOutletContext<OnboardingRoute.ComponentProps["loaderData"]>()
  const trpc = useTRPC()
  const location = useQuery(trpc.onboarding.location.queryOptions())

  if (location.data) {
    return <OnboardingLocationForm defaultValues={location.data} nextStep={nextStep} />
  }

  if (location.isError) {
    return <OnboardingStepError isFetching={location.isFetching} onRetry={() => void location.refetch()} />
  }

  return null
}
