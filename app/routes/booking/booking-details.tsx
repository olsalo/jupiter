import { dehydrate } from "@tanstack/react-query"
import type { Route } from "./+types/booking-details"
import { BookingManagementPage } from "~/components/public-booking/booking-management-page"
import { getQueryClient } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"

export const shouldRevalidate = shouldRevalidateAppRoute

export async function loader(args: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(args)
  await queryClient.query(
    trpc.booking.getManagementPage.queryOptions({ bookingCode: args.params.bookingCode }, { retry: false }),
  ).catch(() => undefined)
  return { queryClient: dehydrate(queryClient) }
}

export function clientLoader() {
  return null
}

export default function Page({ params }: Route.ComponentProps) {
  return <BookingManagementPage bookingCode={params.bookingCode} key={params.bookingCode} />
}
