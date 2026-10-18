import { useTranslation } from "react-i18next"
import { InviteMemberDialog } from "~/components/invite-member-dialog"
import { Button } from "~/components/ui/button"
import { hasOrganizationRole } from "~/lib/utils"
import type { TeamPerson } from "./team-types"

export function TeamPersonAbout({ person, canManage }: { person: TeamPerson; canManage: boolean }) {
  const { t } = useTranslation("team")
  const bookable = Boolean(person.staff?.isActive && person.staff.acceptsAppointments)
  const details = [
    { label: t("name"), value: person.name },
    { label: t("email"), value: person.email ? <a className="underline-offset-4 hover:underline" href={`mailto:${person.email}`}>{person.email}</a> : "—" },
    { label: t("people.phone"), value: person.phone ? <a className="underline-offset-4 hover:underline" href={`tel:${person.phone}`}>{person.phone}</a> : "—" },
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
    <div>
      <h3 className="text-sm font-medium">{t("people.about")}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("people.aboutDescription")}</p>
      <dl className="mt-4 divide-y">
        {details.map((detail) => (
          <div className="grid gap-1.5 py-4 text-sm sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center sm:gap-4" key={detail.label}>
            <dt className="text-muted-foreground">{detail.label}</dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words">{detail.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
