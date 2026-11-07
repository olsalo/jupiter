import { useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import { useMatches } from "react-router"

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
const narrowViewportQuery = "(max-width: 374px), (orientation: landscape) and (max-height: 500px) and (pointer: coarse)"

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
  const isMarketingPage = useMatches().some(({ handle }) => (handle as { marketing?: boolean } | undefined)?.marketing === true)
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineStatus,
    getServerOnlineStatus,
  )
  const narrowViewport = useSyncExternalStore(
    subscribeToNarrowViewport,
    getNarrowViewportStatus,
    getServerNarrowViewportStatus,
  )
  const isNarrowViewport = narrowViewport && !isMarketingPage
  const isOffline = !isOnline
  const isBlocked = isOffline || isNarrowViewport
  const showOffline = isOffline && !isNarrowViewport

  return (
    <Dialog disablePointerDismissal={true} open={isBlocked}>
      <DialogPopup
        backdropClassName={isNarrowViewport ? "backdrop-blur-[4px]" : undefined}
        bottomStickOnMobile={false}
        className="sm:max-w-sm"
        forceBackdrop={true}
        showCloseButton={false}
      >
        <DialogHeader className="items-center text-center">
          <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon
              aria-hidden="true"
              name={showOffline ? "wifiOff" : "infoCircle"}
              size={24}
            />
          </div>
          <DialogTitle>
            {t(showOffline ? "offline.title" : "narrow.title")}
          </DialogTitle>
          <DialogDescription>
            {t(showOffline ? "offline.description" : "narrow.description")}
          </DialogDescription>
        </DialogHeader>
      </DialogPopup>
    </Dialog>
  )
}
