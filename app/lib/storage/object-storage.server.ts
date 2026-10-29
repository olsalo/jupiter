import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { TRPCError } from "@trpc/server"

export function isObjectStorageReady() {
  return Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY)
}

function storage() {
  if (!isObjectStorageReady()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Object storage is not configured" })
  let endpoint: URL
  try {
    const configured = process.env.S3_ENDPOINT!.trim()
    // RustFS also accepts host:port settings, which use HTTP unless a scheme is supplied
    const hostOnly = /^(?:[a-z\d](?:[a-z\d.-]*[a-z\d])?|\[[a-f\d:]+\])(?::\d+)?\/?$/i.test(configured)
    endpoint = new URL(hostOnly ? `http://${configured}` : configured)
    if (!["http:", "https:"].includes(endpoint.protocol) || !endpoint.hostname || endpoint.username || endpoint.password) throw new Error("Invalid endpoint")
  } catch {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "S3_ENDPOINT must be a hostname with an optional port, or a full http:// or https:// URL" })
  }
  return {
    bucket: process.env.S3_BUCKET!,
    client: new S3Client({
      endpoint: endpoint.href,
      region: process.env.S3_REGION || "eu-north-1",
      forcePathStyle: true,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
    }),
  }
}

export async function putObject({ key, body, contentType }: { key: string; body: Buffer; contentType: string }) {
  const { client, bucket } = storage()
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "private, max-age=300" }))
}

export async function verifyObject(key: string) {
  const { client, bucket } = storage()
  await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
}

export async function getObjectUrl(key: string, expiresIn = 300) {
  const { client, bucket } = storage()
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn })
}

export async function deleteObject(key: string) {
  const { client, bucket } = storage()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

export async function listObjects(prefix: string) {
  const { client, bucket } = storage()
  const result = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: 1000 }))
  // Never underestimate usage when a prefix exceeds the bounded listing.
  if (result.IsTruncated) throw new TRPCError({ code: "FORBIDDEN", message: "Image storage is full" })
  return result.Contents ?? []
}
