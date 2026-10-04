import {
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
  defaultShouldDehydrateQuery,
} from "@tanstack/react-query"
import {
  createTRPCClient,
  httpBatchStreamLink,
  httpLink,
  splitLink,
  loggerLink,
  TRPCClientError,
  type TRPCLink,
} from "@trpc/client"
import { observable } from "@trpc/server/observable"
import { createTRPCContext, createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { useState, type PropsWithChildren } from "react"
import superjson from "superjson"
import type { AppRouter } from "~/.server/main"
import { useDehydratedState } from "~/lib/hooks"
import { queryCacheOptions } from "~/lib/query-cache"

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: queryCacheOptions,
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient()
  }

  browserQueryClient ??= makeQueryClient()

  return browserQueryClient
}

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin
  }

  if (process.env.VITE_URL) {
    return `https://${process.env.VITE_URL}`
  }

  return "http://localhost:5173"
}

let authRedirectStarted = false

function redirectUnauthorizedToAuth() {
  if (
    typeof window === "undefined" ||
    authRedirectStarted ||
    window.location.pathname === "/auth"
  ) {
    return
  }

  authRedirectStarted = true
  window.sessionStorage.setItem("sessionExpiredToast", "1")

  const redirectTo = `${window.location.pathname}${window.location.search}`
  const searchParams = new URLSearchParams({
    redirectTo,
    sessionExpired: "1",
  })

  window.location.replace(`/auth?${searchParams.toString()}`)
}

function unauthorizedRedirectLink(): TRPCLink<AppRouter> {
  return () => ({ next, op }) =>
    observable((observer) => {
      const subscription = next(op).subscribe({
        complete: () => observer.complete(),
        error: (error) => {
          if (
            error instanceof TRPCClientError &&
            error.data?.code === "UNAUTHORIZED"
          ) {
            redirectUnauthorizedToAuth()
          }

          observer.error(error)
        },
        next: (value) => observer.next(value),
      })

      return subscription.unsubscribe
    })
}

const links = [
  loggerLink({
    enabled: (op) =>
      process.env.NODE_ENV === "development" ||
      (op.direction === "down" && op.result instanceof Error),
  }),
  unauthorizedRedirectLink(),
  splitLink({
    // Preference cookies must be written before response headers are streamed.
    condition: (op) =>
      op.path === "profile.updatePreferences" ||
      op.path === "profile.updateTheme" ||
      op.path === "profile.updateLocale",
    true: httpLink({ transformer: superjson, url: `${getBaseUrl()}/api/trpc` }),
    false: httpBatchStreamLink({
      transformer: superjson,
      url: `${getBaseUrl()}/api/trpc`,
      headers() {
        const headers = new Headers()
        headers.set("x-trpc-source", "react")
        return headers
      },
    }),
  }),
]

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()

export const trpc = createTRPCClient<AppRouter>({
  links,
})

export function getClientTRPC() {
  const queryClient = getQueryClient()

  return {
    queryClient,
    trpc: createTRPCOptionsProxy({
      client: trpc,
      queryClient,
    }),
  }
}

export function TRPCReactProvider({ children }: PropsWithChildren) {
  const queryClient = getQueryClient()
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links,
    }),
  )
  const state = useDehydratedState()

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        <HydrationBoundary state={state}>{children}</HydrationBoundary>
      </TRPCProvider>
    </QueryClientProvider>
  )
}
