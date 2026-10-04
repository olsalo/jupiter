import { useSyncExternalStore } from "react"

const modalSelector = [
  '[data-slot="dialog-popup"][data-open]',
  '[data-slot="alert-dialog-popup"][data-open]',
  '[data-slot="sheet-popup"][data-open]',
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

const getSnapshot = () => document.querySelector(modalSelector) !== null
const getServerSnapshot = () => false

export function useModalOpen() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
