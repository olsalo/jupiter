import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "~/components/ui/menu"
import { Spinner } from "~/components/ui/spinner"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import type { PermissionLevel } from "./permission-level-select"

export function TeamRoleMenu({ memberId, role, disabled = false }: { memberId: string; role: PermissionLevel | "owner"; disabled?: boolean }) {
  const { t } = useTranslation("team")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const mutation = useMutation(trpc.team.setRole.mutationOptions({
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(trpc.team.list.queryFilter()),
        queryClient.invalidateQueries(trpc.team.getPerson.queryFilter()),
      ])
      setOpen(false)
      toast.success(t("people.roleSaved"))
    },
    onError: () => toast.error(t("people.roleFailed")),
  }))
  const items = [
    { value: "member", label: t("roles.member"), description: t("invite.standardDescription") },
    { value: "admin", label: t("roles.admin"), description: t("invite.adminDescription") },
  ]

  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger aria-label={t("permissionLevel")} disabled={disabled || mutation.isPending} render={<Button className="min-w-36 justify-between" disabled={disabled || mutation.isPending} size="sm" type="button" variant="outline" />}>
        {t(role === "owner" ? "roles.owner" : role === "admin" ? "roles.admin" : "roles.member")}
        <Icon aria-hidden={true} name="chevronDown" size={16} />
      </MenuTrigger>
      <MenuPopup align="end" className="w-72 max-w-[calc(100vw-2rem)]" sideOffset={6}>
        <MenuRadioGroup value={role} onValueChange={(value) => {
          if ((value === "member" || value === "admin") && value !== role && !disabled && !mutation.isPending) mutation.mutate({ memberId, role: value })
        }}>
          {items.map((item) => (
            <MenuRadioItem closeOnClick={false} disabled={disabled || mutation.isPending} indicator={mutation.isPending ? mutation.variables?.role === item.value ? <Spinner aria-label={t("people.changingRole")} className="size-4 shrink-0" /> : null : undefined} key={item.value} label={item.label} value={item.value} className="py-2">
              <span className="flex items-center gap-3">
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-medium">{item.label}</span>
                  <span className="whitespace-normal text-xs leading-relaxed text-muted-foreground">{item.description}</span>
                </span>
              </span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  )
}
