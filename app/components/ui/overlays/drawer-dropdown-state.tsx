import type { Drawer } from "@base-ui/react/drawer"
import { useRender } from "@base-ui/react/use-render"
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentPropsWithRef } from "react"

function createDismissStore() {
  let dismiss = false
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => dismiss,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(next: boolean) {
      if (dismiss === next) return
      dismiss = next
      listeners.forEach((listener) => listener())
    },
  }
}

const DrawerDropdownDismissContext = createContext(createDismissStore())
const getServerSnapshot = () => false

export function DrawerDropdownScope({ popupProps, render, state }: {
  popupProps: ComponentPropsWithRef<"div">
  render: Drawer.Popup.Props["render"]
  state: Drawer.Popup.State
}) {
  const parent = useContext(DrawerDropdownDismissContext)
  const parentDismiss = useSyncExternalStore(parent.subscribe, parent.getSnapshot, getServerSnapshot)
  const [store] = useState(createDismissStore)
  const popupRef = useRef<HTMLDivElement>(null)
  const { ref: forwardedRef, ...elementProps } = popupProps
  const axis = state.swipeDirection === "left" || state.swipeDirection === "right" ? "x" : "y"
  useLayoutEffect(() => {
    const popup = popupRef.current
    // Base UI marks touch down as swiping and updates movement directly on the DOM
    let moved = false
    const update = () => {
      const movement = Number.parseFloat(popup?.style.getPropertyValue(`--drawer-swipe-movement-${axis}`) || "0")
      moved ||= state.swiping && Math.abs(movement) > 0
      store.set(parentDismiss || moved || !state.open)
    }
    update()
    if (!state.swiping || !popup) return
    const observer = new MutationObserver(update)
    observer.observe(popup, { attributes: true, attributeFilter: ["style"] })
    return () => observer.disconnect()
  }, [store, parentDismiss, state.swiping, state.open, axis])
  const element = useRender({
    defaultTagName: "div",
    ref: [forwardedRef ?? null, popupRef],
    props: elementProps,
    render: typeof render === "function" ? (props) => render(props, state) : render,
  })

  return <DrawerDropdownDismissContext.Provider value={store}>
    {element}
  </DrawerDropdownDismissContext.Provider>
}

export function useDrawerDropdownDismiss(onDismiss: () => void, enabled = true) {
  const store = useContext(DrawerDropdownDismissContext)
  // Closed dropdowns do not need to render when a drawer starts or ends a swipe
  const dismiss = useSyncExternalStore(store.subscribe, () => enabled && store.getSnapshot(), getServerSnapshot)
  const callback = useRef(onDismiss)
  callback.current = onDismiss

  useEffect(() => {
    if (dismiss) callback.current()
  }, [dismiss])

  return dismiss
}

export function useDrawerDropdownState<Details extends { isCanceled: boolean }>({ open: controlledOpen, defaultOpen = false, onOpenChange }: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean, details: Details) => void
}, createDismissDetails: () => Details) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const open = controlledOpen ?? uncontrolledOpen
  const handleOpenChange = (nextOpen: boolean, details: Details) => {
    onOpenChange?.(nextOpen, details)
    if (!details.isCanceled) setUncontrolledOpen(nextOpen)
  }
  const dismiss = useDrawerDropdownDismiss(() => {
    if (open) handleOpenChange(false, createDismissDetails())
  }, open)

  return { open: open && !dismiss, onOpenChange: handleOpenChange }
}
