import { useMutation } from "@tanstack/react-query"
import type { ComponentProps } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { href, useNavigate } from "react-router"

import { useAppContext } from "~/lib/hooks/use-app-context"
import Icon from "~/components/icons"
import { UserAvatar } from "~/components/data-display/user-avatar"
import { Badge } from "~/components/ui/badge"
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "~/components/ui/menu"
import { Spinner } from "~/components/ui/spinner"
import { authClient } from "~/lib/auth/client"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { cn } from "~/lib/utils"

type ProfileUser = {
  email?: string | null
  image?: string | null
  name?: string | null
} | null

type ProfileProps = {
  className?: string
  menuSide?: ComponentProps<typeof MenuPopup>["side"]
  menuSideOffset?: ComponentProps<typeof MenuPopup>["sideOffset"]
  user: ProfileUser
  variant?: "default" | "light"
}

export function Profile({
  className,
  menuSide,
  menuSideOffset = 8,
  user,
}: ProfileProps) {
  const { t } = useTranslation()
  const { t: tTeam } = useTranslation("team")
  const navigate = useNavigate()
  const trpc = useTRPC()
  const rootData = useAppContext()
  const [menuOpen, setMenuOpen] = useState(false)
  const organizations = rootData?.organizations ?? []
  const setActive = useMutation(trpc.organizations.setActive.mutationOptions({
    onSuccess: () => {
      setMenuOpen(false)
      window.location.replace("/")
    },
    onError: () => toast.error(t("account.switchBusinessError")),
  }))
  const displayName = user?.name || user?.email || t("account.fallbackName")
  const activeBusinessName = rootData?.org?.name ?? organizations[0]?.name
  const businessSummary = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground ring-1 ring-border">
        <Icon aria-hidden="true" name="buildingStore" size={16} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate font-medium">{displayName}</span>
        <span className="truncate text-xs text-muted-foreground">{activeBusinessName}</span>
      </span>
    </>
  )

  const logOut = useMutation({
    mutationFn: async () => {
      const result = await authClient.signOut()
      if (result.error) throw new Error(result.error.message ?? t("account.logOutError"))
    },
    onSuccess: async () => {
      setMenuOpen(false)
      toast.success(t("account.loggedOut"))
      await navigate(href("/auth"), { replace: true })
    },
    onError: () => toast.error(t("account.logOutError")),
  })
  const isPending = setActive.isPending || logOut.isPending

  return (
    <Menu open={menuOpen} onOpenChange={setMenuOpen}>
      <MenuTrigger
        aria-label={t("account.openMenu", { name: displayName })}
        disabled={isPending}
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-full align-middle outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background max-md:data-popup-open:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-border)_70%,transparent)]",
          className,
        )}
        title={displayName}
      >
        <UserAvatar
          className="size-full bg-muted-foreground text-xs text-background"
          decorative={true}
          fallbackClassName="bg-muted-foreground text-background"
          initialsCount={1}
          name={displayName}
          src={user?.image}
          stableId={displayName}
        />
      </MenuTrigger>
      <MenuPopup align="end" className="w-min min-w-[180px]!" side={menuSide} sideOffset={menuSideOffset}>
        {organizations.length > 0 ? (
          <>
            {organizations.length > 1 ? (
              <MenuSub>
                <MenuSubTrigger
                  aria-label={`${t("account.switchBusiness")}: ${displayName}, ${activeBusinessName}`}
                  className="min-h-11 gap-2 whitespace-nowrap"
                  disabled={logOut.isPending}
                >
                  {businessSummary}
                </MenuSubTrigger>
                <MenuSubPopup className="w-min min-w-[250px]!">
                  {organizations.map((organization) => {
                    const isActive = rootData?.org?.id === organization.id
                    const isSwitching = setActive.isPending && setActive.variables?.organizationId === organization.id
                    const roleLabel = organization.role.split(",").map((value) => {
                      const role = value.trim()
                      return role === "owner" || role === "admin" || role === "member"
                        ? tTeam(`roles.${role}`)
                        : role
                    }).join(", ")

                    return (
                      <MenuItem
                        aria-current={isActive ? "true" : undefined}
                        className="whitespace-nowrap"
                        closeOnClick={false}
                        disabled={isActive || isPending}
                        key={organization.id}
                        onClick={() => setActive.mutate({ organizationId: organization.id })}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span className="min-w-0 truncate">{organization.name}</span>
                          <Badge size="sm" variant="secondary">{roleLabel}</Badge>
                        </span>
                        <span className="-mx-0.5 flex size-4.5 shrink-0 items-center justify-center sm:size-4 [&>svg]:size-full [&>svg]:opacity-80">
                          {isSwitching ? <Spinner aria-label={t("account.switchingBusiness")} /> : isActive ? <Icon aria-hidden={true} name="check" /> : null}
                        </span>
                      </MenuItem>
                    )
                  })}
                </MenuSubPopup>
              </MenuSub>
            ) : (
              <div className="flex min-h-11 items-center gap-2 px-2 py-1 text-sm text-foreground">
                {businessSummary}
              </div>
            )}
            <MenuSeparator />
          </>
        ) : null}
        <MenuItem
          className="whitespace-nowrap"
          closeOnClick={false}
          disabled={isPending}
          onClick={() => logOut.mutate()}
        >
          {logOut.isPending ? <Spinner aria-label={t("account.loggingOut")} /> : <Icon aria-hidden={true} name="logOut" />}
          {t("account.logOut")}
        </MenuItem>
      </MenuPopup>
    </Menu>
  )
}
