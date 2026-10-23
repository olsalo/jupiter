import type { TRPCRouterRecord } from "@trpc/server"
import { permissionProcedure } from "../trpc"
import { createResourceLimits } from "../resource-limits/service"

export const resourceLimitsRouter = {
  getAll: permissionProcedure({ billing: ["manage"] }).query(({ ctx }) =>
    createResourceLimits(ctx.prisma).getAll(ctx.organizationId)),
} satisfies TRPCRouterRecord
