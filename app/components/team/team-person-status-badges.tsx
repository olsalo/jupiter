import { useTranslation } from "react-i18next"

import { Badge } from "~/components/ui/badge"
import { hasOrganizationRole } from "~/lib/utils"
import type { TeamPerson } from "./team-types"

export function TeamPersonStatusBadges({ person }: { person: TeamPerson }) {
  const { t } = useTranslation("team")
  const bookable = Boolean(person.staff?.isActive && person.staff.acceptsAppointments)
  const role = person.member ? hasOrganizationRole(person.member.role, "owner") ? "roles.owner" : hasOrganizationRole(person.member.role, "admin") ? "roles.admin" : "roles.member" : null

  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge className="max-w-full max-sm:h-auto max-sm:whitespace-normal max-sm:py-0.5" variant={bookable ? "secondary" : "outline"}>{t(bookable ? "people.bookable" : "people.notBookable")}</Badge>
      <Badge className="max-w-full max-sm:hidden" variant="outline">{t(role ?? (person.invitation ? "people.accessInvited" : "people.accessNone"))}</Badge>
    </div>
  )
}
