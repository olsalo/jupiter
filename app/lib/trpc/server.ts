import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import type { LoaderFunctionArgs } from "react-router"

import { appRouter } from "~/.server/main"
import { createTRPCContext } from "~/.server/trpc"
import { organizationContext, sessionContext } from "~/middleware/auth"
import { getQueryClient } from "~/lib/trpc/client"

export async function createTRPC(loaderArgs: LoaderFunctionArgs) {
  return createTRPCOptionsProxy({
    ctx: () => createTRPCContext({
      headers: loaderArgs.request.headers,
      authenticatedContext: {
        authSession: loaderArgs.context.get(sessionContext),
        organizationId: loaderArgs.context.get(organizationContext)?.id ?? null,
      },
    }),
    queryClient: getQueryClient,
    router: appRouter,
  })
}
