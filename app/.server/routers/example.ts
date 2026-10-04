import type { TRPCRouterRecord } from "@trpc/server"
import { TRPCError } from "@trpc/server"

import { protectedProcedure } from "../trpc"
import { throwIfForcedServerError } from "../forced-error"
import { generateId } from "~/lib/id"
import { z } from "~/lib/zod"

const noteInput = z.object({
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(1000),
})

const noteIdInput = z.object({
  id: z.string().min(1),
})

export const exampleRouter = {
  count: protectedProcedure.query(({ ctx }) => {
    const organizationId = requireOrganizationId(ctx.organizationId)

    return ctx.prisma.note.count({ where: { organizationId } })
  }),

  list: protectedProcedure.query(({ ctx }) => {
    const organizationId = requireOrganizationId(ctx.organizationId)

    return ctx.prisma.note.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      where: {
        organizationId,
      },
    })
  }),

  get: protectedProcedure.input(noteIdInput).query(async ({ ctx, input }) => {
    const organizationId = requireOrganizationId(ctx.organizationId)
    const note = await ctx.prisma.note.findFirst({
      where: {
        id: input.id,
        organizationId,
      },
    })

    if (!note) {
      throw new TRPCError({ code: "NOT_FOUND" })
    }

    return note
  }),

  create: protectedProcedure.input(noteInput).mutation(({ ctx, input }) => {
    throwIfForcedServerError()

    const organizationId = requireOrganizationId(ctx.organizationId)

    return ctx.prisma.note.create({
      data: {
        ...input,
        id: generateId("note"),
        organizationId,
      },
    })
  }),

  update: protectedProcedure
    .input(noteIdInput.extend(noteInput.shape))
    .mutation(async ({ ctx, input }) => {
      throwIfForcedServerError()

      const organizationId = requireOrganizationId(ctx.organizationId)
      const note = await ctx.prisma.note.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
      })

      if (!note) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }

      return ctx.prisma.note.update({
        data: {
          title: input.title,
          body: input.body,
        },
        where: {
          id: input.id,
        },
      })
    }),

  delete: protectedProcedure.input(noteIdInput).mutation(async ({ ctx, input }) => {
    const organizationId = requireOrganizationId(ctx.organizationId)
    const note = await ctx.prisma.note.findFirst({
      where: {
        id: input.id,
        organizationId,
      },
    })

    if (!note) {
      throw new TRPCError({ code: "NOT_FOUND" })
    }

    await ctx.prisma.note.delete({
      where: {
        id: input.id,
      },
    })

    return {
      id: input.id,
    }
  }),
} satisfies TRPCRouterRecord

function requireOrganizationId(organizationId: string | null) {
  if (!organizationId) {
    throw new TRPCError({ code: "FORBIDDEN" })
  }

  return organizationId
}
