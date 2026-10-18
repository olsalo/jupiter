import { prisma } from "~/lib/prisma.server"
import { expirePendingAppointments, pruneBookingRateLimits, sendPendingNotifications } from "./appointments"

try {
  console.info(await expirePendingAppointments(prisma))
  console.info(await sendPendingNotifications(prisma))
  await pruneBookingRateLimits(prisma)
} finally {
  await prisma.$disconnect()
}
