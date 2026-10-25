import { workingHoursSchema } from "./team"
import { z } from "~/lib/validation/zod"

export function calendarAvailabilitySchema(endTimeError?: string) {
  return z.object({
    effectiveFrom: z.iso.date(),
    workingHours: workingHoursSchema(endTimeError).unwrap(),
    breaks: workingHoursSchema(endTimeError).unwrap(),
  })
}

export const saveCalendarAvailabilityInput = z.object({
  staffMemberId: z.string().min(1).max(128),
  kind: z.enum(["workingHours", "breaks"]).optional(),
  previousEffectiveFrom: z.iso.date().optional(),
  effectiveFrom: z.iso.date(),
  workingHours: workingHoursSchema().unwrap(),
  breaks: workingHoursSchema().unwrap(),
})

export const deleteCalendarAvailabilityInput = saveCalendarAvailabilityInput.pick({ staffMemberId: true, effectiveFrom: true, kind: true })

export type CalendarAvailabilityFields = z.infer<ReturnType<typeof calendarAvailabilitySchema>>
