import { TRPCError } from "@trpc/server"
import type { PrismaClient } from "../../../generated/prisma/client"
import { getBookingPageImageKey } from "~/lib/booking/booking-page-image"
import { imageUploadMaxBytes } from "~/lib/storage/image-upload"
import { isScopedImageKey, uploadImage } from "~/lib/storage/image-upload.server"
import { deleteObject, isObjectStorageReady, listObjects } from "~/lib/storage/object-storage.server"
import { consumeRequestBudgets } from "./request-budget"
import { schedulingLock } from "./scheduling"

const folder = "booking-pages"
const orphanLifetimeMs = 24 * 3600000
const maxObjects = 20
const maxStorageBytes = 40 * 1024 * 1024

export async function pruneBookingImages(db: PrismaClient, organizationId: string, now = new Date()) {
  if (!isObjectStorageReady()) return
  await db.$transaction(async (tx) => {
    // Saving an image uses this lock too, so cleanup cannot delete an image
    // between verification and the page update that attaches it.
    await schedulingLock(tx, organizationId)
    const pages = await tx.bookingPage.findMany({ where: { organizationId }, select: { metadata: true } })
    const attached = new Set(pages.map((page) => getBookingPageImageKey(page.metadata)))
    const objects = await listObjects(`${folder}/${organizationId}/`)
    for (const object of objects) {
      const key = object.Key
      if (key && isScopedImageKey(key, { organizationId, folder }) && !attached.has(key) && object.LastModified && +object.LastModified < +now - orphanLifetimeMs) {
        await deleteObject(key)
      }
    }
  }, { timeout: 60000 })
}

export async function uploadBookingImage(db: PrismaClient, organizationId: string, base64: string) {
  await consumeRequestBudgets(db, [
    { key: `image:${organizationId}:minute`, maximum: 3, windowMs: 60000 },
    { key: `image:${organizationId}:day`, maximum: 20, windowMs: 86400000 },
    { key: "image:global:minute", maximum: 30, windowMs: 60000 },
  ])
  return db.$transaction(async (tx) => {
    // Reject concurrent uploads from this organization instead of queueing work.
    const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtextextended(${`image-upload:${organizationId}`}, 0)) AS acquired`
    if (!lock?.acquired) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "An image is already uploading" })
    const objects = await listObjects(`${folder}/${organizationId}/`)
    const bytes = objects.reduce((sum, object) => sum + (object.Size ?? 0), 0)
    if (objects.length >= maxObjects || bytes + imageUploadMaxBytes > maxStorageBytes) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Image storage is full" })
    }
    return uploadImage({ organizationId, folder, base64, requireLandscape: true })
  }, { timeout: 60000 })
}

export async function pruneAllBookingImages(db: PrismaClient) {
  if (!isObjectStorageReady()) return
  let cursor: string | undefined
  let failed = 0
  do {
    const organizations = await db.organization.findMany({ select: { id: true }, orderBy: { id: "asc" }, take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) })
    for (const organization of organizations) {
      try {
        await pruneBookingImages(db, organization.id)
      } catch {
        failed++
        console.error("Booking image cleanup failed", { organizationId: organization.id })
      }
    }
    cursor = organizations.length === 100 ? organizations.at(-1)?.id : undefined
  } while (cursor)
  return { failed }
}
