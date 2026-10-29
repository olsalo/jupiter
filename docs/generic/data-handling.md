# Data Handling

The template uses tRPC for backend procedures and TanStack Query for application data, caching, freshness, and mutations. React Router owns navigation, route/app state, redirects, and the initial server render.

The goal is to render a page immediately on client navigation without waiting for its data request. Cached data stays visible where available, and components show loading or error states when data is missing.

## Who owns what

| Concern | Owner |
| --- | --- |
| Session, locale, theme, and format preferences | Root loader |
| Workspace context and onboarding/subscription redirects | Workspace layout loader |
| Initial application data for SSR | Page loader seeds TanStack Query through tRPC |
| Application data after hydration | `useQuery` / `useInfiniteQuery` |
| Application form submissions | tRPC with `useMutation` |
| Data freshness after a mutation | Query cache updates and invalidation |
| Refreshing loader-owned app state | Explicit React Router revalidation |

Do not use React Router actions for application mutations. Do not use Prisma directly in server loaders; call tRPC procedures through `createTRPC` instead.

## Direct visits and refreshes

On a direct URL visit or browser refresh:

1. Server middleware resolves authentication and request context
2. Root and layout loaders supply app state and perform required redirects
3. Query-backed page loaders fetch initial data through the server tRPC proxy and return a dehydrated query cache
4. React renders the page on the server
5. `TRPCReactProvider` hydrates the browser query cache, and component queries read that data using the same query keys

`createTRPC` executes procedures on the server without making a browser HTTP request to `/api/trpc`. It passes the request headers and authenticated middleware context into tRPC.

`getQueryClient()` creates a new client for each call on the server. It reuses one client in the browser. In a page loader, keep the query client in a local variable so the client used for fetching is also the client you dehydrate. There is no shared global server query cache.

`useDehydratedState` collects `queryClient` payloads from matched route loaders. The provider passes the combined state to `HydrationBoundary`. SuperJSON serializes and restores query data such as dates.

## Client navigation

Query-backed routes with a server loader use this client loader:

```ts
export function clientLoader() {
  // Client queries own fetching and freshness after the initial server render.
  return null
}
```

On client navigation, React Router runs `clientLoader` instead of automatically fetching that route's server loader. Because it returns immediately without calling `serverLoader()`, page data does not block navigation. The component's query then uses the cache or fetches data.

Returning `null` does not clear the query cache. It only means this navigation supplies no loader data for that route. Components must read application data from queries rather than depend on the page loader's payload remaining available.

| Query state | Component behavior |
| --- | --- |
| Fresh cached data | Render cached data without a mount-triggered refetch |
| Stale cached data | Render cached data while refreshing in the background |
| Invalidated data | Refresh active queries; inactive queries remain stale for their next use |
| No cached data | Render the page's loading state while the query fetches |
| Failed background refresh | Keep existing data visible and offer retry |

These behaviors depend on the query's options. Polling and explicit refetches can still fetch fresh cached data.

Add the no-op client loader when introducing a query-backed page with an SSR loader. A component-only route with no loader does not need one just to render. Do not replace client loaders that provide required route state or redirects with `null`.

### Route example

This is the pattern used by query-backed pages such as the notes example:

```ts
import { dehydrate, useQuery } from "@tanstack/react-query"
import type { Route } from "./+types/example"
import { getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"

export async function loader(args: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(args)

  await queryClient.query(trpc.example.list.queryOptions()).catch(() => undefined)

  return { queryClient: dehydrate(queryClient) }
}

export function clientLoader() {
  // Client queries own fetching and freshness after the initial server render.
  return null
}
```

Inside the page component, read the same procedure and input through `useTRPC`:

```ts
const trpc = useTRPC()
const notes = useQuery(trpc.example.list.queryOptions())
```

Use matching query options and inputs on the server and client so hydration populates the cache entry the component reads. Paginated lists use `useInfiniteQuery` with matching infinite-query options in the loader.

## Why root and layout still use `shouldRevalidate`

`clientLoader` and `shouldRevalidate` solve different parts of navigation:

- The page's no-op `clientLoader` prevents its server fetch when entering the page
- Root and layout `shouldRevalidate` rules prevent shared server loaders from rerunning as the URL changes

Each route's `shouldRevalidate` controls its own loader, not parent loaders. It also does not prevent the initial load of a newly entered route. Removing the no-op client loader would therefore bring back page server requests when entering that page, even if its `shouldRevalidate` returned `false`.

The rules in [should-revalidate.ts](../../app/lib/routing/should-revalidate.ts) currently work as follows:

