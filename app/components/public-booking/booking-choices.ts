import type { BookingPageData, BookingService } from "./booking-types"

export function getBookingChoices(
  data: BookingPageData,
  service: BookingService,
  locationChoice: string,
  staffChoice: string,
) {
  const serviceStaff = data.staff.filter((person) =>
    person.staffServices.some((link) => link.serviceId === service.id),
  )
  const locations = data.locations.filter(
    (location) =>
      service.serviceLocations.some(
        (link) => link.locationId === location.id,
      ) &&
      serviceStaff.some((person) =>
        person.staffLocations.some((link) => link.locationId === location.id),
      ),
  )
  const defaultLocationId =
    data.page?.defaultLocationId ?? data.settings.defaultLocationId ?? undefined
  const locationId =
    ["ONLINE", "PHONE"].includes(service.deliveryType) && service.serviceLocations.length === 0
      ? undefined
      : data.page?.allowLocationSelection === false
      ? defaultLocationId
      : (locations.find((location) => location.id === locationChoice)?.id ??
        locations.find((location) => location.id === defaultLocationId)?.id ??
        locations[0]?.id)
  const staff = serviceStaff.filter(
    (person) =>
      !locationId ||
      person.staffLocations.some((link) => link.locationId === locationId),
  )
  const staffMemberId =
    data.page?.allowStaffSelection === false
      ? undefined
      : (staff.find((person) => person.id === staffChoice)?.id ??
        (staff.length === 1 ? staff[0].id : undefined))
  return { locations, locationId, staff, staffMemberId }
}
