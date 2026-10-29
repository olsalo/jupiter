import "dotenv/config"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { createServer as createHttpServer } from "node:http"
import { initTRPC } from "@trpc/server"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import superjson from "superjson"
import sharp from "sharp"
import { createServer } from "vite"

const objects = new Map<string, Buffer>()
const storage = createHttpServer(async (request, response) => {
  const path = new URL(request.url!, "http://localhost").pathname
  if (request.method === "PUT") {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    objects.set(path, Buffer.concat(chunks))
    assert.equal(request.headers["content-type"], "image/avif")
    assert.match(request.headers.authorization ?? "", /^AWS4-HMAC-SHA256 /)
    response.writeHead(200, { ETag: '"test"' }).end()
  } else if (request.method === "DELETE") {
    assert.match(request.headers.authorization ?? "", /^AWS4-HMAC-SHA256 /)
    objects.delete(path)
    response.writeHead(204).end()
  } else if (request.method === "HEAD") {
    response.writeHead(objects.has(path) ? 200 : 404).end()
  } else response.writeHead(405).end()
})
await new Promise<void>((resolve) => storage.listen(0, "127.0.0.1", resolve))
const address = storage.address() as { port: number }
process.env.S3_ENDPOINT = `http://127.0.0.1:${address.port}`
process.env.S3_BUCKET = "test-images"
process.env.S3_ACCESS_KEY_ID = "test-key"
process.env.S3_SECRET_ACCESS_KEY = "test-secret"
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/booking-page-image", appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { ws: false, middlewareMode: true, hmr: false, watch: null } })
try {
  const { uploadImage, isScopedImageKey } = await vite.ssrLoadModule("/app/lib/storage/image-upload.server.ts") as typeof import("../app/lib/storage/image-upload.server.ts")
  const { verifyObject, deleteObject, getObjectUrl } = await vite.ssrLoadModule("/app/lib/storage/object-storage.server.ts") as typeof import("../app/lib/storage/object-storage.server.ts")
  const { isValidImageFile, imageUploadTypes, imageUploadSchema } = await vite.ssrLoadModule("/app/lib/storage/image-upload.ts") as typeof import("../app/lib/storage/image-upload.ts")
  const endpoint = process.env.S3_ENDPOINT
  try {
    process.env.S3_ENDPOINT = `127.0.0.1:${address.port}`
    assert.equal(new URL(await getObjectUrl("test")).origin, endpoint)
    process.env.S3_ENDPOINT = "https://storage.example.com"
    assert.equal(new URL(await getObjectUrl("test")).origin, "https://storage.example.com")
    process.env.S3_ENDPOINT = "not a valid endpoint"
    await assert.rejects(verifyObject("test"), { code: "PRECONDITION_FAILED" })
    process.env.S3_ENDPOINT = "ftp://localhost:9000"
    await assert.rejects(verifyObject("test"), { code: "PRECONDITION_FAILED" })
  } finally {
    process.env.S3_ENDPOINT = endpoint
  }
  const scope = { organizationId: "org-123", folder: "booking-pages" }
  assert.ok(imageUploadTypes.includes("image/avif"))
  assert.equal(isValidImageFile({ type: "image/avif", size: 100 }), true)
  assert.equal(isValidImageFile({ type: "image/avif", size: 0 }), false)
  assert.equal(isValidImageFile({ type: "image/avif", size: 20 * 1024 * 1024 }), true)
  assert.equal(isValidImageFile({ type: "image/avif", size: 20 * 1024 * 1024 + 1 }), false)
  assert.equal(isValidImageFile({ type: "image/svg+xml", size: 100 }), false)
  for (const type of ["image/jpeg", "image/jpg", "image/pjpeg", "", "application/octet-stream"]) {
    assert.equal(isValidImageFile({ type, name: "IMG_20261029_122150.JPG", size: 3_520_679 }), true, `Phone JPG files accept MIME type ${JSON.stringify(type)}`)
    assert.equal(isValidImageFile({ type, name: "photo.jpg", size: 0 }), false)
    assert.equal(isValidImageFile({ type, name: "photo.jpg", size: 20 * 1024 * 1024 + 1 }), false)
  }
  for (const type of ["", "application/octet-stream"]) {
    for (const name of ["photo.heic", "photo.svg", "photo.jpg.exe", "photo"]) {
      assert.equal(isValidImageFile({ type, name, size: 100 }), false, "Unknown MIME types require a supported extension")
    }
  }
  assert.equal(isValidImageFile({ type: "image/svg+xml", name: "photo.jpg", size: 100 }), false, "Explicit unsupported MIME types are rejected")
  assert.equal(imageUploadSchema.safeParse({ base64: "invalid!" }).success, false)
  for (const base64 of ["", "=", "==", "===", "a===", "a=b", "a==b", "a b", "a\nb", "ä"]) {
    assert.equal(imageUploadSchema.safeParse({ base64 }).success, false, "Malformed base64 is rejected")
  }
  for (const base64 of ["YQ==", "YWI=", "YWJj", "YWJjZA", "+/8="]) {
    assert.equal(imageUploadSchema.safeParse({ base64 }).success, true, "Padded and unpadded base64 remain supported")
  }
  // Exercise request decoding and input validation, rather than only invoking
  // the image processor with a small generated image.
  const trpc = initTRPC.create({ transformer: superjson })
  const router = trpc.router({ uploadImage: trpc.procedure.input(imageUploadSchema).mutation(({ input }) => ({ length: input.base64.length })) })
  const photoBase64 = randomBytes(3_520_679).toString("base64")
  const photoRequest = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: new Request("http://localhost/api/trpc/uploadImage?batch=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 0: superjson.serialize({ base64: photoBase64 }) }),
    }),
    router,
    createContext: () => ({}),
  })
  assert.equal(photoRequest.status, 200, "A multi-megabyte phone photo passes HTTP input validation without overflowing the stack")
  const photoResponse = await photoRequest.json()
  assert.equal(superjson.deserialize<{ length: number }>(photoResponse[0].result.data).length, photoBase64.length)
  assert.equal(imageUploadSchema.safeParse({ base64: `${photoBase64.slice(0, -3)}!AA` }).success, false, "Invalid characters at the end of large files are rejected")
  const source = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#aabbcc" } }).png().toBuffer()
  const uploaded = await uploadImage({ ...scope, requireLandscape: true, base64: source.toString("base64") })
  assert.equal(isScopedImageKey(uploaded.key, scope), true)
  assert.equal(isScopedImageKey(uploaded.key, { ...scope, organizationId: "other-org" }), false)
  assert.equal(isScopedImageKey("booking-pages/org-123/../other.avif", scope), false)
  assert.equal(isScopedImageKey("booking-pages/org-123/legacy.webp", scope), true, "Existing saved images remain valid")
  const saved = objects.get(`/test-images/${uploaded.key}`)!
  const image = await sharp(saved).metadata()
  assert.equal(image.mediaType, "image/avif")
  assert.equal(image.compression, "av1")
  assert.match(uploaded.key, /\.avif$/)
  assert.equal(image.width, 1920)
  assert.equal(image.height, 960)
  await verifyObject(uploaded.key)
  const signed = new URL(uploaded.url)
  assert.equal(signed.searchParams.get("X-Amz-Expires"), "300")
  assert.ok(signed.searchParams.get("X-Amz-Signature"))
  // Exercise every accepted decoder, including a real AVIF file.
  for (const format of ["jpeg", "png", "webp", "avif"] as const) {
    const source = await sharp({ create: { width: 64, height: 32, channels: 3, background: "#aabbcc" } }).toFormat(format).toBuffer()
    const result = await uploadImage({ ...scope, folder: "staff-images", base64: source.toString("base64") })
    assert.equal(isScopedImageKey(result.key, scope), false, "Keys cannot cross feature folders")
    assert.equal(isScopedImageKey(result.key, { ...scope, folder: "staff-images" }), true)
    const saved = await sharp(objects.get(`/test-images/${result.key}`)!).metadata()
    assert.equal(saved.mediaType, "image/avif")
    assert.equal(saved.compression, "av1")
    assert.match(result.key, /\.avif$/)
    assert.equal(saved.width, 64, "Small images are not enlarged")
    assert.equal(saved.height, 32)
  }
  const beforeLandscapeValidation = objects.size
  for (const dimensions of [{ width: 60, height: 120 }, { width: 60, height: 60 }]) {
    const source = await sharp({ create: { ...dimensions, channels: 3, background: "#aabbcc" } }).png().toBuffer()
    await assert.rejects(uploadImage({ ...scope, requireLandscape: true, base64: source.toString("base64") }), { code: "BAD_REQUEST", message: "LANDSCAPE_IMAGE_REQUIRED" })
  }
  const rotatedPortrait = await sharp({ create: { width: 120, height: 60, channels: 3, background: "#aabbcc" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer()
  await assert.rejects(uploadImage({ ...scope, requireLandscape: true, base64: rotatedPortrait.toString("base64") }), { code: "BAD_REQUEST", message: "LANDSCAPE_IMAGE_REQUIRED" })
  assert.equal(objects.size, beforeLandscapeValidation, "Portrait and square covers never reach storage")
  const rotatedLandscape = await sharp({ create: { width: 60, height: 120, channels: 3, background: "#aabbcc" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer()
  const landscape = await uploadImage({ ...scope, requireLandscape: true, base64: rotatedLandscape.toString("base64") })
  const landscapeMetadata = await sharp(objects.get(`/test-images/${landscape.key}`)!).metadata()
  assert.ok(landscapeMetadata.width! > landscapeMetadata.height!, "Phone orientation is applied before checking landscape")
  const maximumSizeImage = Buffer.concat([source, Buffer.alloc(20 * 1024 * 1024 - source.length)])
  const maximumSizeBase64 = maximumSizeImage.toString("base64")
  assert.equal(imageUploadSchema.safeParse({ base64: maximumSizeBase64 }).success, true, "The request schema accepts a 20 MB image after base64 encoding")
  await uploadImage({ ...scope, requireLandscape: true, base64: maximumSizeBase64 })
  const validCount = objects.size
  await assert.rejects(uploadImage({ ...scope, folder: "../other", base64: source.toString("base64") }), { code: "BAD_REQUEST" })
  for (const source of [Buffer.from("invalid"), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'), Buffer.alloc(20 * 1024 * 1024 + 1)]) {
    await assert.rejects(uploadImage({ ...scope, base64: source.toString("base64") }), { code: "BAD_REQUEST" })
  }
  assert.equal(objects.size, validCount, "Invalid files never reach storage")
  await deleteObject(uploaded.key)
  assert.equal(objects.has(`/test-images/${uploaded.key}`), false)
  await deleteObject(uploaded.key)
  assert.equal(objects.size, validCount - 1, "Repeated deletion is safe")
  console.info("PASS private S3 deletion, upload, signed reads, tenant and feature isolation, JPG/PNG/WebP/AVIF validation and resizing")
} finally {
  await vite.close()
  await new Promise<void>((resolve, reject) => storage.close((error) => error ? reject(error) : resolve()))
}