- The workspace layout skips revalidation when the pathname or search changes, including opening drawers and changing tabs or filters
- The workspace layout allows revalidation for the same pathname and search, including explicit revalidation, and for non-GET router submissions
- The root skips ordinary URL-change revalidation outside account routes, while retaining the router's default decision for same-URL revalidation and non-GET submissions
- Transitions involving `/auth`, `/onboarding`, its steps, or `/invite/:id` retain the root's default revalidation behavior

Pages with no-op client loaders do not need a separate `shouldRevalidate` export. Rerunning those client loaders performs no data request. TanStack Query freshness is independent of these router rules.

This removes data-fetching waits from ordinary workspace navigation. Initial workspace entry, account transitions, required redirects, route code loading, and explicit shell revalidation may still take time.

## Cache and background refresh

The shared defaults in [query-cache.ts](../../app/lib/query/query-cache.ts) are:

| Option | Value | Effect |
| --- | --- | --- |
| `staleTime` | 1 minute | Data stays fresh for one minute unless invalidated |
| `gcTime` | 10 minutes | Inactive queries remain cached for ten minutes |
| `refetchInterval` | 1 minute | Mounted, enabled queries poll in the background |
| `refetchOnWindowFocus` | `true` | Stale active queries can refresh when focus returns |

Navigation does not guarantee that no request happens. It means page data requests are owned by queries and do not hold up the route transition. Fresh revisits can reuse data, while polling continues according to query options.

Individual queries can override the defaults. Choose refresh behavior for the feature: reference data may need less polling, while an active editor may need to pause background refreshes. See [Jupiter-specific behavior](../jupiter/data-handling.md) for the scheduling implementation.

## Mutations and forms

Application submissions use `useMutation(trpc.someProcedure.mutationOptions())`. They do not automatically trigger React Router action revalidation.

On success, update any cache entries returned by the mutation and invalidate related queries. For example, the note edit route updates the detail cache and invalidates the list before navigating:

```ts
const updateMutation = useMutation(trpc.example.update.mutationOptions({
  onSuccess: async (savedNote) => {
    queryClient.setQueryData(
      trpc.example.get.queryKey({ id: params.noteId }),
      savedNote,
    )
    await queryClient.invalidateQueries(trpc.example.list.queryFilter())
    await navigate("..", { replace: true })
  },
}))
```

Invalidate all affected query families, including lists, counts, details, and calendar ranges where applicable. Await invalidation when the destination needs updated data before the submission completes. Keep background refreshes independent when the existing UI can safely remain visible.

Use `revalidator.revalidate()` when a mutation changes loader-owned app state, such as locale or format preferences. Query invalidation does not refresh root/layout loader data. Conversely, router revalidation does not replace query invalidation on pages with no-op client loaders.

Forms use RVF through [AppForm](../../app/components/forms/app-form.tsx), with `FormLabel` for labels, descriptions, and field errors. Submit through the tRPC mutation using `submitFn`. Do not use native HTML form validation. Associate expected validation errors with their inputs and use an error toast for unexpected submission failures. If submission navigates, include the next loader's pending state in the submit button's loading state.

Server procedures may validate, log, call services, or persist data as needed. If a form is only an example or diagnostic flow, keep persistence out of the procedure and return an explicit response such as `saved: false`.

## Loading, errors, and access checks

Components must handle pending queries because client navigation can reach them before data is available. Use the existing page or overlay loading patterns. Use COSS alerts for query errors and provide a retry action; retain usable cached content when a background refresh fails.

Internal SSR loaders can catch a failed prefetch so the component query owns recovery. This is a deliberate page-level choice, not a rule for all loaders. Public pages that need HTTP error statuses must preserve those statuses and expose only safe error details. See [Jupiter-specific behavior](../jupiter/data-handling.md) for the public booking implementation.

Skipping shared loader revalidation does not make cached route state an authorization check. Server tRPC procedures enforce authentication, organization membership, subscription, and permissions through their applicable procedure middleware. The browser tRPC client redirects `UNAUTHORIZED` responses to `/auth`.

## Client loaders that need route state

A client loader may return required local route state, read cached metadata, or redirect without making a data request. Keep those behaviors instead of replacing every client loader with `null`. Auth and setup parent loaders may also need server state and revalidation to choose the next route.

API/resource routes serve requests directly and do not use page client loaders. Current product exceptions are listed in [Jupiter data handling](../jupiter/data-handling.md).

## Related code and verification

- [Browser tRPC client, query client, and hydration provider](../../app/lib/trpc/client.tsx)
- [Server tRPC proxy](../../app/lib/trpc/server.ts)
- [Root loader](../../app/root.tsx) and [workspace layout](../../app/routes/layout.tsx)
- [Client navigation and cache behavior tests](../../tests/mobile-navigation.integration.ts)
- [Root/layout revalidation tests](../../tests/drawer-tab-navigation.test.ts)
