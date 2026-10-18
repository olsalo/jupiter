import { TZDate } from "react-day-picker"

import { calendarDateFromValue, calendarDateToValue } from "~/lib/calendar-date"

export type CalendarScheduleRule = {
  staffMemberId: string | null
  windows: { start: number; end: number }[]
}

type Interval = { startMinute: number; endMinute: number }

export function sortCalendarMembers<Member extends { id: string; name: string }>(members: Member[]): Member[] {
  return [...members].sort((a, b) => a.name.localeCompare(b.name, "fi") || a.id.localeCompare(b.id, "en"))
}

export function getWeekCalendarSchedule({ days, members, rules, timeZone, defaultStartMinute, defaultEndMinute, appointments = [], includeBusinessHours = true }: {
  days: Date[]
  members: { id: string }[]
  rules: CalendarScheduleRule[]
  timeZone: string
  defaultStartMinute: number
  defaultEndMinute: number
  appointments?: (Interval & { day: string })[]
  includeBusinessHours?: boolean
}) {
  const businessRules = rules.filter((rule) => rule.staffMemberId === null)
  const allSchedules = days.map((day) => {
    const value = calendarDateToValue(day)
    const midnight = calendarDateFromValue(value, timeZone)
    const nextMidnight = calendarDateFromValue(value, timeZone)
    nextMidnight.setDate(nextMidnight.getDate() + 1)
    const intervalsFor = (scheduleRules: CalendarScheduleRule[]): Interval[] => scheduleRules.flatMap((rule) => rule.windows.flatMap((window) => {
      const start = Math.max(+midnight, window.start)
      const end = Math.min(+nextMidnight, window.end)
      if (end <= start) return []
      const localStart = new TZDate(start, timeZone)
      const localEnd = new TZDate(end, timeZone)
      return [{ startMinute: localStart.getHours() * 60 + localStart.getMinutes(), endMinute: end === +nextMidnight ? 1440 : localEnd.getHours() * 60 + localEnd.getMinutes() }]
    })).filter((interval) => interval.endMinute > interval.startMinute)
    const business = businessRules.length ? intervalsFor(businessRules) : day.getDay() >= 1 && day.getDay() <= 5 ? [{ startMinute: defaultStartMinute, endMinute: defaultEndMinute }] : []
    const memberHours = members.map((member) => {
      const ownRules = rules.filter((rule) => rule.staffMemberId === member.id)
      return { memberId: member.id, intervals: ownRules.length ? intervalsFor(ownRules) : business }
    })
    return { day, value, memberHours, intervals: [...(includeBusinessHours ? business : []), ...memberHours.flatMap((member) => member.intervals), ...appointments.filter((appointment) => appointment.day === value)] }
  })
  const workingSchedules = allSchedules.filter((schedule) => schedule.intervals.length > 0)
  const schedules = workingSchedules.length ? workingSchedules : allSchedules
  const intervals = schedules.flatMap((schedule) => schedule.intervals)
  const startMinute = intervals.length ? Math.max(0, Math.floor(Math.min(...intervals.map((interval) => interval.startMinute)) / 60) * 60) : defaultStartMinute
  const endMinute = intervals.length ? Math.min(1440, Math.ceil(Math.max(...intervals.map((interval) => interval.endMinute)) / 60) * 60) : defaultEndMinute
  const unavailableTimes = schedules.flatMap((schedule) => schedule.memberHours.flatMap((member) => {
    const gaps: Interval[] = []
    let cursor = startMinute
    for (const interval of [...member.intervals].sort((a, b) => a.startMinute - b.startMinute)) {
      if (interval.startMinute > cursor) gaps.push({ startMinute: cursor, endMinute: interval.startMinute })
      cursor = Math.max(cursor, interval.endMinute)
    }
    if (cursor < endMinute) gaps.push({ startMinute: cursor, endMinute })
    return gaps.map((gap) => ({ day: schedule.value, memberId: member.memberId, ...gap }))
  }))
  return { days: schedules.map((schedule) => schedule.day), startMinute, endMinute, unavailableTimes }
}
