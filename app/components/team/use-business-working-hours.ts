import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { localizationDefaults } from "~/lib/localization/defaults"
import { getPrimaryLocation } from "~/lib/locations/primary-location"
import { calendarReferenceQueryOptions } from "~/lib/calendar/query-options"
import { useAppContext } from "~/lib/hooks/use-app-context"

import { useTRPC } from "~/lib/trpc/client"

export function useBusinessWorkingHours() {
  const trpc = useTRPC()
  const rules = useQuery(trpc.availability.getRules.queryOptions({}))
  const organization = useQuery(trpc.organizations.getCurrent.queryOptions())
  const locations = useQuery({ ...trpc.location.list.queryOptions(), ...calendarReferenceQueryOptions })
  const location = getPrimaryLocation(locations.data, organization.data?.settings?.defaultLocationId)
  const root = useAppContext()
  const timezone = location?.timezone ?? organization.data?.settings?.timezone ?? root?.organizationTimezone ?? localizationDefaults.timezone
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
    isPending: locations.isPending || rules.isPending || (!rules.data?.some((rule) => rule.staffMemberId === null && rule.locationId === null) && organization.isPending),
    isError: locations.isError || rules.isError || (!rules.data?.some((rule) => rule.staffMemberId === null && rule.locationId === null) && organization.isError),
    isFetching: rules.isFetching || organization.isFetching || locations.isFetching,
    refetch: () => Promise.all([rules.refetch(), organization.refetch(), locations.refetch()]),
  }
}
