import type { CalendarBookingDragUpdate, CalendarBookingPreview, CalendarBookingReturnMotion, CalendarDragSelection } from "~/lib/calendar/types"
import { createContext, useCallback, useLayoutEffect, useContext, useRef, useState, type Dispatch, type ReactNode, type SetStateAction, type RefObject } from "react"

import { useLocation, useNavigation } from "react-router"

import { createCalendarBookingDragPreview, type CalendarBookingDragPreviewStore } from "~/lib/calendar/booking-drag-preview"
import { createCalendarPreviewScrollState, type CalendarPreviewScrollState } from "~/lib/calendar/preview-scroll"

export const CalendarBookingPreviewContext = createContext<{
  liveDragPreview?: CalendarBookingDragPreviewStore
  dragging?: boolean
  setDragging?: Dispatch<SetStateAction<boolean>>
  preview: CalendarBookingPreview | null
  setPreview: Dispatch<SetStateAction<CalendarBookingPreview | null>>
  clearPreview?: (options: { animate: boolean }) => void
  returnMotion?: RefObject<CalendarBookingReturnMotion | null>
  scrollState?: CalendarPreviewScrollState
  dragUpdate?: CalendarBookingDragUpdate | null
  setDragUpdate?: Dispatch<SetStateAction<CalendarBookingDragUpdate | null>>
}>({ preview: null, setPreview: () => {} })

export function CalendarBookingPreviewProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigation = useNavigation()
  const previousPath = useRef(location.pathname)
  const [dragging, setDragging] = useState(false)
  const [liveDragPreview] = useState(createCalendarBookingDragPreview)
  const [dragUpdate, setDragUpdate] = useState<CalendarBookingDragUpdate | null>(null)
  const [preview, updatePreview] = useState<CalendarBookingPreview | null>(null)
  const currentPreview = useRef<CalendarBookingPreview | null>(null)
  const returnMotion = useRef<CalendarBookingReturnMotion | null>(null)
  const skipReturnMotion = useRef(false)
  const [scrollState] = useState(createCalendarPreviewScrollState)
  const setPreview = useCallback<Dispatch<SetStateAction<CalendarBookingPreview | null>>>((value) => {
    const previous = currentPreview.current
    const next = typeof value === "function" ? value(previous) : value
    if (!previous && next) {
      returnMotion.current = null
      scrollState.startPreview()
    }
    if (previous?.appointmentId && previous.appointmentId !== next?.appointmentId && !skipReturnMotion.current) {
      const card = document.querySelector<HTMLElement>(`[data-slot="calendar-member-lane"] [data-appointment-id="${CSS.escape(previous.appointmentId)}"]`)
      if (card) {
        const { left, top, width, height } = card.getBoundingClientRect()
        returnMotion.current = { appointmentId: previous.appointmentId, bounds: { left, top, width, height } }
      }
    }
    if (previous && !next) scrollState.finishPreview()
    currentPreview.current = next
    updatePreview(next)
  }, [scrollState])

  const clearPreview = useCallback(({ animate }: { animate: boolean }) => {
    skipReturnMotion.current = !animate
    if (!animate) returnMotion.current = null
    setPreview(null)
    skipReturnMotion.current = false
  }, [setPreview])

  useLayoutEffect(() => {
    if (previousPath.current === location.pathname) return
    previousPath.current = location.pathname
    const stillEditing = (appointmentId?: string) => {
      const path = appointmentId ? `/calendar/${encodeURIComponent(appointmentId)}/edit` : "/calendar/new"
      return location.pathname === path || navigation.location?.pathname === path
    }
    const current = currentPreview.current
    if (current && !stillEditing(current.appointmentId)) setPreview(null)
    setDragUpdate((current) => current && !stillEditing(current.appointmentId) ? null : current)
  }, [location.pathname, navigation.location?.pathname, setPreview])

  return <CalendarBookingPreviewContext.Provider value={{ liveDragPreview, dragging, setDragging, preview, setPreview, clearPreview, returnMotion, scrollState, dragUpdate, setDragUpdate }}>{children}</CalendarBookingPreviewContext.Provider>
}

export function useCalendarBookingPreview() {
  return useContext(CalendarBookingPreviewContext)
}
