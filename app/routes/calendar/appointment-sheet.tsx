import { dehydrate } from "@tanstack/react-query"
import { Outlet, useMatch } from "react-router"
import { RoutePlaceholderSheet } from "~/components/placeholders/route-placeholder-sheet"
import { getQueryClient } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import type { Route } from "./+types/appointment-sheet"

export const handle = { overlay: true }

export async function loader(args: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(args)
  await queryClient.fetchQuery(trpc.appointment.get.queryOptions({ id: args.params.appointmentId })).catch(() => undefined)
  return { queryClient: dehydrate(queryClient) }
}

export function clientLoader() {
  return null
}

export default function Details() {
  const rescheduling = useMatch("/calendar/:appointmentId/reschedule")
  return rescheduling ? <RoutePlaceholderSheet titleKey="appointment" returnTo="/calendar"><Outlet /></RoutePlaceholderSheet> : <Outlet />
}
