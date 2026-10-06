import type { Route } from "./+types/invite"
import { JoinTeamInvitation } from "~/components/join-team-invitation"
import { requireAuthMiddleware } from "~/middleware/auth"

export const middleware: Route.MiddlewareFunction[] = [requireAuthMiddleware]

export default function Invite({ params }: Route.ComponentProps) {
  return <JoinTeamInvitation invitationId={params.invitationId} />
}
