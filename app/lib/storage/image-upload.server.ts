import { randomUUID } from "node:crypto"
import { TRPCError } from "@trpc/server"
import sharp from "sharp"
import { imageUploadMaxBytes, imageUploadTypes, landscapeImageRequiredError } from "./image-upload"
import { getObjectUrl, putObject } from "./object-storage.server"

type ImageScope = { organizationId: string; folder: string }
let activeEncoders = 0

export function isScopedImageKey(key: string, { organizationId, folder }: ImageScope) {
  // Accept previously saved WebP keys while all new uploads use AVIF
  return key.startsWith(`${folder}/${organizationId}/`) && /^[\w/-]+\.(?:avif|webp)$/.test(key) && !key.includes("..")
}

export async function uploadImage({ organizationId, folder, base64, requireLandscape = false }: ImageScope & { base64: string; requireLandscape?: boolean }) {
  if (activeEncoders >= 2) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Please try the image upload again shortly" })
  activeEncoders++
  try {
    return await encodeAndUpload({ organizationId, folder, base64, requireLandscape })
  } finally {
    activeEncoders--
  }
}

async function encodeAndUpload({ organizationId, folder, base64, requireLandscape }: ImageScope & { base64: string; requireLandscape: boolean }) {
  if (!/^[\w-]+$/.test(folder) || !/^[\w-]+$/.test(organizationId)) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid image scope" })
  const source = Buffer.from(base64, "base64")
  if (!source.length || source.length > imageUploadMaxBytes) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid image size" })
  let body: Buffer
  try {
    const image = sharp(source, { limitInputPixels: 40_000_000 })
    const metadata = await image.metadata()
    if (!imageUploadTypes.includes(metadata.mediaType ?? "") || (metadata.pages ?? 1) > 1) throw new Error("Unsupported image")
    const rotated = metadata.orientation !== undefined && metadata.orientation >= 5 && metadata.orientation <= 8
    const width = rotated ? metadata.height : metadata.width
    const height = rotated ? metadata.width : metadata.height
    if (requireLandscape && (!width || !height || width <= height)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: landscapeImageRequiredError })
    }
    body = await image.rotate().resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true }).avif({ quality: 65, effort: 4 }).toBuffer()
    if (body.length > imageUploadMaxBytes) throw new Error("Image is too large")
  } catch (error) {
    if (error instanceof TRPCError) throw error
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a valid JPG, PNG, WebP or AVIF image" })
  }
  const key = `${folder}/${organizationId}/${randomUUID()}.avif`
  await putObject({ key, body, contentType: "image/avif" })
  return { key, url: await getObjectUrl(key) }
}

