import { canRescheduleAppointment } from "~/lib/booking/appointment-status"
import type { CalendarAppointment, CalendarBookingReturnMotion, CalendarDragSelection, CalendarMember, CalendarUnavailableTime } from "~/lib/calendar/types"
import { startTransition, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type MouseEvent, type DragEvent, type RefObject, type SetStateAction } from "react"
import { flushSync } from "react-dom"

import { calendarIntervalMinutes, calendarMinDurationMinutes } from "~/lib/calendar/time-step"
import { createCalendarBookingDragPreview, type CalendarBookingDragPreview, type CalendarBookingDragPreviewStore } from "~/lib/calendar/booking-drag-preview"
import { getCalendarBookingConflicts } from "~/lib/calendar/appointments"
import { getCalendarBookingDragPosition, getCalendarBookingDragRange, getCalendarBookingResizeRange, getCalendarDragScrollDelta, type CalendarBookingDragPhase } from "~/lib/calendar/booking-drag"
import { startCalendarTouchDrag } from "~/lib/calendar/touch-drag"
import { calendarBookingReturnDuration } from "~/lib/calendar/booking-return"

type DragBounds = Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">
type DragGeometry = { viewport: DragBounds; scrollLeft: number; scrollTop: number; lanes: { lane: HTMLElement; bounds: DragBounds }[] }
type ActiveDrag = { geometry: DragGeometry | null; mode: "move" | "resize"; laneOffset: number; laneWidthRatio: number; appointment: CalendarAppointment; touch: boolean; pointerId: number; originX: number; originY: number; x: number; y: number; moved: boolean; needsUpdate: boolean; grid: HTMLDivElement; source: HTMLElement; bounds: DOMRect }

