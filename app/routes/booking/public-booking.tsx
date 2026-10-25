import type { Route } from "./+types/public-booking"
import { PublicBookingPage } from "~/components/public-booking/public-booking-page"
import { loadPublicBookingQuery } from "~/lib/booking/public-booking-loader.server.ts"
import { getQueryClient } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { shouldRevalidateAppRoute } from "~/lib/routing/should-revalidate"

export const shouldRevalidate = shouldRevalidateAppRoute

export async function loader(args: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(args)
  const pageQuery = trpc.booking.getPage.queryOptions(
    {
      organizationSlug: args.params.organizationSlug,
      bookingPageSlug: args.params.bookingPageSlug,
    },
    { retry: false },
  )
  return loadPublicBookingQuery(queryClient, pageQuery.queryKey, () => queryClient.query(pageQuery))
}

export function clientLoader() {
  // Client queries own fetching and freshness after the initial server render.
  return null
}

export default function Page({ params }: Route.ComponentProps) {
  return (
    <PublicBookingPage
      bookingPageSlug={params.bookingPageSlug}
      key={`${params.organizationSlug}/${params.bookingPageSlug ?? ""}`}
      organizationSlug={params.organizationSlug}
    />
  )
}
