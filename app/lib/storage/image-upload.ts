import { z } from "~/lib/validation/zod"

export const landscapeImageRequiredError = "LANDSCAPE_IMAGE_REQUIRED"

export const imageUploadMaxBytes = 20 * 1024 * 1024
export const imageUploadTypes: readonly string[] = ["image/jpeg", "image/png", "image/webp", "image/avif"]
export const imageUploadAccept = [...imageUploadTypes, ".jpg", ".jpeg", ".png", ".webp", ".avif"].join(",")
export type UploadedImage = { key: string; url: string }

export const imageUploadSchema = z.object({
  base64: z.string().min(1).max(Math.ceil(imageUploadMaxBytes / 3) * 4).refine((value) => {
    const data = value.endsWith("==") ? value.slice(0, -2) : value.endsWith("=") ? value.slice(0, -1) : value
    // Avoid matching multi-megabyte input with a repeating pattern, which can
    // overflow the JavaScript engine's regex stack for valid phone photos.
    return data.length > 0 && !/[^A-Za-z0-9+/]/.test(data)
  }),
})

export function isValidImageFile(file: Pick<File, "type" | "size"> & { name?: string }) {
  if (file.size <= 0 || file.size > imageUploadMaxBytes) return false
  const type = file.type.toLowerCase()
  if (imageUploadTypes.includes(type) || type === "image/jpg" || type === "image/pjpeg") return true
  // File pickers can omit the MIME type or return a generic binary type.
  // The server still validates the actual image contents before storing it.
  return (!type || type === "application/octet-stream") && /\.(?:jpe?g|png|webp|avif)$/i.test(file.name ?? "")
}

export function readImageBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(",")[1])
    reader.onerror = () => reject(reader.error)
    reader.onabort = () => reject(new Error("File reading cancelled"))
    reader.readAsDataURL(file)
  })
}
