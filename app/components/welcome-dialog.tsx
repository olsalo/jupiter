import { useId } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router"

import { AppLogo } from "~/components/app-logo"
import Icon from "~/components/icons"
import { ServerRenderedDialogPopup } from "~/components/server-rendered-dialog-popup"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "~/components/ui/dialog"

const features = [
  { key: "notes", icon: "notes" },
  { key: "overview", icon: "dashboard" },
  { key: "team", icon: "users" },
] as const

export function WelcomeDialog() {
  const { t } = useTranslation("common")
  const [searchParams, setSearchParams] = useSearchParams()
  const titleId = useId()
  const descriptionId = useId()
  const open = searchParams.get("welcome") === "true"

  function start() {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.delete("welcome")
      return next
    }, { replace: true, preventScrollReset: true })
  }

  return (
    <Dialog
      disablePointerDismissal={true}
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          start()
        }
      }}
    >
      <ServerRenderedDialogPopup
        className="relative overflow-hidden p-0 md:grid md:min-h-[480px] md:max-w-5xl md:grid-cols-2 md:grid-rows-[auto_minmax(0,1fr)_auto]"
        descriptionId={descriptionId}
        forceBackdrop={true}
        open={open}
        titleId={titleId}
      >
        <DialogHeader className="gap-3 p-7 pb-4 md:col-start-1 md:p-9 md:pb-5">
          <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <AppLogo aria-hidden="true" className="size-6" />
          </div>
          <DialogTitle className="text-balance text-2xl leading-tight" id={titleId}>
            {t("welcome.title")}
          </DialogTitle>
          <DialogDescription className="text-pretty leading-6" id={descriptionId}>
            {t("welcome.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="px-7 md:px-9" scrollAreaClassName="md:col-start-1">
          <ul className="flex flex-col gap-5 py-2">
            {features.map(({ key, icon }) => (
              <li className="flex items-start gap-3" key={key}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
                  <Icon aria-hidden="true" name={icon} size={18} stroke={1.75} />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium leading-5">{t(`welcome.${key}.title`)}</p>
                  <p className="text-sm leading-5 text-muted-foreground">{t(`welcome.${key}.description`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </DialogPanel>
        <DialogFooter className="mt-auto p-7 pt-6 md:col-start-1 md:p-9 md:pt-7" variant="bare">
          <Button autoFocus={true} className="w-full" onClick={start} size="lg" type="button">
            {t("welcome.start")}
            <Icon aria-hidden="true" name="arrowRight" size={18} />
          </Button>
        </DialogFooter>
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 hidden w-1/2 border-l bg-neutral-100 bg-[url('/mockup.png')] bg-size-[90%_auto] bg-bottom-right bg-no-repeat md:block dark:bg-neutral-900"
        />
      </ServerRenderedDialogPopup>
    </Dialog>
  )
}
