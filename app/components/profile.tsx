import { useMutation } from "@tanstack/react-query"
import type { ComponentProps } from "react"
import { useTranslation } from "react-i18next"
import { href, useNavigate, useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import Icon from "~/components/icons"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
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
  variant = "default",
}: ProfileProps) {
  const { t } = useTranslation()
  const { t: tTeam } = useTranslation("team")
  const navigate = useNavigate()
  const trpc = useTRPC()
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const organizations = rootData?.organizations ?? []
  const setActive = useMutation(trpc.organizations.setActive.mutationOptions({
    onSuccess: () => window.location.replace("/"),
    onError: () => toast.error(t("account.switchBusinessError")),
  }))
  const displayName = user?.name || user?.email || t("account.fallbackName")
  const displayInitial = displayName.trim().charAt(0).toUpperCase() || "C"
  const activeBusinessName = rootData?.org?.name ?? organizations[0]?.name
  const businessSummary = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground ring-1 ring-border">
        <Icon aria-hidden="true" name="building" size={16} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate font-medium">{displayName}</span>
        <span className="truncate text-xs text-muted-foreground">{activeBusinessName}</span>
      </span>
    </>
  )

  const logOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate(href("/auth"), { replace: true })
        },
      },
    })
  }

  return (
    <Menu>
      <MenuTrigger
        aria-label={t("account.openMenu", { name: displayName })}
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-full align-middle outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background max-md:data-popup-open:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-border)_70%,transparent)]",
          className,
        )}
        title={displayName}
      >
        <Avatar
          className={cn(
            "ring-1 ring-border",
            variant === "light"
              ? "bg-muted text-foreground"
              : "bg-primary text-primary-foreground",
          )}
        >
          {user?.image ? (
            <AvatarImage alt={displayName} src={user.image} />
          ) : null}
          <AvatarFallback
            className={cn(
              variant === "light"
                ? "bg-muted text-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            {displayInitial}
          </AvatarFallback>
        </Avatar>
      </MenuTrigger>
      <MenuPopup align="end" className="w-min min-w-[180px]!" side={menuSide} sideOffset={menuSideOffset}>
        {organizations.length > 0 ? (
          <>
            {organizations.length > 1 ? (
              <MenuSub>
                <MenuSubTrigger
                  aria-label={`${t("account.switchBusiness")}: ${displayName}, ${activeBusinessName}`}
                  className="min-h-12 gap-3 whitespace-nowrap px-3 py-2 sm:text-base"
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
                        className="min-h-11 gap-3 whitespace-nowrap px-3 py-2 sm:text-base"
                        closeOnClick={false}
                        disabled={isActive || setActive.isPending}
                        key={organization.id}
                        onClick={() => setActive.mutate({ organizationId: organization.id })}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span className="min-w-0 truncate">{organization.name}</span>
                          <Badge size="sm" variant="secondary">{roleLabel}</Badge>
                        </span>
                        {isSwitching ? <Spinner aria-label={t("account.switchingBusiness")} /> : isActive ? <Icon aria-hidden="true" name="check" /> : null}
                      </MenuItem>
                    )
                  })}
                </MenuSubPopup>
              </MenuSub>
            ) : (
              <div className="flex min-h-12 items-center gap-3 px-3 py-2 text-base text-foreground">
                {businessSummary}
              </div>
            )}
            <MenuSeparator />
          </>
        ) : null}
        <MenuItem className="min-h-11 gap-3 whitespace-nowrap px-3 py-2 sm:text-base" onClick={logOut}>
          <Icon name="logOut" />
          {t("account.logOut")}
        </MenuItem>
      </MenuPopup>
    </Menu>
  )
}
