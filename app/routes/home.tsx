import { redirect } from "react-router"

import type { Route } from "./+types/home"
import { requireAuthMiddleware } from "~/middleware/auth"

export const middleware: Route.MiddlewareFunction[] = [requireAuthMiddleware]

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  throw redirect(`/calendar${url.search}`)
}

export default function Home() {
  return null
}
