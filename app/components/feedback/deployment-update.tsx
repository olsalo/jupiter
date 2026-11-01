import { useIsMutating, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { useNavigation } from "react-router"

import Icon from "~/components/icons"
import { AppLogo } from "~/components/navigation/app-logo"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { claimDeploymentReload, watchDeploymentVersion } from "~/lib/browser/deployment-version"

export function DeploymentUpdate() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigation = useNavigation()
  const mutations = useIsMutating()
  const navigationState = useRef(navigation.state)
  navigationState.current = navigation.state
  const [available, setAvailable] = useState(false)
  const [updating, setUpdating] = useState(false)

  const busy = () => navigationState.current !== "idle" || queryClient.isMutating() > 0
    || Boolean(document.querySelector('form[data-app-submitting="true"]'))

  useEffect(() => {
    if (import.meta.env.DEV) return
    return watchDeploymentVersion(import.meta.env.APP_BUILD_ID, (_version, idle) => {
      const editing = document.querySelector('form[data-app-dirty="true"]')
      let reload = false
      if (idle && !editing && !busy()) {
        try {
          reload = claimDeploymentReload(window.sessionStorage)
        } catch {
          // Offer a manual reload if browser storage is unavailable
        }
      }
      if (reload) window.location.reload()
      else setAvailable(true)
    })
  }, [queryClient])

  if (!available) return null
  return createPortal(
    <div className="fixed inset-x-4 top-[calc(1rem+env(safe-area-inset-top,0px))] z-[10000] mx-auto max-w-lg">
      <Alert className="bg-background shadow-lg dark:bg-background has-[>svg]:has-data-[slot=alert-action]:grid-cols-[2.25rem_minmax(0,1fr)_auto] [&>svg]:size-9 [&>svg]:text-primary-foreground" showIcon={false} variant="default">
        <AppLogo aria-hidden={true} className="row-span-2 self-center rounded-lg bg-primary p-1.5" />
        <AlertTitle>{t("deploymentUpdate.title")}</AlertTitle>
        <AlertDescription>{t("deploymentUpdate.description")}</AlertDescription>
        <AlertAction>
          <Button
            disabled={mutations > 0 || navigation.state !== "idle"}
            loading={updating}
            onClick={() => {
              if (busy() || !navigator.onLine || updating) return
              setUpdating(true)
              window.location.reload()
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <Icon aria-hidden={true} name="refresh" />
            {t("deploymentUpdate.reload")}
          </Button>
        </AlertAction>
      </Alert>
    </div>,
    document.body,
  )
}
