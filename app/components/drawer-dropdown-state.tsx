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
  useLayoutEffect(() => {
    store.set(parentDismiss || state.swiping || !state.open)
  }, [store, parentDismiss, state.swiping, state.open])
  const element = useRender({
    defaultTagName: "div",
    props: { ...popupProps },
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
