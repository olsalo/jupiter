export type CalendarBookingSlot = { startsAt: string; endsAt: string; staffMemberId: string; locationId: string | null; overlapsBreak?: boolean }
type SlotDay = { date: string; slots: CalendarBookingSlot[] }

export function getClosestBookingSlot(slots: CalendarBookingSlot[], startsAt: Date, preferredMemberId?: string) {
  if (!Number.isFinite(+startsAt)) return undefined
  return slots.reduce<CalendarBookingSlot | undefined>((closest, slot) => {
    const distance = Math.abs(+new Date(slot.startsAt) - +startsAt)
    const closestDistance = closest ? Math.abs(+new Date(closest.startsAt) - +startsAt) : Infinity
    if (distance < closestDistance) return slot
    if (distance !== closestDistance || !closest) return closest
    if (slot.startsAt < closest.startsAt) return slot
    if (slot.startsAt === closest.startsAt && slot.staffMemberId === preferredMemberId && closest.staffMemberId !== preferredMemberId) return slot
    return closest
  }, undefined)
}

// Editing a length must never silently assign the booking to someone else
export function getCalendarBookingEditSlot(slots: CalendarBookingSlot[], startsAt: Date, memberId?: string, selectedSlotKey?: string) {
  const selected = selectedSlotKey ? slots.find((slot) => `${slot.startsAt}/${slot.staffMemberId}/${slot.locationId ?? ""}` === selectedSlotKey) : undefined
  if (selected) return selected
  return getClosestBookingSlot(slots.filter((slot) => slot.staffMemberId === memberId), startsAt, memberId)
}

export function includeCurrentBookingSlot(days: SlotDay[], current?: { date: string; slot: CalendarBookingSlot }) {
  if (!current) return days
  const day = days.find((day) => day.date === current.date)
  if (day?.slots.some((slot) => slot.startsAt === current.slot.startsAt && slot.staffMemberId === current.slot.staffMemberId && slot.locationId === current.slot.locationId)) return days
  if (!day) return [...days, { date: current.date, slots: [current.slot] }].sort((a, b) => a.date.localeCompare(b.date))
  return days.map((day) => day.date === current.date ? { ...day, slots: [...day.slots, current.slot] } : day)
}
