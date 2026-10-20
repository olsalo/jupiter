import type { Drawer } from "@base-ui/react/drawer"
import { useRender } from "@base-ui/react/use-render"
import { createContext, useContext, useEffect, useRef, useState, type ComponentPropsWithRef } from "react"

const DrawerDropdownDismissContext = createContext(false)

export function DrawerDropdownScope({ popupProps, render, state }: {
  popupProps: ComponentPropsWithRef<"div">
  render: Drawer.Popup.Props["render"]
  state: Drawer.Popup.State
}) {
  const parentDismiss = useContext(DrawerDropdownDismissContext)
  const element = useRender({
    defaultTagName: "div",
    props: { ...popupProps },
    render: typeof render === "function" ? (props) => render(props, state) : render,
  })

  return <DrawerDropdownDismissContext.Provider value={parentDismiss || state.swiping || !state.open}>
    {element}
  </DrawerDropdownDismissContext.Provider>
}

export function useDrawerDropdownDismiss(onDismiss: () => void) {
  const dismiss = useContext(DrawerDropdownDismissContext)
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
  })

  return { open: open && !dismiss, onOpenChange: handleOpenChange }
}
