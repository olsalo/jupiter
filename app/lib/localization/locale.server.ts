import { prisma } from "~/lib/database/prisma.server.ts"

export async function syncUserLocale({
  locale,
  userId,
}: {
  locale: string
  userId: string
}) {
  await prisma.user.updateMany({
    data: { locale },
    where: {
      id: userId,
      OR: [{ locale: null }, { locale: { not: locale } }],
    },
  })
}
