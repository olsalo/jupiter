import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"

import { appRouter } from "~/.server/main"
import { createTRPCContext } from "~/.server/trpc"

export function loader(args: LoaderFunctionArgs) {
  return handleRequest(args)
}

export function action(args: ActionFunctionArgs) {
  return handleRequest(args)
}

function handleRequest(args: LoaderFunctionArgs | ActionFunctionArgs) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: args.request,
    router: appRouter,
    createContext: ({ resHeaders }) =>
      createTRPCContext({
        headers: args.request.headers,
        request: args.request,
        responseHeaders: resHeaders,
      }),
  })
}
