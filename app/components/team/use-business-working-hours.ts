import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"

import { useTRPC } from "~/lib/trpc/client"

export function useBusinessWorkingHours() {
  const trpc = useTRPC()
  const rules = useQuery(trpc.availability.getRules.queryOptions({}))
  const organization = useQuery(trpc.organizations.getCurrent.queryOptions())
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const timezone = root?.organizationTimezone ?? organization.data?.settings?.timezone ?? "Europe/Helsinki"
  const hours = useMemo(() => {
    const businessRules = rules.data?.filter((rule) => rule.staffMemberId === null && rule.locationId === null)
    if (businessRules?.length) return businessRules.map((rule) => ({ ...rule, timezone }))
    const settings = organization.data?.settings
    return [1, 2, 3, 4, 5].map((dayOfWeek) => ({
      dayOfWeek,
      startMinute: (settings?.defaultStartHour ?? 8) * 60,
      endMinute: (settings?.defaultEndHour ?? 18) * 60,
      timezone,
      locationId: null,
      isActive: true,
      validFrom: null,
      validUntil: null,
    }))
  }, [rules.data, organization.data, timezone])

  return {
    hours,
    timezone,
    isPending: rules.isPending || (!rules.data?.some((rule) => rule.staffMemberId === null && rule.locationId === null) && organization.isPending),
    isError: rules.isError || (!rules.data?.some((rule) => rule.staffMemberId === null && rule.locationId === null) && organization.isError),
    isFetching: rules.isFetching || organization.isFetching,
    refetch: () => Promise.all([rules.refetch(), organization.refetch()]),
  }
}
