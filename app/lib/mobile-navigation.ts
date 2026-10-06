import type { QueryClient, QueryKey } from "@tanstack/react-query"

export const desktopViewportQuery =
  "(min-width: 768px) and (pointer: fine), (min-width: 768px) and (min-height: 600px), (min-width: 768px) and (orientation: portrait)"

export function clearMobileNavigationQuery(
  queryClient: QueryClient,
  queryKey: QueryKey,
  request: Request,
  pathname: string,
) {
  if (
    typeof window === "undefined" ||
    window.matchMedia(desktopViewportQuery).matches ||
    (new URL(request.url).pathname.replace(/\/+$/, "") || "/") !== pathname
  ) {
    return
  }

  // Keep active pages (including lists behind dialogs) and count queries intact.
  // The destination's useQuery starts a fresh fetch after its loading UI mounts.
  queryClient.removeQueries({ queryKey, exact: true, type: "inactive" })
}
