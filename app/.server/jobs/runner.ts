import { prisma } from "~/lib/database/prisma.server.ts"
import { expirePendingAppointments, pruneBookingRateLimits, sendPendingNotifications } from "./appointments"
import { pruneAllBookingImages } from "../services/booking-image-upload"

try {
  console.info(await expirePendingAppointments(prisma))
  console.info(await sendPendingNotifications(prisma))
  await pruneBookingRateLimits(prisma)
  console.info(await pruneAllBookingImages(prisma))
} finally {
  await prisma.$disconnect()
}
