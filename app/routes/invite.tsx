import type { Route } from "./+types/invite"
import { useTranslation } from "react-i18next"
import { JoinTeamInvitation } from "~/components/join-team-invitation"
import { requireAuthMiddleware } from "~/middleware/auth"

export const middleware: Route.MiddlewareFunction[] = [requireAuthMiddleware]

export default function Invite({ params }: Route.ComponentProps) {
  const { t } = useTranslation("team")

  return (
    <>
      <title>{t("metaTitle")}</title>
      <JoinTeamInvitation invitationId={params.invitationId} />
    </>
  )
}
