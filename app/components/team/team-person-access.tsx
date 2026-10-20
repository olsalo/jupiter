import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import Icon from "~/components/icons"
import { IconListItem } from "~/components/icon-list-item"
import { InvitationActionsMenu } from "~/components/invitation-actions-menu"
import { InviteMemberDialog } from "~/components/invite-member-dialog"
import { SettingsSectionHeader } from "~/components/settings-section-header"
import { TeamMemberActionsMenu } from "~/components/team-member-actions-menu"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { Separator } from "~/components/ui/separator"
import { formatDateTime } from "~/lib/format-preference"
import { useCurrentOrganizationRole } from "~/lib/use-organization-access"
import { hasOrganizationRole } from "~/lib/utils"
import { TeamPersonSection } from "./team-person-section"
import { TeamRoleMenu } from "./team-role-menu"
import type { TeamPerson } from "./team-types"

export function TeamPersonAccess({ person, disabled = false }: { person: TeamPerson; disabled?: boolean }) {
  const { t } = useTranslation("team")
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const ownRole = useCurrentOrganizationRole()
  const canManage = hasOrganizationRole(ownRole, "owner") || hasOrganizationRole(ownRole, "admin")
  const ownMember = person.member?.user.id === root?.user?.id
  const canChangeRole = Boolean(!disabled && canManage && person.member && !ownMember && !hasOrganizationRole(person.member.role, "owner"))
  const canRevoke = Boolean(!disabled && canManage && person.member && !ownMember && (!hasOrganizationRole(person.member.role, "owner") || hasOrganizationRole(ownRole, "owner")))
  const invitation = person.invitation
  const role = person.member ? hasOrganizationRole(person.member.role, "owner") ? "owner" : hasOrganizationRole(person.member.role, "admin") ? "admin" : "member" : "member"

  return (
    <TeamPersonSection header={<SettingsSectionHeader title={t("people.appAccess")} description={t("people.accessSettingsDescription")} />}>
    <div className="flex min-h-0 flex-1 flex-col gap-5" data-slot="team-person-access">
      {person.member ? <>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1 basis-48"><SettingsSectionHeader title={t("permissionLevel")} description={t("people.permissionsDescription")} /></div>
          <div className="ml-auto"><TeamRoleMenu disabled={!canChangeRole} memberId={person.member.id} role={role} /></div>
        </div>
        {!ownMember ? <>
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1 basis-48"><SettingsSectionHeader title={t("memberActions.revokeAccess")} description={t("memberActions.revokeDescription")} /></div>
            <div className="ml-auto"><TeamMemberActionsMenu canRevoke={canRevoke} memberId={person.member.id} memberName={person.name} triggerVariant="button" /></div>
          </div>
        </> : null}
      </> : invitation ? <section aria-label={t("pending")}>
        <h4 className="text-xs font-medium">{t("pending")}</h4>
        <ul className="mt-4 flex flex-col gap-3">
          <IconListItem icon="mail" actions={<InvitationActionsMenu canInvite={canManage} disabled={disabled} email={invitation.email} invitationId={invitation.id} />}>
              <span className="break-words text-sm font-medium">{invitation.email}</span>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{t(invitation.role === "admin" ? "roles.admin" : "roles.member")}</Badge>
                <span className="text-xs">{t("expires")} {formatDateTime(invitation.expiresAt, { formatPreference: root?.formatPreference ?? "eu", language: root?.locale === "fi" ? "fi" : "en", timeZone: root?.organizationTimezone, includeTime: false })}</span>
              </div>
          </IconListItem>
        </ul>
      </section> : <Empty className="min-h-0 w-full border-0 bg-transparent">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Icon aria-hidden={true} name="lock" /></EmptyMedia>
          <EmptyTitle>{t("people.accessNone")}</EmptyTitle>
          <EmptyDescription>{t("people.accessDescription")}</EmptyDescription>
        </EmptyHeader>
        {person.staff ? <EmptyContent><InviteMemberDialog staffMemberId={person.staff.id} name={person.name} email={person.email ?? ""} trigger={<Button disabled={disabled || !canManage || !person.staff.isActive} size="sm" type="button" variant="outline"><Icon aria-hidden={true} name="add" size={16} />{t("people.inviteToApp")}</Button>} /></EmptyContent> : null}
      </Empty>}
    </div>
    </TeamPersonSection>
  )
}
