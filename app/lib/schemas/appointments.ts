import { calendarMinDurationMinutes } from "~/lib/calendar/time-step"
import { z } from "~/lib/zod"

export const id = z.string().trim().min(1).max(128)
export const idInput = z.object({ id })
import { timezone } from "./organization"
export { timezone, appointmentSettingsInput as settingsInput } from "./organization"
const minutes = z.number().int().min(0).max(525600)
const slug = z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const email = z.string().trim().toLowerCase().max(254).pipe(z.email())
export const phone = z.string().trim().max(40).transform((value) => value.replace(/[\s().-]/g, "")).pipe(z.string().regex(/^\+?[0-9]{5,20}$/))
const text = z.string().trim().max(2000)
export const serviceInput = z.object({
  name: z.string().trim().min(1).max(120), slug, description: text.nullable().optional(),
  durationMinutes: z.number().int().min(5).max(1440), bufferBeforeMinutes: z.number().int().min(0).max(240).default(0),
  bufferAfterMinutes: z.number().int().min(0).max(240).default(0), price: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/).nullable().default(null),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(), deliveryType: z.enum(["IN_PERSON", "ONLINE", "PHONE", "FLEXIBLE"]).default("IN_PERSON"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  maxAttendees: z.literal(1).default(1), minBookingNoticeMinutes: minutes.nullable().default(null),
  maxBookingAdvanceDays: z.number().int().min(1).max(730).nullable().optional(), cancellationNoticeMinutes: minutes.nullable().optional(),
  rescheduleNoticeMinutes: minutes.nullable().optional(), requiresConfirmation: z.boolean().default(false), isActive: z.boolean().default(true),
})
const serviceAssignments = z.array(id).max(100).refine((values) => new Set(values).size === values.length)
export const serviceCreateInput = serviceInput.extend({
  slug: serviceInput.shape.slug.optional(),
  categoryId: id.nullable().optional(),
  staffIds: serviceAssignments.default([]),
  locationIds: serviceAssignments.default([]),
})
export const staffInput = z.object({
  name: z.string().trim().min(1).max(120), memberId: id.nullable().optional(), email: email.nullable().optional(),
  phone: phone.nullable().optional(), bio: text.nullable().optional(), image: z.url().max(2000).nullable().optional(),
  timezone: timezone.nullable().optional(), isActive: z.boolean().default(true), acceptsAppointments: z.boolean().default(true),
})
export const staffCreateInput = staffInput.extend({ serviceIds: z.array(id).max(100).default([]), locationIds: z.array(id).max(100).default([]) })
export const assignmentInput = z.object({ id, ids: z.array(id).max(100).refine((values) => new Set(values).size === values.length) })
export const locationInput = z.object({
  name: z.string().trim().min(1).max(120), slug, description: text.nullable().optional(), timezone: timezone.nullable().optional(),
  addressLine1: z.string().max(200).nullable().optional(), addressLine2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(), state: z.string().max(100).nullable().optional(),
  postalCode: z.string().max(40).nullable().optional(), country: z.string().length(2).nullable().optional(),
  phone: phone.nullable().optional(), email: email.nullable().optional(), bookingInstructions: text.nullable().optional(), isActive: z.boolean().default(true),
})
export const customerInput = z.object({ firstName: z.string().trim().min(1).max(120), lastName: z.string().trim().max(120).nullable().optional(), email: email.nullable().optional(), phone: phone.nullable().optional(), timezone: timezone.nullable().optional(), locale: z.enum(["en", "fi"]).optional() })
export const pageInput = z.object({ organizationSlug: slug, bookingPageSlug: slug.optional() })
export const scopeInput = z.object({ staffMemberId: id.optional(), locationId: id.optional() })
export const rangeInput = z.object({ from: z.coerce.date(), to: z.coerce.date() }).refine(({ from, to }) => to > from && +to - +from <= 93 * 86400000, "Choose a range of up to 93 days")
export const slotInput = z.object({ serviceId: id, ...scopeInput.shape, from: z.coerce.date(), to: z.coerce.date() }).refine(({ from, to }) => to > from && +to - +from <= 31 * 86400000, "Choose a range of up to 31 days")
export const publicSlotInput = pageInput.extend(slotInput.shape).refine(({ from, to }) => to > from && +to - +from <= 31 * 86400000)
export const ruleInput = z.object({ dayOfWeek: z.number().int().min(0).max(6), startMinute: z.number().int().min(0).max(1439), endMinute: z.number().int().min(1).max(1440), timezone, validFrom: z.coerce.date().nullable().optional(), validUntil: z.coerce.date().nullable().optional() }).refine((rule) => rule.endMinute > rule.startMinute && (!rule.validFrom || !rule.validUntil || rule.validUntil > rule.validFrom))
export const replaceRulesInput = scopeInput.extend({ rules: z.array(ruleInput).max(100) })
export const intervalInput = scopeInput.extend({ startsAt: z.coerce.date(), endsAt: z.coerce.date(), reason: text.optional() }).refine(({ startsAt, endsAt }) => endsAt > startsAt)
export const overrideInput = intervalInput.safeExtend({ isAvailable: z.boolean() })
export const blockedInput = intervalInput.safeExtend({ title: z.string().trim().max(120).optional() })
export const bookingDuration = z.number().int().min(calendarMinDurationMinutes).max(1440)
export const calendarSlotInput = slotInput.safeExtend({ durationMinutes: bookingDuration.optional() })
export const calendarBookingTimesInput = z.object({ ...slotInput.shape, serviceId: id.optional(), staffMemberId: id.optional(), durationMinutes: bookingDuration, selectedStart: z.coerce.date().optional() }).refine(({ from, to }) => to > from && +to - +from <= 31 * 86400000, "Choose a range of up to 31 days")
export const createAppointmentInput = scopeInput.extend({ durationMinutes: bookingDuration.optional(), allowBreakOverlap: z.boolean().optional(), serviceId: id, startsAt: z.coerce.date(), customerId: id, notes: text.optional() })
export const createAppointmentWithCustomerInput = createAppointmentInput.omit({ customerId: true }).extend({ customer: customerInput })
export const createBookingInput = pageInput.extend({ serviceId: id, ...scopeInput.shape, startsAt: z.coerce.date(), customer: customerInput, notes: text.optional(), answers: z.array(z.object({ questionId: id, value: z.union([z.string().max(4000), z.number().finite(), z.boolean(), z.array(z.string().max(200)).max(50)]) })).max(50).default([]) })
export const bookingCodeInput = z.object({ bookingCode: z.string().regex(/^[A-Za-z0-9_-]{32}$/) })
export const publicRescheduleSlotsInput = bookingCodeInput.extend({ from: slotInput.shape.from, to: slotInput.shape.to }).refine(({ from, to }) => to > from && +to - +from <= 31 * 86400000)
export const cancelInput = idInput.extend({ reason: text.optional() })
export const publicCancelInput = bookingCodeInput.extend({ reason: text.optional() })
export const rescheduleInput = idInput.extend({ startsAt: z.coerce.date() })
export const publicRescheduleInput = bookingCodeInput.extend({ startsAt: z.coerce.date() })
export const listAppointmentsInput = rangeInput.safeExtend({ ...scopeInput.shape, customerId: id.optional(), includeCancelled: z.boolean().optional(), status: z.enum(["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional() })
export const paginationInput = z.object({ cursor: id.optional(), limit: z.number().int().min(1).max(100).default(50), search: z.string().trim().max(120).optional() })
export const notesInput = idInput.extend({ customerNotes: text.nullable().optional(), internalNotes: text.nullable().optional() })
export const updateAppointmentInput = idInput.extend({ customerId: id, internalNotes: text, serviceId: id.optional(), staffMemberId: id.optional(), durationMinutes: bookingDuration.optional(), allowBreakOverlap: z.boolean().optional(), startsAt: z.coerce.date().optional() })
export const appointmentSlotsInput = idInput.extend({ durationMinutes: bookingDuration.optional(), selectedStart: z.coerce.date().optional(), from: slotInput.shape.from, to: slotInput.shape.to }).refine(({ from, to }) => to > from && +to - +from <= 31 * 86400000)

// Zod defaults also run inside partial schemas, so explicitly remove them for
// updates to preserve fields the caller did not send
export const serviceUpdateInput = idInput.extend({
  categoryId: id.nullable().optional(),
  staffIds: serviceAssignments.optional(),
  locationIds: serviceAssignments.optional(),
  ...serviceInput.partial().shape,
  bufferBeforeMinutes: serviceInput.shape.bufferBeforeMinutes.removeDefault().optional(),
  bufferAfterMinutes: serviceInput.shape.bufferAfterMinutes.removeDefault().optional(),
  price: serviceInput.shape.price.removeDefault().optional(),
  currency: serviceInput.shape.currency,
  deliveryType: serviceInput.shape.deliveryType.removeDefault().optional(),
  maxAttendees: serviceInput.shape.maxAttendees.removeDefault().optional(),
  minBookingNoticeMinutes: serviceInput.shape.minBookingNoticeMinutes.removeDefault().optional(),
  requiresConfirmation: serviceInput.shape.requiresConfirmation.removeDefault().optional(),
  isActive: serviceInput.shape.isActive.removeDefault().optional(),
})
export const staffUpdateInput = idInput.extend({
  ...staffInput.partial().shape,
  isActive: staffInput.shape.isActive.removeDefault().optional(),
  acceptsAppointments: staffInput.shape.acceptsAppointments.removeDefault().optional(),
})
export const locationUpdateInput = idInput.extend({
  ...locationInput.partial().shape,
  isActive: locationInput.shape.isActive.removeDefault().optional(),
})

// Omitting the member keeps the saved member; null lists the whole team
export const appointmentBookingTimesInput = appointmentSlotsInput.safeExtend({ durationMinutes: bookingDuration, serviceId: id.optional(), staffMemberId: id.nullable().optional(), selectedStart: z.coerce.date().optional() })
