import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "~/components/ui/menu"
import { Spinner } from "~/components/ui/spinner"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

type InvitationActionsMenuProps = {
  invitationId: string
  email: string
  canInvite: boolean
  disabled?: boolean
}

export function InvitationActionsMenu({ invitationId, email, canInvite, disabled = false }: InvitationActionsMenuProps) {
  const { t } = useTranslation("team")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const cancelInvitation = useMutation(trpc.team.cancelInvitation.mutationOptions({
    onSuccess: async () => {
      setOpen(false)
      toast.success(t("invite.cancelled"))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.team.list.queryKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.team.count.queryKey() }),
        queryClient.invalidateQueries(trpc.team.getPerson.queryFilter()),
      ])
    },
    onError: () => toast.error(t("invite.cancelFailed")),
  }))

  async function copyInvitationLink() {
    try {
      const inviteUrl = new URL(`/invite/${encodeURIComponent(invitationId)}`, window.location.origin)
      inviteUrl.searchParams.set("email", email)
      await navigator.clipboard.writeText(inviteUrl.href)
      toast.success(t("invite.linkCopied"))
    } catch {
      toast.error(t("invite.copyFailed"))
    }
  }

  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger
        aria-label={t("invite.actionsFor", { email })}
        render={<Button disabled={disabled || cancelInvitation.isPending} size="icon" type="button" variant="ghost" />}
      >
        <Icon aria-hidden={true} className="size-4.5 sm:size-4" name="dotsVertical" size={18} />
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-48" sideOffset={6}>
        <MenuItem closeOnClick={true} disabled={disabled || cancelInvitation.isPending} onClick={() => void copyInvitationLink()}>
          <Icon aria-hidden="true" name="copy" />
          {t("invite.copyLink")}
        </MenuItem>
        {canInvite ? (
          <>
            <MenuSeparator />
            <MenuItem
              closeOnClick={false}
              disabled={disabled || cancelInvitation.isPending}
              onClick={() => cancelInvitation.mutate({ invitationId })}
              variant="destructive"
            >
              {cancelInvitation.isPending ? (
                <Spinner aria-label={t("loading")} />
              ) : (
                <Icon aria-hidden="true" name="delete" />
              )}
              {t("invite.cancel")}
            </MenuItem>
          </>
        ) : null}
      </MenuPopup>
    </Menu>
  )
}
