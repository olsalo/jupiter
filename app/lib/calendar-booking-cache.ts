import type { QueryClient, QueryKey } from "@tanstack/react-query"
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server"

import type { AppRouter } from "~/.server/main"

type CalendarBooking = inferRouterOutputs<AppRouter>["appointment"]["list"][number]
type BookingFilter = inferRouterInputs<AppRouter>["appointment"]["list"] & { from: Date; to: Date }

const calendarVersions = new WeakMap<QueryClient, Map<string, string>>()

// Remember observed data across calendar remounts so external changes stale availability too
export function recordCalendarBookingVersion(client: QueryClient, range: string, version: string) {
  let versions = calendarVersions.get(client)
  if (!versions) {
    versions = new Map()
    calendarVersions.set(client, versions)
  }
  const previous = versions.get(range)
  versions.set(range, version)
  return previous !== undefined && previous !== version
}

// Apply the confirmed result to every cached calendar range before removing its preview
export function cacheCalendarBooking(client: QueryClient, listKey: QueryKey, booking: CalendarBooking) {
  const summary: CalendarBooking = {
    id: booking.id, startsAt: booking.startsAt, endsAt: booking.endsAt,
    timezone: booking.timezone, status: booking.status, source: booking.source,
    customer: { id: booking.customer.id, firstName: booking.customer.firstName, lastName: booking.customer.lastName },
    staffMember: booking.staffMember ? { id: booking.staffMember.id, name: booking.staffMember.name } : null,
    location: booking.location ? { id: booking.location.id, name: booking.location.name } : null,
    services: booking.services.map((service) => ({
      serviceId: service.serviceId, name: service.name, durationMinutes: service.durationMinutes,
      service: { color: service.service.color },
    })),
  }
  for (const query of client.getQueryCache().findAll({ queryKey: listKey })) {
    const input = (query.queryKey[1] as { input?: BookingFilter } | undefined)?.input
    if (!input || !Array.isArray(query.state.data)) continue
    const matches = +booking.startsAt < +input.to && +booking.endsAt > +input.from
      && (!input.staffMemberId || booking.staffMember?.id === input.staffMemberId)
      && (!input.locationId || booking.location?.id === input.locationId)
      && (!input.customerId || booking.customer.id === input.customerId)
      && (input.status ? booking.status === input.status : input.includeCancelled !== false || booking.status !== "CANCELLED")
    client.setQueryData<CalendarBooking[]>(query.queryKey, (current) => {
      if (!current) return current
      if (!matches && !current.some((item) => item.id === booking.id)) return current
      const remaining = current.filter((item) => item.id !== booking.id)
      return matches
        ? [...remaining, summary].sort((a, b) => +a.startsAt - +b.startsAt || a.id.localeCompare(b.id))
        : remaining
    })
  }
}
