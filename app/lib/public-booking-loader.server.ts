import { dehydrate, type QueryClient, type QueryKey } from "@tanstack/react-query"
import { TRPCError } from "@trpc/server"
import { getHTTPStatusCodeFromError } from "@trpc/server/http"
import { data } from "react-router"

export async function loadPublicBookingQuery(
  queryClient: QueryClient,
  queryKey: QueryKey,
  load: () => Promise<unknown>,
) {
  let status = 200
  await load().catch((error: unknown) => {
    const code = error instanceof TRPCError ? error.code : "INTERNAL_SERVER_ERROR"
    status = error instanceof TRPCError ? getHTTPStatusCodeFromError(error) : 500
    // Only expose a public code and message, never server error details
    const publicError = {
      name: "TRPCClientError",
      message: "Booking page unavailable",
      data: { code },
    }
    queryClient.getQueryCache().find({ queryKey })?.setState({
      error: publicError,
      fetchFailureReason: publicError,
    })
  })

  return data({ queryClient: dehydrate(queryClient, { shouldDehydrateQuery: () => true }) }, { status })
}
