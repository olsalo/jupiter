import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type MouseEvent, type DragEvent, type RefObject, type SetStateAction } from "react"

import type { CalendarBookingReturnMotion } from "~/components/calendar/calendar-booking-preview"
import type { CalendarAppointment } from "~/components/calendar/calendar-appointment"
import type { CalendarDragSelection } from "~/components/calendar/calendar-drag-selection"
import type { CalendarMember, CalendarUnavailableTime } from "~/components/calendar/week-calendar"
import { createCalendarBookingDragPreview, type CalendarBookingDragPreview } from "~/lib/calendar-booking-drag-preview"
import { getCalendarBookingConflicts } from "~/lib/calendar-appointments"
import { getCalendarBookingDragPosition, getCalendarBookingDragRange, getCalendarDragScrollDelta } from "~/lib/calendar-booking-drag"
import { getCalendarTimeRange } from "~/lib/calendar-date"

type ActiveDrag = { appointment: CalendarAppointment; pointerId: number; originX: number; originY: number; x: number; y: number; moved: boolean; needsUpdate: boolean; grid: HTMLDivElement; bounds: DOMRect }


export function useCalendarBookingDrag({ appointments, conflictAppointments = appointments, members, unavailableTimes, startMinute, endMinute, timeZone, allowSimultaneousBookings, viewportRef, scrollTo, onMove, returnMotion, onDraggingChange }: {
  onDraggingChange?: (dragging: boolean) => void
  returnMotion?: RefObject<CalendarBookingReturnMotion | null>
  appointments: CalendarAppointment[]
  conflictAppointments?: CalendarAppointment[]
  members: CalendarMember[]
  unavailableTimes: CalendarUnavailableTime[]
  startMinute: number
  endMinute: number
  timeZone: string
  allowSimultaneousBookings: boolean
  viewportRef: RefObject<HTMLDivElement | null>
  scrollTo: (position: { left: number; top: number }) => void
  onMove?: (appointment: CalendarAppointment, selection: CalendarDragSelection, phase: "start" | "drop") => void
}) {
  const active = useRef<ActiveDrag | null>(null)
  const suppressClick = useRef(false)
  const animation = useRef<number | null>(null)
  const lastFrame = useRef<number | null>(null)
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [returningPreviews, setReturningPreviews] = useState<{ appointment: CalendarAppointment; from: CalendarBookingReturnMotion["bounds"] }[]>([])
  const [dragPreview] = useState(createCalendarBookingDragPreview)
  const [dragged, setDragState] = useState<CalendarBookingDragPreview | null>(null)
  const setDragged = (value: SetStateAction<CalendarBookingDragPreview | null>) => {
    const previous = dragPreview.getSnapshot()
    const next = typeof value === "function" ? value(previous) : value
    if (previous?.appointment.id !== next?.appointment.id || previous?.returning !== next?.returning) setDragState(next)
    dragPreview.setSnapshot(next)
  }
  const candidateAt = (drag: ActiveDrag, validate = true, displayed?: CalendarBookingDragPreview | null) => {
    const viewport = viewportRef.current
    if (!viewport) return null
    const visible = viewport.getBoundingClientRect()
    const position = displayed ?? getCalendarBookingDragPosition({
      left: drag.bounds.left + drag.x - drag.originX,
      top: drag.bounds.top + drag.y - drag.originY,
      width: drag.bounds.width,
      height: drag.bounds.height,
    }, visible)
    // Choose the lane from the block center and the time from its top, independent of the grab point.
    const x = Math.max(visible.left + 1, Math.min(visible.right - 1, position.left + (displayed?.width ?? drag.bounds.width) / 2))
    // At an outside release the block may sit over calendar padding or a scrollbar.
    // Resolve its lane geometrically so those edges behave like the calendar interior.
    const target = Array.from(drag.grid.querySelectorAll<HTMLElement>('[data-slot="calendar-member-lane"]'))
      .map((lane) => ({ lane, bounds: lane.getBoundingClientRect() }))
      .filter(({ bounds }) => bounds.right > visible.left && bounds.left < visible.right)
      .map((target) => ({ ...target, distance: Math.max(target.bounds.left - x, x - target.bounds.right, 0) }))
      .sort((a, b) => a.distance - b.distance)[0]
    const lane = target?.lane
    const member = members.find((member) => member.id === lane?.dataset.memberId)
    if (!lane || !member || !lane.dataset.day || !target) return null
    const bounds = target.bounds
    const day = lane.dataset.day
    const conflicts = getCalendarBookingConflicts(conflictAppointments, allowSimultaneousBookings)
      .filter((appointment) => appointment.id !== drag.appointment.id && appointment.day === day && appointment.memberId === member.id)
    const range = getCalendarBookingDragRange({
      minute: startMinute + (position.top - bounds.top) / bounds.height * (endMinute - startMinute),
      offset: 0,
      durationMinutes: drag.appointment.durationMinutes ?? drag.appointment.endMinute - drag.appointment.startMinute,
      startMinute, endMinute,
      blocked: validate ? [
        ...unavailableTimes.filter((range) => range.day === day && range.memberId === member.id),
        ...conflicts,
      ] : [],
      snapAround: validate ? conflicts : [],
      isAvailable: (range) => !validate || +getCalendarTimeRange(day, range.startMinute, range.endMinute - range.startMinute, timeZone).startsAt > Date.now(),
    })
    if (!range) return null
    return { ...drag.appointment, ...range, memberId: member.id, day, draft: true }
  }
  const updateDragged = (drag: ActiveDrag) => {
    const visible = viewportRef.current?.getBoundingClientRect()
    if (!visible) return
    const position = getCalendarBookingDragPosition({
      left: drag.bounds.left + drag.x - drag.originX,
      top: drag.bounds.top + drag.y - drag.originY,
      width: drag.bounds.width,
      height: drag.bounds.height,
    }, visible)
    const candidate = candidateAt(drag) ?? candidateAt(drag, false)
    setDragged((previous) => {
      const sameTime = candidate && previous
        && candidate.day === previous.appointment.day && candidate.memberId === previous.appointment.memberId
        && candidate.startMinute === previous.appointment.startMinute && candidate.endMinute === previous.appointment.endMinute
      return {
        appointment: sameTime ? previous.appointment : candidate ?? previous?.appointment ?? drag.appointment,
        ...position,
        viewport: { left: visible.left, top: visible.top, width: visible.width, height: visible.height },
        width: drag.bounds.width,
        height: drag.bounds.height,
        returning: false,
      }
    })
  }
  const latest = useRef({ scrollTo, updateDragged })
  latest.current = { scrollTo, updateDragged }
  const stopAnimation = () => {
    if (animation.current !== null) cancelAnimationFrame(animation.current)
    animation.current = null
    lastFrame.current = null
  }
  const returnToOrigin = () => {
    const drag = active.current
    stopAnimation()
    active.current = null
    if (!drag?.moved) return
    onDraggingChange?.(false)
    const card = Array.from(drag.grid.querySelectorAll<HTMLElement>('[data-slot="calendar-member-lane"] [data-slot="calendar-appointment"]'))
      .find((card) => card.dataset.appointmentId === drag.appointment.id && card.closest<HTMLElement>('[data-slot="calendar-member-lane"]')?.dataset.day === drag.appointment.day)
    const bounds = card?.getBoundingClientRect() ?? drag.bounds
    const visible = viewportRef.current?.getBoundingClientRect()
    if (!visible) { setDragged(null); return }
    setDragged({
      appointment: drag.appointment,
      viewport: { left: visible.left, top: visible.top, width: visible.width, height: visible.height },
      left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height,
      returning: true,
    })
    returnTimer.current = setTimeout(() => {
      setDragged(null)
      returnTimer.current = null
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260)
  }
  useEffect(() => () => {
    stopAnimation()
    if (active.current?.moved) onDraggingChange?.(false)
    if (returnTimer.current !== null) clearTimeout(returnTimer.current)
  }, [])
  useLayoutEffect(() => {
    const motion = returnMotion?.current
    const viewport = viewportRef.current
    if (!motion || !viewport) return
    const appointment = conflictAppointments.find((appointment) => appointment.id === motion.appointmentId && !appointment.draft)
    if (!appointment) return
    returnMotion.current = null
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    setReturningPreviews((current) => [
      ...current.filter((item) => item.appointment.id !== appointment.id),
      { appointment, from: motion.bounds },
    ])
  }, [conflictAppointments, returnMotion, viewportRef])

  useEffect(() => {
    if (!dragged || dragged.returning) return
    const previous = document.body.style.cursor
    document.body.style.cursor = "grabbing"
    return () => { document.body.style.cursor = previous }
  }, [Boolean(dragged && !dragged.returning)])

  const scrollFrame = (time: number) => {
    animation.current = null
    const drag = active.current
    const viewport = viewportRef.current
    if (!drag?.moved || !viewport) return
    const visible = viewport.getBoundingClientRect()
    const preview = dragPreview.getSnapshot()
    if (preview && (preview.viewport.left !== visible.left || preview.viewport.top !== visible.top || preview.viewport.width !== visible.width || preview.viewport.height !== visible.height)) drag.needsUpdate = true
    const delta = getCalendarDragScrollDelta(drag, visible, lastFrame.current === null ? 16 : time - lastFrame.current)
    lastFrame.current = time
    const previousLeft = viewport.scrollLeft
    const previousTop = viewport.scrollTop
    const left = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, previousLeft + delta.left))
    const top = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, previousTop + delta.top))
    if (left !== previousLeft || top !== previousTop) {
      latest.current.scrollTo({ left, top })
      drag.needsUpdate = true
    }
    if (drag.needsUpdate) {
      drag.needsUpdate = false
      latest.current.updateDragged(drag)
    }
    animation.current = requestAnimationFrame(scrollFrame)
  }

  return {
    dragged,
    dragPreview,
    returningPreviews,
    finishPreviewReturn: (id: string) => setReturningPreviews((current) => current.filter((item) => item.appointment.id !== id)),
    gridProps: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        suppressClick.current = false
        if (returnTimer.current !== null || !onMove || event.button !== 0 || event.pointerType === "touch") return
        const card = (event.target as HTMLElement).closest<HTMLElement>('[data-slot="calendar-appointment"]')
        const lane = card?.closest<HTMLElement>('[data-slot="calendar-member-lane"]')
        const appointment = appointments.find((appointment) => appointment.id === card?.dataset.appointmentId && appointment.day === lane?.dataset.day)
        if (!appointment || appointment.movable === false || (appointment.draft && appointment.movable !== true) || (!appointment.creationDraft && !["PENDING", "CONFIRMED"].includes(appointment.status ?? "")) || !lane || !card) return
        active.current = { appointment, pointerId: event.pointerId, originX: event.clientX, originY: event.clientY, x: event.clientX, y: event.clientY, moved: false, needsUpdate: false, grid: event.currentTarget, bounds: card.getBoundingClientRect() }
        event.currentTarget.setPointerCapture(event.pointerId)
        event.preventDefault()
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const drag = active.current
        if (!drag || drag.pointerId !== event.pointerId) return
        drag.x = event.clientX
        drag.y = event.clientY
        if (!drag.moved && Math.hypot(drag.x - drag.originX, drag.y - drag.originY) < 5) return
        if (!drag.moved) {
          drag.moved = true
          onDraggingChange?.(true)
          updateDragged(drag)
          const member = members.find((member) => member.id === drag.appointment.memberId)
          if (member) onMove?.(drag.appointment, { member, day: drag.appointment.day, startMinute: drag.appointment.startMinute, endMinute: drag.appointment.endMinute }, "start")
        } else drag.needsUpdate = true
        suppressClick.current = true
        if (animation.current === null) animation.current = requestAnimationFrame(scrollFrame)
      },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
        const drag = active.current
        if (!drag || drag.pointerId !== event.pointerId) return
        // Commit the position the user last saw, including clamping and any edge scrolling.
        const candidate = drag.moved ? candidateAt(drag, true, dragPreview.getSnapshot()) : null
        const member = members.find((member) => member.id === candidate?.memberId)
        if (candidate && member) {
          stopAnimation()
          active.current = null
          setDragged(null)
          onDraggingChange?.(false)
          onMove?.(drag.appointment, { member, day: candidate.day, startMinute: candidate.startMinute, endMinute: candidate.endMinute }, "drop")
        } else if (drag.moved) {
          returnToOrigin()
        } else {
          active.current = null
          // Pointer capture targets the grid, so restore the card's normal click action
          event.currentTarget.querySelector<HTMLElement>(`[data-appointment-id="${CSS.escape(drag.appointment.id)}"]`)?.click()
        }
      },
      onPointerCancel: returnToOrigin,
      onLostPointerCapture: returnToOrigin,
      onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
        if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false }
      },
      onDragStart: (event: DragEvent<HTMLDivElement>) => { if (onMove) event.preventDefault() },
    },
  }
}
