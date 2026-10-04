import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog"
import { joinedTeamStorageKey } from "~/lib/team-join"

export function JoinedTeamDialog() {
  const { t } = useTranslation("team")
  const [organizationName, setOrganizationName] = useState<string | null>(null)

  useEffect(() => {
    const joinedOrganization = window.sessionStorage.getItem(joinedTeamStorageKey)
    if (!joinedOrganization) return

    window.sessionStorage.removeItem(joinedTeamStorageKey)
    setOrganizationName(joinedOrganization)
  }, [])

  return (
    <Dialog open={Boolean(organizationName)} onOpenChange={(open) => {
      if (!open) setOrganizationName(null)
    }}>
      <DialogPopup className="sm:max-w-sm" forceBackdrop={true}>
        <DialogHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-success/10 text-success">
            <Icon aria-hidden="true" name="circleCheck" size={24} />
          </div>
          <DialogTitle>{t("accept.joined")}</DialogTitle>
          <DialogDescription>{t("accept.success", { organization: organizationName })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button className="w-full" onClick={() => setOrganizationName(null)} type="button">
            {t("accept.continue")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
