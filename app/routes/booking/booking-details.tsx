import type { Route } from "./+types/booking-details"
import { BookingManagementPage } from "~/components/public-booking/booking-management-page"
import { loadPublicBookingQuery } from "~/lib/public-booking-loader.server"
import { getQueryClient } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"

export const shouldRevalidate = shouldRevalidateAppRoute

export async function loader(args: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(args)
  const pageQuery = trpc.booking.getManagementPage.queryOptions({ bookingCode: args.params.bookingCode }, { retry: false })
  return loadPublicBookingQuery(queryClient, pageQuery.queryKey, () => queryClient.query(pageQuery))
}

export function clientLoader() {
  return null
}

export default function Page({ params }: Route.ComponentProps) {
  return <BookingManagementPage bookingCode={params.bookingCode} key={params.bookingCode} />
}
