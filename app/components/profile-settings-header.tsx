import { useTranslation } from "react-i18next"

import { isBookableStaff } from "~/lib/auth/permissions"
import Icon from "~/components/icons"
import { ProfileSettingsTabs } from "~/components/profile-settings-tabs"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import type { TeamPerson } from "~/components/team/team-types"

export function ProfileSettingsHeader({ disabled, person }: {
  disabled: boolean
  person?: Pick<TeamPerson, "name" | "image"> & Partial<Pick<TeamPerson, "staff">>
}) {
  const { t } = useTranslation("common")
  const initials = person?.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()

  return (
    <header className="border-b bg-background px-5 pt-5 max-sm:px-4 max-sm:pt-4" data-slot="profile-settings-header">
      <div className="flex items-center gap-3 pb-4 pe-8">
        <Avatar className="size-12 text-base">
          {person?.image ? <AvatarImage alt={person.name} src={person.image} /> : null}
          <AvatarFallback>{initials || <Icon aria-hidden={true} name="user" size={20} />}</AvatarFallback>
        </Avatar>
        <div className="grid min-w-0 gap-2">
          <h2 className="break-words font-heading text-xl font-semibold leading-none">{person?.name ?? t("settings.profile")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.profileDescription")}</p>
        </div>
      </div>
      <ProfileSettingsTabs bookable={isBookableStaff(person?.staff)} disabled={disabled} />
    </header>
  )
}
