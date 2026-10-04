import type { ReactNode } from "react"

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"

export type DeleteConfirmationDialogProps = {
  cancelLabel: ReactNode
  confirmLabel: ReactNode
  description: ReactNode
  isPending?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  open: boolean
  title: ReactNode
}

export function DeleteConfirmationDialog({
  cancelLabel,
  confirmLabel,
  description,
  isPending = false,
  onOpenChange,
  onConfirm,
  open,
  title,
}: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" />}>
            {cancelLabel}
          </AlertDialogClose>
          <AlertDialogClose
            onClick={() => onConfirm()}
            render={
              <Button
                disabled={isPending}
                loading={isPending}
                type="button"
                variant="destructive"
              />
            }
          >
            {confirmLabel}
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  )
}
