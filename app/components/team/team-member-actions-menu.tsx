import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { DeleteConfirmationDialog } from "~/components/overlays/delete-confirmation-dialog"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

type TeamMemberActionsMenuProps = {
  canRevoke: boolean
  memberId: string
  memberName: string
  triggerVariant?: "menu" | "button"
}

export function TeamMemberActionsMenu({ canRevoke, memberId, memberName, triggerVariant = "menu" }: TeamMemberActionsMenuProps) {
  const { t } = useTranslation("team")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const removeMember = useMutation(trpc.team.removeMember.mutationOptions({
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.team.list.queryKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.team.count.queryKey() }),
        queryClient.invalidateQueries(trpc.team.getPerson.queryFilter()),
        queryClient.invalidateQueries(trpc.staff.list.queryFilter()),
        queryClient.invalidateQueries(trpc.resourceLimits.getAll.queryFilter()),
      ])
      setConfirmOpen(false)
      toast.success(t("memberActions.revoked"))
    },
    onError: () => toast.error(t("memberActions.revokeFailed")),
  }))

  if (!canRevoke && triggerVariant === "menu") return null

  return (
    <>
      {triggerVariant === "button" ? <Button className="min-w-36" disabled={!canRevoke || removeMember.isPending} loading={removeMember.isPending} onClick={() => setConfirmOpen(true)} size="sm" type="button" variant="destructive-outline">{t("memberActions.revokeAccess")}</Button> : <Menu open={open} onOpenChange={setOpen}>
        <MenuTrigger
          aria-label={t("memberActions.actionsFor", { name: memberName })}
          render={<Button disabled={removeMember.isPending} size="icon" type="button" variant="ghost" />}
        >
          <Icon aria-hidden="true" name="dotsVertical" size={18} />
        </MenuTrigger>
        <MenuPopup align="end" className="min-w-48" sideOffset={6}>
          <MenuItem
            closeOnClick={true}
            disabled={removeMember.isPending}
            onClick={() => setConfirmOpen(true)}
            variant="destructive"
          >
            <Icon aria-hidden="true" name="delete" />
            {t("memberActions.revokeAccess")}
          </MenuItem>
        </MenuPopup>
      </Menu>}
      <DeleteConfirmationDialog
        forceBackdrop={true}
        cancelLabel={t("cancel")}
        closeOnConfirm={false}
        confirmLabel={t("memberActions.revokeConfirm")}
        description={t("memberActions.revokeDescription")}
        isPending={removeMember.isPending}
        onOpenChange={setConfirmOpen}
        onConfirm={() => { if (canRevoke && !removeMember.isPending) removeMember.mutate({ memberId }) }}
        open={confirmOpen}
        title={t("memberActions.revokeTitle", { name: memberName })}
      />
    </>
  )
}
