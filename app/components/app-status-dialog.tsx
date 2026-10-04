import { useEffect, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog"

const subscribeToOnlineStatus = (onStoreChange: () => void) => {
  window.addEventListener("online", onStoreChange)
  window.addEventListener("offline", onStoreChange)

  return () => {
    window.removeEventListener("online", onStoreChange)
    window.removeEventListener("offline", onStoreChange)
  }
}

const getOnlineStatus = () => navigator.onLine
const getServerOnlineStatus = () => true
const narrowViewportQuery = "(max-width: 374px)"

const subscribeToNarrowViewport = (onStoreChange: () => void) => {
  const mediaQuery = window.matchMedia(narrowViewportQuery)
  mediaQuery.addEventListener("change", onStoreChange)

  return () => {
    mediaQuery.removeEventListener("change", onStoreChange)
  }
}

const getNarrowViewportStatus = () =>
  window.matchMedia(narrowViewportQuery).matches
const getServerNarrowViewportStatus = () => false

export function AppStatusDialog() {
  const { t } = useTranslation()
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineStatus,
    getServerOnlineStatus,
  )
  const isNarrowViewport = useSyncExternalStore(
    subscribeToNarrowViewport,
    getNarrowViewportStatus,
    getServerNarrowViewportStatus,
  )
  const isOffline = !isOnline
  const isBlocked = isOffline || isNarrowViewport

  useEffect(() => {
    if (!isOffline) return

    const interval = window.setInterval(() => window.location.reload(), 5_000)
    return () => window.clearInterval(interval)
  }, [isOffline])

  return (
    <Dialog disablePointerDismissal open={isBlocked}>
      <DialogPopup
        bottomStickOnMobile={false}
        className="sm:max-w-sm"
        forceBackdrop
        showCloseButton={false}
      >
        <DialogHeader className="items-center text-center">
          <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon
              aria-hidden="true"
              name={isOffline ? "wifiOff" : "infoCircle"}
              size={24}
            />
          </div>
          <DialogTitle>
            {t(isOffline ? "offline.title" : "narrow.title")}
          </DialogTitle>
          <DialogDescription>
            {t(isOffline ? "offline.description" : "narrow.description")}
          </DialogDescription>
        </DialogHeader>
      </DialogPopup>
    </Dialog>
  )
}
