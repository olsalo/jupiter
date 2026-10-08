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
  closeOnConfirm?: boolean
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
  closeOnConfirm = true,
  isPending = false,
  onOpenChange,
  onConfirm,
  open,
  title,
}: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog
      onOpenChange={(nextOpen) => {
        if (nextOpen || !isPending) onOpenChange(nextOpen)
      }}
      open={open}
    >
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            disabled={isPending}
            render={<Button disabled={isPending} variant="ghost" />}
          >
            {cancelLabel}
          </AlertDialogClose>
          {closeOnConfirm ? (
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
          ) : (
            <Button
              disabled={isPending}
              loading={isPending}
              onClick={onConfirm}
              type="button"
              variant="destructive"
            >
              {confirmLabel}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  )
}
