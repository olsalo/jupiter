import type { CalendarAppointment, CalendarBookingReturnMotion, CalendarDragSelection, CalendarMember, CalendarUnavailableTime } from "~/lib/calendar/types"
import { startTransition, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type MouseEvent, type DragEvent, type RefObject, type SetStateAction } from "react"

import { calendarIntervalMinutes, calendarMinDurationMinutes } from "~/lib/calendar/time-step"
import { createCalendarBookingDragPreview, type CalendarBookingDragPreview, type CalendarBookingDragPreviewStore } from "~/lib/calendar/booking-drag-preview"
import { getCalendarBookingConflicts } from "~/lib/calendar/appointments"
import { getCalendarBookingDragPosition, getCalendarBookingDragRange, getCalendarBookingResizeRange, getCalendarDragScrollDelta, type CalendarBookingDragPhase } from "~/lib/calendar/booking-drag"
import { calendarBookingReturnDuration } from "~/lib/calendar/booking-return"

type DragBounds = Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">
type DragGeometry = { viewport: DragBounds; scrollLeft: number; scrollTop: number; lanes: { lane: HTMLElement; bounds: DragBounds }[] }
type ActiveDrag = { geometry: DragGeometry | null; mode: "move" | "resize"; laneOffset: number; laneWidthRatio: number; appointment: CalendarAppointment; pointerId: number; originX: number; originY: number; x: number; y: number; moved: boolean; needsUpdate: boolean; grid: HTMLDivElement; bounds: DOMRect }

