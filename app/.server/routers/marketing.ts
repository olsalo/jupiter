import { TRPCError } from "@trpc/server"

import { trustedClientIp } from "~/lib/http/client-ip.server"
import { marketingAccessRequestSchema } from "~/lib/schemas/marketing"
import { sendMarketingAccessRequest } from "../services/marketing-access"
import { consumeRequestBudgets } from "../services/request-budget"
import { publicProcedure } from "../trpc"

export const marketingRouter = {
  requestAccess: publicProcedure.input(marketingAccessRequestSchema).mutation(async ({ ctx, input }) => {
    const clientIp = trustedClientIp(ctx.headers)
    await consumeRequestBudgets(ctx.prisma, [
      { key: "marketing-access:global", maximum: 100, windowMs: 3600000 },
      { key: `marketing-access:email:${input.email.toLowerCase()}`, maximum: 1, windowMs: 60000 },
      ...(clientIp ? [{ key: `marketing-access:ip:${clientIp}`, maximum: 5, windowMs: 3600000 }] : []),
    ])

    try {
      await sendMarketingAccessRequest(input)
    } catch (cause) {
      console.error("Marketing access request delivery failed", cause)
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to send access request", cause })
    }

    return { success: true }
  }),
}
