import { dehydrate } from "@tanstack/react-query"
import { Outlet } from "react-router"
import { getQueryClient } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import type { Route } from "./+types/appointment-layout"

export const handle = { overlay: true }

export async function loader(args: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(args)
  await queryClient.query(trpc.appointment.get.queryOptions({ id: args.params.appointmentId })).catch(() => undefined)
  return { queryClient: dehydrate(queryClient) }
}

export function clientLoader() {
  return null
}

export default function AppointmentLayoutRoute() {
  return <Outlet />
}