export function useCalendarBookingDrag({ appointments, conflictAppointments = appointments, members, unavailableTimes, startMinute, endMinute, timeZone, allowSimultaneousBookings, viewportRef, viewportInsets = { left: 0, top: 0 }, scrollTo, onMove, returnMotion, onDraggingChange, getBookingIssues, liveDragPreview, getDraftService, serviceDurations, intervalMinutes = calendarIntervalMinutes, minDurationMinutes = calendarMinDurationMinutes, horizontal = false }: {
  viewportInsets?: { left: number; top: number }
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
  const getViewportBounds = () => {
    const bounds = viewportRef.current?.getBoundingClientRect()
    if (!bounds) return
    const left = Math.min(bounds.width, viewportInsets.left)
    const top = Math.min(bounds.height, viewportInsets.top)
    return { left: bounds.left + left, top: bounds.top + top, right: bounds.right, bottom: bounds.bottom, width: bounds.width - left, height: bounds.height - top }
  }
  const bookingConflicts = getCalendarBookingConflicts(conflictAppointments, allowSimultaneousBookings)
  const active = useRef<ActiveDrag | null>(null)
  const touchCleanup = useRef<(() => void) | null>(null)
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
    const visible = visibleBounds ?? getViewportBounds()
    if (!visible) return null
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
      snapToInterval: true,
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
    const visible = visibleBounds ?? getViewportBounds()
    if (!visible) return
    const position = getCalendarBookingDragPosition({
      left: drag.bounds.left + drag.x - drag.originX,
      top: drag.bounds.top + drag.y - drag.originY,
      width: drag.bounds.width,
      height: drag.bounds.height,
    }, visible)
    const positionCandidate = candidateAt(drag, true, undefined, visible) ?? candidateAt(drag, false, undefined, visible)
    const candidate = positionCandidate && getBookingIssues ? { ...positionCandidate, availabilityIssues: getBookingIssues(positionCandidate) } : positionCandidate
    const lane = candidate ? getDragLanes(drag, visible)
      .find(({ lane }) => lane.dataset.day === candidate.day && lane.dataset.memberId === candidate.memberId)?.bounds : null
    const snappedPosition = lane && candidate ? appointmentBounds(lane, candidate, drag) : null
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
        ...snappedPosition,
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
    touchCleanup.current?.()
    touchCleanup.current = null
    restorePointerCursor()
    if (panelUpdateTimer.current !== null) clearTimeout(panelUpdateTimer.current)
    panelUpdateTimer.current = null
    pendingPanelUpdate.current = null
    if (animation.current !== null) cancelAnimationFrame(animation.current)
    animation.current = null
    lastFrame.current = null
  }
  const finishSettling = () => {
    if (animation.current !== null) cancelAnimationFrame(animation.current)
    animation.current = null
    if (returnTimer.current !== null) clearTimeout(returnTimer.current)
    returnTimer.current = null
    setDragged(null)
  }
  const watchSettlingLayout = () => {
    animation.current = null
    const preview = dragPreview.getSnapshot()
    if (!preview?.returning) return
    const visible = getViewportBounds()
    // The grid card already follows the new columns, while the overlay holds pixel bounds
    if (!visible || visible.left !== preview.viewport.left || visible.top !== preview.viewport.top
      || visible.width !== preview.viewport.width || visible.height !== preview.viewport.height) {
      finishSettling()
      return
    }
    animation.current = requestAnimationFrame(watchSettlingLayout)
  }
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!dragged?.returning || !viewport) return
    const observer = new ResizeObserver(() => {
      const preview = dragPreview.getSnapshot()
      const visible = getViewportBounds()
      if (!preview?.returning || !visible) return
      if (visible.width !== preview.viewport.width || visible.height !== preview.viewport.height) {
        // ResizeObserver runs before paint: reveal the responsive grid card in this frame
        flushSync(finishSettling)
      }
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [dragged?.returning, dragPreview, viewportRef])
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
    const visible = getViewportBounds()
    if (!visible) { setDragged(null); return }
    setDragged({
      appointment: drag.appointment,
      viewport: { left: visible.left, top: visible.top, width: visible.width, height: visible.height },
      left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height,
      returning: true,
    })
    animation.current = requestAnimationFrame(watchSettlingLayout)
    returnTimer.current = setTimeout(finishSettling, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : calendarBookingReturnDuration)
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
    const visible = getViewportBounds()
    if (!visible) return
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

  const moveDrag = (drag: ActiveDrag, x: number, y: number) => {
    drag.x = x
    drag.y = y
    if (!drag.moved && (drag.mode === "resize" ? Math.abs(horizontal ? drag.x - drag.originX : drag.y - drag.originY) : Math.hypot(drag.x - drag.originX, drag.y - drag.originY)) < 5) return
    if (!drag.moved) {
      beginDrag(drag)
      updateDragged(drag)
    } else drag.needsUpdate = true
    suppressClick.current = true
    if (animation.current === null) animation.current = requestAnimationFrame(scrollFrame)
  }
  const finishDrag = (drag: ActiveDrag, x: number, y: number) => {
    touchCleanup.current?.()
    touchCleanup.current = null
    restorePointerCursor()
    if (drag.touch && !drag.moved) {
      active.current = null
      return
    }
    if (!drag.moved && (drag.mode === "resize" ? Math.abs(horizontal ? x - drag.originX : y - drag.originY) : Math.hypot(x - drag.originX, y - drag.originY)) >= 5) {
      beginDrag(drag)
      drag.needsUpdate = true
    }
    // A release can arrive before the final pointer move's animation frame
    if (drag.moved && (drag.needsUpdate || drag.x !== x || drag.y !== y)) {
      drag.x = x
      drag.y = y
      drag.needsUpdate = false
      latest.current.updateDragged(drag)
    }
    const candidate = drag.moved ? candidateAt(drag, true, dragPreview.getSnapshot()) : null
    const member = members.find((member) => member.id === candidate?.memberId)
    if (candidate && member) {
      stopAnimation()
      active.current = null
      const preview = dragPreview.getSnapshot()
      const visible = getViewportBounds()
      const lane = visible ? getDragLanes(drag, visible).find(({ lane }) => lane.dataset.day === candidate.day && lane.dataset.memberId === candidate.memberId)?.bounds : null
      if (preview && lane && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setDragged({ ...preview, appointment: candidate, ...appointmentBounds(lane, candidate, drag), returning: true })
        animation.current = requestAnimationFrame(watchSettlingLayout)
        returnTimer.current = setTimeout(finishSettling, calendarBookingReturnDuration)
      } else setDragged(null)
      onDraggingChange?.(false)
      onMove?.(drag.appointment, { member, day: candidate.day, startMinute: candidate.startMinute, endMinute: candidate.endMinute }, "drop")
    } else if (drag.moved) {
      returnToOrigin()
    } else {
      active.current = null
      // Pointer capture targets the grid, so restore the card's normal click action
      drag.grid.querySelector<HTMLElement>(`[data-slot="calendar-appointment"][data-appointment-id="${CSS.escape(drag.appointment.id)}"]`)?.click()
    }
  }

  const gestureHandlers = useRef({ appointments, onMove, beginDrag, moveDrag, finishDrag, returnToOrigin })
  gestureHandlers.current = { appointments, onMove, beginDrag, moveDrag, finishDrag, returnToOrigin }

  return {
    dragged,
    dragPreview,
    returningPreviews,
    finishPreviewReturn: (id: string) => setReturningPreviews((current) => current.filter((item) => item.appointment.id !== id)),
    gridProps: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (active.current) {
          if (event.pointerType === "touch") returnToOrigin()
          return
        }
        suppressClick.current = false
        if (!onMove || event.button !== 0 || event.isPrimary === false) return
        const card = (event.target as HTMLElement).closest<HTMLElement>('[data-slot="calendar-appointment"]')
        const lane = card?.closest<HTMLElement>('[data-slot="calendar-member-lane"]')
        const appointment = appointments.find((appointment) => appointment.id === card?.dataset.appointmentId && appointment.day === lane?.dataset.day)
        if (!appointment || appointment.movable === false || (appointment.draft && appointment.movable !== true) || (!appointment.creationDraft && !canRescheduleAppointment(appointment.status ?? "")) || !lane || !card) return
        const mode = (event.target as HTMLElement).closest('[data-slot="calendar-booking-resize-handle"]') ? "resize" : "move"
        if (mode === "resize" && ((appointment.durationMinutes ?? appointment.endMinute - appointment.startMinute) !== appointment.endMinute - appointment.startMinute || appointment.startMinute < startMinute || appointment.endMinute > endMinute)) return
        if (returnTimer.current !== null || dragPreview.getSnapshot()?.returning) finishSettling()
        setReturningPreviews((current) => current.some((item) => item.appointment.id === appointment.id) ? current.filter((item) => item.appointment.id !== appointment.id) : current)
        const bounds = card.getBoundingClientRect()
        const laneBounds = lane.getBoundingClientRect()
        active.current = { geometry: null, mode, laneOffset: horizontal ? (bounds.top - laneBounds.top - 4) / laneBounds.height : (bounds.left - laneBounds.left - 4) / laneBounds.width, laneWidthRatio: horizontal ? (bounds.height + 8) / laneBounds.height : (bounds.width + 8) / laneBounds.width, appointment, touch: event.pointerType === "touch", pointerId: event.pointerId, originX: event.clientX, originY: event.clientY, x: event.clientX, y: event.clientY, moved: false, needsUpdate: false, grid: event.currentTarget, source: card, bounds }
        if (active.current.touch) {
          const drag = active.current
          touchCleanup.current = startCalendarTouchDrag({
            element: drag.grid,
            origin: { x: drag.originX, y: drag.originY },
            activationDelay: mode === "resize" ? 0 : 450,
            onActivate: () => {
              if (active.current !== drag) return
              const handlers = gestureHandlers.current
              const current = handlers.appointments.find((appointment) => appointment.id === drag.appointment.id && appointment.day === drag.appointment.day)
              if (!handlers.onMove || !current || current.movable === false || (current.draft && current.movable !== true) || (!current.creationDraft && !canRescheduleAppointment(current.status ?? ""))) {
                handlers.returnToOrigin()
                return
              }
              const source = drag.source.isConnected ? drag.source : Array.from(drag.grid.querySelectorAll<HTMLElement>('[data-slot="calendar-appointment"]'))
                .find((card) => card.dataset.appointmentId === current.id && card.closest<HTMLElement>('[data-slot="calendar-member-lane"]')?.dataset.day === current.day)
              const lane = source?.closest<HTMLElement>('[data-slot="calendar-member-lane"]')
              if (!source || !lane) { handlers.returnToOrigin(); return }
              const bounds = source.getBoundingClientRect()
              const laneBounds = lane.getBoundingClientRect()
              if (!bounds.width || !bounds.height || !laneBounds.width || !laneBounds.height) { handlers.returnToOrigin(); return }
              drag.appointment = current
              drag.source = source
              drag.bounds = bounds
              drag.geometry = null
              drag.laneOffset = horizontal ? (bounds.top - laneBounds.top - 4) / laneBounds.height : (bounds.left - laneBounds.left - 4) / laneBounds.width
              drag.laneWidthRatio = horizontal ? (bounds.height + 8) / laneBounds.height : (bounds.width + 8) / laneBounds.width
              handlers.beginDrag(drag)
              latest.current.updateDragged(drag)
              animation.current = requestAnimationFrame(scrollFrame)
            },
            onMove: ({ x, y }) => { if (active.current === drag) gestureHandlers.current.moveDrag(drag, x, y) },
            onEnd: ({ x, y }) => { if (active.current === drag) gestureHandlers.current.finishDrag(drag, x, y) },
            onCancel: () => { if (active.current === drag) gestureHandlers.current.returnToOrigin() },
          })
          return
        }
        restorePointerCursor()
        pointerCursor.current = { element: event.currentTarget, cursor: event.currentTarget.style.cursor }
        event.currentTarget.style.cursor = mode === "resize" ? horizontal ? "ew-resize" : "ns-resize" : "grabbing"
        event.currentTarget.setPointerCapture(event.pointerId)
        event.preventDefault()
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const drag = active.current
        if (drag && !drag.touch && drag.pointerId === event.pointerId) moveDrag(drag, event.clientX, event.clientY)
      },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
        const drag = active.current
        if (drag && !drag.touch && drag.pointerId === event.pointerId) finishDrag(drag, event.clientX, event.clientY)
      },
      onPointerCancel: () => { if (!active.current?.touch) returnToOrigin() },
      onLostPointerCapture: () => { if (!active.current?.touch) returnToOrigin() },
      onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
        if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false }
      },
      onContextMenu: (event: MouseEvent<HTMLDivElement>) => {
        if (active.current?.touch) event.preventDefault()
      },
      onDragStart: (event: DragEvent<HTMLDivElement>) => { if (onMove) event.preventDefault() },
    },
  }
}
