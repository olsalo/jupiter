import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useLocation, useNavigation } from "react-router"
import { createRouteSheetState } from "~/lib/routing/route-sheet-state"
import { useHydrated } from "~/lib/use-hydrated"

export function useRouteSheet(options: {
  onCloseComplete: () => void
  onCloseStart?: () => void
  onReopen?: () => void
}) {
  const hydrated = useHydrated()
  const [open, setOpen] = useState(!hydrated)
  const [version, setVersion] = useState(0)
  const location = useLocation()
  const navigation = useNavigation()
  const callbacks = useRef(options)
  callbacks.current = options
  const [lifecycle] = useState(() => createRouteSheetState({
    setOpen,
    onCloseComplete: () => callbacks.current.onCloseComplete(),
    onCloseStart: () => callbacks.current.onCloseStart?.(),
    onReopen: () => {
      setVersion((value) => value + 1)
      callbacks.current.onReopen?.()
    },
  }))
  const openingLocation = navigation.location
    ? navigation.location.pathname === location.pathname ? navigation.location : null
    : location
  const requestKey = useRef(location.key)

  useLayoutEffect(() => { lifecycle.reopen() }, [lifecycle])
  useEffect(() => () => lifecycle.dispose(), [lifecycle])
  useLayoutEffect(() => {
    if (!openingLocation || openingLocation.key === requestKey.current) return
    requestKey.current = openingLocation.key
    // React Router may still be loading the same URL when the old close finishes
    lifecycle.reopen()
  }, [openingLocation?.key, lifecycle])

  return { open, version, close: lifecycle.close, finishClosing: lifecycle.finishClosing }
}
