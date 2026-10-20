import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "~/components/ui/button"
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "~/components/ui/dialog"

export function useBreakOverlapConfirmation() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const resolve = useRef<((confirmed: boolean) => void) | null>(null)

  useEffect(() => () => { resolve.current?.(false) }, [])

  const finish = (confirmed: boolean) => {
    const pending = resolve.current
    resolve.current = null
    setOpen(false)
    pending?.(confirmed)
  }

  const confirmBreakOverlap = (): Promise<boolean> => {
    resolve.current?.(false)
    setOpen(true)
    return new Promise((onResolve) => { resolve.current = onResolve })
  }

  const breakOverlapConfirmation = <Dialog onOpenChange={(nextOpen) => { if (!nextOpen) finish(false) }} open={open}>
    <DialogPopup forceBackdrop={true}>
      <DialogHeader>
        <DialogTitle>{t("bookingForm.breakOverlapTitle")}</DialogTitle>
        <DialogDescription>{t("bookingForm.breakOverlapDescription")}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="ghost" />}>{t("bookingForm.breakOverlapCancel")}</DialogClose>
        <Button onClick={() => finish(true)} type="button">{t("bookingForm.breakOverlapConfirm")}</Button>
      </DialogFooter>
    </DialogPopup>
  </Dialog>

  return { confirmBreakOverlap, breakOverlapConfirmation }
}
