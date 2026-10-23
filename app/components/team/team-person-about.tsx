import { useTranslation } from "react-i18next"
import { CopyableContact } from "~/components/copyable-contact"
import { SettingsSectionHeader } from "~/components/settings-section-header"
import { TeamPersonSection } from "./team-person-section"
import { InviteMemberDialog } from "~/components/invite-member-dialog"
import { Button } from "~/components/ui/button"
import { hasOrganizationRole } from "~/lib/utils"
import type { TeamPerson } from "./team-types"

export function TeamPersonAbout({ person, canManage }: { person: TeamPerson; canManage: boolean }) {
  const { t } = useTranslation("team")
  const bookable = Boolean(person.staff?.isActive && person.staff.acceptsAppointments)
  const details = [
    { label: t("name"), value: person.name },
    { label: t("email"), value: person.email ? <CopyableContact kind="email" value={person.email} /> : "—" },
    { label: t("people.phone"), value: person.phone ? <CopyableContact kind="phone" value={person.phone} /> : "—" },
    { label: t("people.appAccess"), value: (
      <div className="flex min-h-8 items-center justify-between gap-3 sm:min-h-7">
        {person.member ? <span>{t(hasOrganizationRole(person.member.role, "owner") ? "roles.owner" : hasOrganizationRole(person.member.role, "admin") ? "roles.admin" : "roles.member")}</span> : <>
          <span>{t(person.invitation ? "people.accessInvited" : "people.accessNone")}</span>
          {person.staff ? <InviteMemberDialog staffMemberId={person.staff.id} name={person.name} email={person.email ?? ""} trigger={<Button disabled={!canManage || !person.staff.isActive || Boolean(person.invitation)} size="sm" type="button" variant="outline">{t("people.inviteToApp")}</Button>} /> : null}
        </>}
      </div>
    ) },
    { label: t("people.appointments"), value: t(bookable ? "people.bookable" : "people.notBookable") },
    ...(person.staff?.bio ? [{ label: t("people.bio"), value: person.staff.bio }] : []),
  ]

  return (
    <TeamPersonSection header={<SettingsSectionHeader title={t("people.profile")} description={t("people.aboutDescription")} />}>
      <dl className="divide-y">
        {details.map((detail) => (
          <div className="grid gap-1.5 py-4 text-sm sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center sm:gap-4" key={detail.label}>
            <dt className="text-muted-foreground">{detail.label}</dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words">{detail.value}</dd>
          </div>
        ))}
      </dl>
    </TeamPersonSection>
  )
}
