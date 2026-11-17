import { useSyncExternalStore } from "react"

const overlaySelector = [
  '[data-slot="dialog-popup"][data-open]',
  '[data-slot="alert-dialog-popup"][data-open]',
  '[data-slot="sheet-popup"][data-open]',
  '[data-slot="drawer-popup"][data-open]',
].join(",")

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-open", "data-slot"],
  })

  return () => observer.disconnect()
}

const getSnapshot = () => document.querySelectorAll(overlaySelector).length
const getServerSnapshot = () => 0

export function useOpenOverlayCount() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
