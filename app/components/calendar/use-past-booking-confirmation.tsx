import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "~/components/ui/button"
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "~/components/ui/dialog"

export function usePastBookingConfirmation() {
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

  const confirmPastBooking = (...startsAt: (string | Date)[]): Promise<boolean> => {
    if (startsAt.every((start) => +new Date(start) >= Date.now())) return Promise.resolve(true)
    resolve.current?.(false)
    setOpen(true)
    return new Promise((onResolve) => { resolve.current = onResolve })
  }

  const pastBookingConfirmation = <Dialog onOpenChange={(nextOpen) => { if (!nextOpen) finish(false) }} open={open}>
    <DialogPopup forceBackdrop={true}>
      <DialogHeader>
        <DialogTitle>{t("bookingForm.pastStartTitle")}</DialogTitle>
        <DialogDescription>{t("bookingForm.pastStartDescription")}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="ghost" />}>{t("bookingForm.pastStartCancel")}</DialogClose>
        <Button onClick={() => finish(true)} type="button">{t("bookingForm.pastStartConfirm")}</Button>
      </DialogFooter>
    </DialogPopup>
  </Dialog>

  return { confirmPastBooking, pastBookingConfirmation }
}
