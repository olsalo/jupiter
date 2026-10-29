import { redirect } from "react-router"
import { TRPCError } from "@trpc/server"
import { getHTTPStatusCodeFromError } from "@trpc/server/http"
import { createTRPC } from "~/lib/trpc/server"
import { getQueryClient } from "~/lib/trpc/client"
import type { Route } from "./+types/booking-image"

export async function loader(args: Route.LoaderArgs) {
  try {
    const trpc = await createTRPC(args)
    const url = await getQueryClient().query(trpc.booking.getImage.queryOptions({ organizationSlug: args.params.organizationSlug, bookingPageSlug: args.params.bookingPageSlug }))
    return redirect(url, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } })
  } catch (error) {
    throw new Response(null, { status: error instanceof TRPCError ? getHTTPStatusCodeFromError(error) : 500, headers: { "Cache-Control": "no-store" } })
  }
}
