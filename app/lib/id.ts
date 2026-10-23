import { customAlphabet } from "nanoid"

const generateNanoId = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  12,
)

export function generateId() {
  return generateNanoId()
}
