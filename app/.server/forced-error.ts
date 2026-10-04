import { TRPCError } from "@trpc/server"

export function throwIfForcedServerError() {
  if (process.env.FORCE_SERVER_ERROR !== "true") {
    return
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Server error forced for testing",
  })
}
