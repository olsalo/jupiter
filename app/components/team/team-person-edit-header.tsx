import { UserAvatar } from "~/components/data-display/user-avatar"
import { cn } from "~/lib/utils"
import { TeamPersonStatusBadges } from "./team-person-status-badges"
import { TeamPersonTabs } from "./team-person-tabs"
import type { TeamPerson } from "./team-types"

export function TeamPersonEditHeader({ person, disabled, sideNavigation = false }: { person: TeamPerson; disabled: boolean; sideNavigation?: boolean }) {

  return (
    <div className="@container/profile-header shrink-0 border-b" data-slot="person-edit-header">
      <div className={cn("grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 px-6 pb-5 pt-10", sideNavigation && "sm:py-4.5")}>
        <UserAvatar className="size-14 text-lg" decorative={true} name={person.name} src={person.image} stableId={person.member?.user.id ?? person.id} />
        <div className="grid min-w-0 gap-2">
          <h2 className="break-words text-xl font-semibold leading-7">{person.name}</h2>
          <TeamPersonStatusBadges person={person} />
        </div>
      </div>
      <div className={cn("min-w-0 px-6", sideNavigation && "@min-[80rem]/team:hidden")}>
        <TeamPersonTabs mode="edit" disabled={disabled} />
      </div>
    </div>
  )
}
