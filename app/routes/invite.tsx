import { redirect } from "react-router"

import type { Route } from "./+types/invite"
import { joinInvitationSearchParam } from "~/lib/team-join"
import { requireAuthMiddleware } from "~/middleware/auth"

export const middleware: Route.MiddlewareFunction[] = [requireAuthMiddleware]

export function loader({ params }: Route.LoaderArgs) {
  const searchParams = new URLSearchParams({
    [joinInvitationSearchParam]: params.invitationId,
  })

  throw redirect(`/?${searchParams}`)
}
