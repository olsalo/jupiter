import type { Prisma } from "../../../generated/prisma/client"

export async function getCustomerAppointments(prisma: Prisma.TransactionClient, organizationId: string, input: { id: string; scope: "all" | "upcoming" | "history" | "recent"; limit: number; cursor?: string | null }, now = new Date()) {
  const active = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] as const
  const scope: Prisma.AppointmentWhereInput = input.scope === "upcoming"
    ? { endsAt: { gt: now }, status: { in: [...active] } }
    : input.scope === "history" ? { OR: [{ endsAt: { lte: now } }, { status: { notIn: [...active] } }] }
    : input.scope === "recent" ? { endsAt: { lte: now } } : {}
  const order = input.scope === "upcoming" ? "asc" as const : "desc" as const
  const rows = await prisma.appointment.findMany({
    where: { organizationId, customerId: input.id, ...scope },
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    take: input.limit + 1,
    orderBy: [{ startsAt: order }, { id: order }],
    select: { id: true, startsAt: true, endsAt: true, status: true, services: { select: { name: true } } },
  })
  const hasMore = rows.length > input.limit
  if (hasMore) rows.pop()
  return { items: rows, nextCursor: hasMore ? rows.at(-1)?.id : undefined }
}
