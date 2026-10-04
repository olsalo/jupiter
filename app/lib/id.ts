import { customAlphabet } from "nanoid"

const generateSuffix = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  12,
)

export function generateId(prefix: string) {
  return `${prefix}_${generateSuffix()}`
}
