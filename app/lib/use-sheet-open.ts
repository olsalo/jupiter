import { useSyncExternalStore } from "react"

const sheetSelector = [
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

const getSnapshot = () => document.querySelector(sheetSelector) !== null
const getServerSnapshot = () => false

export function useSheetOpen() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
