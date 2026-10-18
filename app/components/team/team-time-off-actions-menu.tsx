import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { DeleteConfirmationDialog } from "~/components/delete-confirmation-dialog"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

export function TeamTimeOffActionsMenu({ id, title, staffMemberId, repeating = false }: { id: string; title: string; staffMemberId: string; repeating?: boolean }) {
  const { t } = useTranslation("team")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const remove = useMutation(trpc.availability.deleteBlockedTime.mutationOptions({
    onSuccess: async () => {
      setConfirmOpen(false)
      toast.success(t("timeOff.removed"))
      await Promise.all([
        queryClient.invalidateQueries(trpc.availability.getTimeOff.queryFilter({ staffMemberId })),
        queryClient.invalidateQueries(trpc.availability.listBlockedTime.queryFilter()),
        queryClient.invalidateQueries(trpc.availability.getSlots.queryFilter()),
      ])
    },
    onError: () => toast.error(t("timeOff.removeError")),
  }))

  return <>
    <Menu>
      <MenuTrigger aria-label={t("timeOff.actionsFor", { title })} render={<Button disabled={remove.isPending} size="icon" type="button" variant="ghost" />}>
        <Icon aria-hidden={true} className="size-4.5 sm:size-4" name="dotsVertical" size={18} />
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-48" sideOffset={6}>
        <MenuItem closeOnClick={true} onClick={() => setConfirmOpen(true)} variant="destructive">
          <Icon aria-hidden={true} name="delete" />
          {t(repeating ? "timeOff.removeSeries" : "timeOff.remove")}
        </MenuItem>
      </MenuPopup>
    </Menu>
    <DeleteConfirmationDialog cancelLabel={t("cancel")} closeOnConfirm={false} confirmLabel={t(repeating ? "timeOff.removeSeries" : "timeOff.remove")} description={t(repeating ? "timeOff.removeSeriesDescription" : "timeOff.removeDescription")} forceBackdrop={true} isPending={remove.isPending} onConfirm={() => remove.mutate({ id })} onOpenChange={setConfirmOpen} open={confirmOpen} title={t(repeating ? "timeOff.removeSeries" : "timeOff.remove")} />
  </>
}
