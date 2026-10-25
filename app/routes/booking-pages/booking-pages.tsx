import { dehydrate } from "@tanstack/react-query"
import type { Route } from "./+types/booking-pages"
import { AdminBookingPage } from "~/components/booking-page/admin-booking-page"
import { getQueryClient } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { shouldRevalidateAppRoute } from "~/lib/routing/should-revalidate"

export const handle = { workspace: true, pageLayout: "scroll" } as const
export const shouldRevalidate = shouldRevalidateAppRoute

export async function loader(args: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(args)
  await queryClient.query(trpc.bookingPage.get.queryOptions()).catch(() => undefined)
  return { queryClient: dehydrate(queryClient) }
}

export function clientLoader() {
  return null
}

export default function Page() {
  return <AdminBookingPage />
}