export function useCalendarBookingDrag({ appointments, conflictAppointments = appointments, members, unavailableTimes, startMinute, endMinute, timeZone, allowSimultaneousBookings, viewportRef, scrollTo, onMove, returnMotion, onDraggingChange, getBookingIssues, liveDragPreview, getDraftService, serviceDurations, intervalMinutes = calendarIntervalMinutes, minDurationMinutes = calendarMinDurationMinutes, horizontal = false }: {
  getBookingIssues?: (appointment: CalendarAppointment) => CalendarAppointment["availabilityIssues"]
  liveDragPreview?: CalendarBookingDragPreviewStore
  getDraftService?: (length: number) => CalendarAppointment["service"] | undefined
  serviceDurations?: readonly number[]
  intervalMinutes?: number
  minDurationMinutes?: number
  horizontal?: boolean
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
  onMove?: (appointment: CalendarAppointment, selection: CalendarDragSelection, phase: CalendarBookingDragPhase) => void
}) {
  const bookingConflicts = getCalendarBookingConflicts(conflictAppointments, allowSimultaneousBookings)
  const active = useRef<ActiveDrag | null>(null)
  const pointerCursor = useRef<{ element: HTMLDivElement; cursor: string } | null>(null)
  const restorePointerCursor = () => {
    if (!pointerCursor.current) return
    pointerCursor.current.element.style.cursor = pointerCursor.current.cursor
    pointerCursor.current = null
  }
  const suppressClick = useRef(false)
  const animation = useRef<number | null>(null)
  const lastFrame = useRef<number | null>(null)
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPanelUpdate = useRef<{ drag: ActiveDrag; selection: CalendarDragSelection } | null>(null)
  const moveHandler = useRef(onMove)
  moveHandler.current = onMove
  const publishPanelUpdate = () => {
    panelUpdateTimer.current = null
    const pending = pendingPanelUpdate.current
    pendingPanelUpdate.current = null
    if (!pending || active.current !== pending.drag) return
    startTransition(() => moveHandler.current?.(pending.drag.appointment, pending.selection, "move"))
  }
  const queuePanelUpdate = (drag: ActiveDrag, selection: CalendarDragSelection) => {
    pendingPanelUpdate.current = { drag, selection }
    // Rebuild the form only after movement pauses, never repeatedly during a fast drag
    if (panelUpdateTimer.current !== null) clearTimeout(panelUpdateTimer.current)
    panelUpdateTimer.current = setTimeout(publishPanelUpdate, 120)
  }
  const [returningPreviews, setReturningPreviews] = useState<{ appointment: CalendarAppointment; from: CalendarBookingReturnMotion["bounds"] }[]>([])
  const [localDragPreview] = useState(createCalendarBookingDragPreview)
  const dragPreview = liveDragPreview ?? localDragPreview
  const [dragged, setDragState] = useState<CalendarBookingDragPreview | null>(null)
  const setDragged = (value: SetStateAction<CalendarBookingDragPreview | null>) => {
    const previous = dragPreview.getSnapshot()
    const next = typeof value === "function" ? value(previous) : value
    if (previous?.appointment.id !== next?.appointment.id || previous?.returning !== next?.returning) setDragState(next)
    dragPreview.setSnapshot(next)
  }
  useLayoutEffect(() => {
    // React updates may change the lane layout, but pointer frames do not
    if (active.current) active.current.geometry = null
  })
  const getDragLanes = (drag: ActiveDrag, visible: DragBounds) => {
    const viewport = viewportRef.current
    if (!viewport) return []
    let geometry = drag.geometry
    if (!geometry || geometry.viewport.left !== visible.left || geometry.viewport.top !== visible.top
      || geometry.viewport.width !== visible.width || geometry.viewport.height !== visible.height) {
      geometry = {
        viewport: visible, scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop,
        lanes: Array.from(drag.grid.querySelectorAll<HTMLElement>('[data-slot="calendar-member-lane"]')).map((lane) => ({ lane, bounds: lane.getBoundingClientRect() })),
      }
      drag.geometry = geometry
    }
    const left = geometry.scrollLeft - viewport.scrollLeft
    const top = geometry.scrollTop - viewport.scrollTop
    if (left === 0 && top === 0) return geometry.lanes
    return geometry.lanes.map(({ lane, bounds }) => ({ lane, bounds: {
      left: bounds.left + left, right: bounds.right + left, top: bounds.top + top, bottom: bounds.bottom + top, width: bounds.width, height: bounds.height,
    } }))
  }
  const candidateAt = (drag: ActiveDrag, validate = true, displayed?: CalendarBookingDragPreview | null, visibleBounds?: DragBounds) => {
    const viewport = viewportRef.current
    if (!viewport) return null
    const visible = visibleBounds ?? viewport.getBoundingClientRect()
    const position = displayed ?? getCalendarBookingDragPosition({
      left: drag.bounds.left + drag.x - drag.originX,
      top: drag.bounds.top + drag.y - drag.originY,
      width: drag.bounds.width,
      height: drag.bounds.height,
    }, visible)
    // Choose the member from the block center and time from its leading edge.
    const y = Math.max(visible.top + 1, Math.min(visible.bottom - 1, position.top + (displayed?.height ?? drag.bounds.height) / 2))
    const x = Math.max(visible.left + 1, Math.min(visible.right - 1, position.left + (displayed?.width ?? drag.bounds.width) / 2))
    // At an outside release the block may sit over calendar padding or a scrollbar.
    // Resolve its lane geometrically so those edges behave like the calendar interior.
    const target = getDragLanes(drag, visible)
      .filter(({ lane }) => drag.mode !== "resize" || (lane.dataset.day === drag.appointment.day && lane.dataset.memberId === drag.appointment.memberId))
      .filter(({ bounds }) => horizontal ? bounds.bottom > visible.top && bounds.top < visible.bottom : bounds.right > visible.left && bounds.left < visible.right)
      .map((target) => ({ ...target, distance: horizontal ? Math.max(target.bounds.top - y, y - target.bounds.bottom, 0) : Math.max(target.bounds.left - x, x - target.bounds.right, 0) }))
      .sort((a, b) => a.distance - b.distance)[0]
    const lane = target?.lane
    const member = members.find((member) => member.id === lane?.dataset.memberId)
    if (!lane || !member || !lane.dataset.day || !target) return null
    const bounds = target.bounds
    const day = lane.dataset.day
    const conflicts = bookingConflicts.filter((appointment) => appointment.id !== drag.appointment.id && appointment.day === day && appointment.memberId === member.id).map((appointment) => ({
      startMinute: appointment.startMinute - (appointment.bufferBeforeMinutes ?? 0),
      endMinute: appointment.endMinute + (appointment.bufferAfterMinutes ?? 0),
    }))
    const buffers = { beforeMinutes: drag.appointment.bufferBeforeMinutes ?? 0, afterMinutes: drag.appointment.bufferAfterMinutes ?? 0 }
    if (drag.mode === "resize") {
      const minute = displayed?.appointment.endMinute ?? startMinute + (horizontal ? (Math.max(visible.left, Math.min(visible.right, drag.x)) + drag.bounds.right + 2 - drag.originX - bounds.left) / bounds.width : (Math.max(visible.top, Math.min(visible.bottom, drag.y)) + drag.bounds.bottom + 4 - drag.originY - bounds.top) / bounds.height) * (endMinute - startMinute)
      const range = getCalendarBookingResizeRange({
        ...buffers, serviceDurations, serviceDurationMinutes: drag.appointment.durationMinutes ?? drag.appointment.endMinute - drag.appointment.startMinute,
        intervalMinutes, minDurationMinutes, minute, bookingStartMinute: drag.appointment.startMinute, startMinute, endMinute,
        blocked: validate ? [...unavailableTimes.filter((range) => range.day === day && range.memberId === member.id), ...conflicts] : [],
      })
      if (!range) return null
      const duration = range.endMinute - range.startMinute
      const service = drag.appointment.creationDraft && getDraftService && duration !== drag.appointment.endMinute - drag.appointment.startMinute
        ? getDraftService(duration) ?? { id: "", name: "", color: "#808080" }
        : drag.appointment.service
      return { ...drag.appointment, ...range, service, durationMinutes: duration, draft: true }
    }
    const range = getCalendarBookingDragRange({
      snapToInterval: drag.appointment.creationDraft === true,
      ...buffers, intervalMinutes, minDurationMinutes,
      minute: startMinute + (horizontal ? (position.left - bounds.left - 2) / bounds.width : (position.top - bounds.top) / bounds.height) * (endMinute - startMinute),
      offset: 0,
      durationMinutes: drag.appointment.durationMinutes ?? drag.appointment.endMinute - drag.appointment.startMinute,
      startMinute, endMinute,
      blocked: validate ? [
        ...unavailableTimes.filter((range) => range.day === day && range.memberId === member.id),
        ...conflicts,
      ] : [],
      snapAround: validate ? conflicts : [],
    })
    if (!range) return null
    return { ...drag.appointment, ...range, memberId: member.id, day, draft: true }
  }
  const appointmentBounds = (lane: DragBounds | DOMRect, appointment: CalendarAppointment, drag: ActiveDrag) => horizontal ? {
    left: lane.left + (appointment.startMinute - startMinute) / (endMinute - startMinute) * lane.width + 2,
    top: lane.top + lane.height * drag.laneOffset + 4,
    width: (appointment.endMinute - appointment.startMinute) / (endMinute - startMinute) * lane.width - 4,
    height: lane.height * drag.laneWidthRatio - 8,
  } : {
    left: lane.left + lane.width * drag.laneOffset + 4,
    top: lane.top + (appointment.startMinute - startMinute) / (endMinute - startMinute) * lane.height,
    width: lane.width * drag.laneWidthRatio - 8,
    height: (appointment.endMinute - appointment.startMinute) / (endMinute - startMinute) * lane.height - 4,
  }
  const updateDragged = (drag: ActiveDrag, visibleBounds?: DragBounds) => {
    const visible = visibleBounds ?? viewportRef.current?.getBoundingClientRect()
    if (!visible) return
    const position = getCalendarBookingDragPosition({
      left: drag.bounds.left + drag.x - drag.originX,
      top: drag.bounds.top + drag.y - drag.originY,
      width: drag.bounds.width,
      height: drag.bounds.height,
    }, visible)
    const positionCandidate = candidateAt(drag, true, undefined, visible) ?? candidateAt(drag, false, undefined, visible)
    const candidate = positionCandidate && getBookingIssues ? { ...positionCandidate, availabilityIssues: getBookingIssues(positionCandidate) } : positionCandidate
    const lane = drag.mode === "resize" ? getDragLanes(drag, visible)
      .find(({ lane }) => lane.dataset.day === drag.appointment.day && lane.dataset.memberId === drag.appointment.memberId)?.bounds : null
    const resizedPosition = lane && candidate ? appointmentBounds(lane, candidate, drag) : null
    const previous = dragPreview.getSnapshot()
    const sameTime = candidate && previous
      && candidate.day === previous.appointment.day && candidate.memberId === previous.appointment.memberId
      && candidate.startMinute === previous.appointment.startMinute && candidate.endMinute === previous.appointment.endMinute
      && candidate.service.id === previous.appointment.service.id && candidate.service.color === previous.appointment.service.color && candidate.service.name === previous.appointment.service.name
    setDragged(() => {
      return {
        appointment: sameTime ? previous.appointment : candidate ?? previous?.appointment ?? drag.appointment,
        ...position,
        viewport: { left: visible.left, top: visible.top, width: visible.width, height: visible.height },
        width: drag.bounds.width,
        height: drag.bounds.height,
        ...resizedPosition,
        returning: false,
        resizing: drag.mode === "resize",
      }
    })
    if (candidate && !sameTime) {
      const member = members.find((member) => member.id === candidate.memberId)
      if (member) queuePanelUpdate(drag, { member, day: candidate.day, startMinute: candidate.startMinute, endMinute: candidate.endMinute })
    }
  }
  const latest = useRef({ scrollTo, updateDragged })
  latest.current = { scrollTo, updateDragged }
  const stopAnimation = () => {
    restorePointerCursor()
    if (panelUpdateTimer.current !== null) clearTimeout(panelUpdateTimer.current)
    panelUpdateTimer.current = null
    pendingPanelUpdate.current = null
    if (animation.current !== null) cancelAnimationFrame(animation.current)
    animation.current = null
    lastFrame.current = null
  }
  const returnToOrigin = () => {
    const drag = active.current
    stopAnimation()
    active.current = null
    if (!drag?.moved) return
    const member = members.find((member) => member.id === drag.appointment.memberId)
    if (member) onMove?.(drag.appointment, { member, day: drag.appointment.day, startMinute: drag.appointment.startMinute, endMinute: drag.appointment.endMinute }, "cancel")
    onDraggingChange?.(false)
    const lane = Array.from(drag.grid.querySelectorAll<HTMLElement>('[data-slot="calendar-member-lane"]'))
      .find((lane) => lane.dataset.day === drag.appointment.day && lane.dataset.memberId === drag.appointment.memberId)?.getBoundingClientRect()
    const bounds = lane ? appointmentBounds(lane, drag.appointment, drag) : drag.bounds
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
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : calendarBookingReturnDuration)
  }
  useEffect(() => () => {
    stopAnimation()
    dragPreview.setSnapshot(null)
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
    document.body.style.cursor = dragged.resizing ? horizontal ? "ew-resize" : "ns-resize" : "grabbing"
    return () => { document.body.style.cursor = previous }
  }, [Boolean(dragged && !dragged.returning), dragged?.resizing])

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
    const left = drag.mode === "resize" && !horizontal ? previousLeft : Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, previousLeft + delta.left))
    const top = drag.mode === "resize" && horizontal ? previousTop : Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, previousTop + delta.top))
    if (left !== previousLeft || top !== previousTop) {
      latest.current.scrollTo({ left, top })
      drag.needsUpdate = true
    }
    if (drag.needsUpdate) {
      drag.needsUpdate = false
      latest.current.updateDragged(drag, visible)
    }
    animation.current = requestAnimationFrame(scrollFrame)
  }

  const beginDrag = (drag: ActiveDrag) => {
    drag.moved = true
    suppressClick.current = true
    onDraggingChange?.(true)
    const member = members.find((member) => member.id === drag.appointment.memberId)
    if (member) onMove?.(drag.appointment, { member, day: drag.appointment.day, startMinute: drag.appointment.startMinute, endMinute: drag.appointment.endMinute }, "start")
  }

  return {
    dragged,
    dragPreview,
    returningPreviews,
    finishPreviewReturn: (id: string) => setReturningPreviews((current) => current.filter((item) => item.appointment.id !== id)),
    gridProps: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        suppressClick.current = false
        if (!onMove || event.button !== 0 || event.pointerType === "touch") return
        const card = (event.target as HTMLElement).closest<HTMLElement>('[data-slot="calendar-appointment"]')
        const lane = card?.closest<HTMLElement>('[data-slot="calendar-member-lane"]')
        const appointment = appointments.find((appointment) => appointment.id === card?.dataset.appointmentId && appointment.day === lane?.dataset.day)
        if (!appointment || appointment.movable === false || (appointment.draft && appointment.movable !== true) || (!appointment.creationDraft && !["PENDING", "CONFIRMED"].includes(appointment.status ?? "")) || !lane || !card) return
        const mode = (event.target as HTMLElement).closest('[data-slot="calendar-booking-resize-handle"]') ? "resize" : "move"
        if (mode === "resize" && ((appointment.durationMinutes ?? appointment.endMinute - appointment.startMinute) !== appointment.endMinute - appointment.startMinute || appointment.startMinute < startMinute || appointment.endMinute > endMinute)) return
        if (returnTimer.current !== null) {
          clearTimeout(returnTimer.current)
          returnTimer.current = null
          setDragged(null)
        }
        setReturningPreviews((current) => current.some((item) => item.appointment.id === appointment.id) ? current.filter((item) => item.appointment.id !== appointment.id) : current)
        const bounds = card.getBoundingClientRect()
        const laneBounds = lane.getBoundingClientRect()
        active.current = { geometry: null, mode, laneOffset: horizontal ? (bounds.top - laneBounds.top - 4) / laneBounds.height : (bounds.left - laneBounds.left - 4) / laneBounds.width, laneWidthRatio: horizontal ? (bounds.height + 8) / laneBounds.height : (bounds.width + 8) / laneBounds.width, appointment, pointerId: event.pointerId, originX: event.clientX, originY: event.clientY, x: event.clientX, y: event.clientY, moved: false, needsUpdate: false, grid: event.currentTarget, bounds }
        restorePointerCursor()
        pointerCursor.current = { element: event.currentTarget, cursor: event.currentTarget.style.cursor }
        event.currentTarget.style.cursor = mode === "resize" ? horizontal ? "ew-resize" : "ns-resize" : "grabbing"
        event.currentTarget.setPointerCapture(event.pointerId)
        event.preventDefault()
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const drag = active.current
        if (!drag || drag.pointerId !== event.pointerId) return
        drag.x = event.clientX
        drag.y = event.clientY
        if (!drag.moved && (drag.mode === "resize" ? Math.abs(horizontal ? drag.x - drag.originX : drag.y - drag.originY) : Math.hypot(drag.x - drag.originX, drag.y - drag.originY)) < 5) return
        if (!drag.moved) {
          beginDrag(drag)
          updateDragged(drag)
        } else drag.needsUpdate = true
        suppressClick.current = true
        if (animation.current === null) animation.current = requestAnimationFrame(scrollFrame)
      },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
        const drag = active.current
        if (!drag || drag.pointerId !== event.pointerId) return
        restorePointerCursor()
        if (!drag.moved && (drag.mode === "resize" ? Math.abs(horizontal ? event.clientX - drag.originX : event.clientY - drag.originY) : Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY)) >= 5) {
          beginDrag(drag)
          drag.needsUpdate = true
        }
        // A release can arrive before the final pointer move's animation frame
        if (drag.moved && (drag.needsUpdate || drag.x !== event.clientX || drag.y !== event.clientY)) {
          drag.x = event.clientX
          drag.y = event.clientY
          drag.needsUpdate = false
          latest.current.updateDragged(drag)
        }
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
