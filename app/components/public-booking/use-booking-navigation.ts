import { useEffect, useMemo, useRef } from "react"
import { useSearchParams } from "react-router"

import type { BookingPageData, BookingScreen, BookingSlot } from "./booking-types"

const slotParams = ["start", "end", "member", "slotLocation"] as const

export function useBookingNavigation(data: BookingPageData, detailsServiceId?: string) {
  const [params, setParams] = useSearchParams()
  const currentParams = useRef(params)
  currentParams.current = params
  const defaultServiceId = data.services.length === 1 ? data.services[0].id : ""
  const serviceId = params.get("service") ?? defaultServiceId
  const service = data.services.find((item) => item.id === serviceId)
  const slot = useMemo<BookingSlot | null>(() => {
    const startsAt = params.get("start")
    const endsAt = params.get("end")
    const staffMemberId = params.get("member")
    if (!startsAt || !endsAt || !staffMemberId) return null
    const start = Date.parse(startsAt)
    const end = Date.parse(endsAt)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
    return { startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), staffMemberId, locationId: params.get("slotLocation") }
  }, [params])
  const requested = params.get("step")
  const screen: BookingScreen = !service || requested === "service"
    ? "service"
    : requested === "review" && slot && detailsServiceId === serviceId
      ? "review"
      : (requested === "details" || requested === "review") && slot
        ? "details"
        : "time"

  useEffect(() => {
    if (!requested || requested === screen) return
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set("step", screen)
      return next
    }, { replace: true, preventScrollReset: true })
  }, [requested, screen, setParams])

  function update(values: Record<string, string | null>, replace = true) {
    const next = new URLSearchParams(currentParams.current)
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    currentParams.current = next
    setParams(next, { replace, preventScrollReset: true })
  }

  const clearedSlot = Object.fromEntries(slotParams.map((key) => [key, null]))

  return {
    serviceId,
    service,
    screen,
    slot,
    locationChoice: params.get("location") ?? "",
    staffChoice: params.get("staff") ?? "",
    goTo: (step: BookingScreen) => update({ step }, false),
    selectService: (id: string) => update({ service: id, step: "time", ...(id !== serviceId ? { ...clearedSlot, location: null, staff: null } : {}) }, false),
    setLocationChoice: (id: string) => update({ location: id, staff: null, ...clearedSlot }),
    setStaffChoice: (id: string) => update({ staff: id, ...clearedSlot }),
    setSlot: (value: BookingSlot | null) => update(value ? {
      start: value.startsAt,
      end: value.endsAt,
      member: value.staffMemberId,
      slotLocation: value.locationId,
    } : clearedSlot),
  }
}
