import type { PRO_LIMITS } from "./config"
import type { Prisma } from "../../../generated/prisma/client"

export type LimitResource = keyof typeof PRO_LIMITS
export type ResourceLimitDatabase = Pick<Prisma.TransactionClient, "member" | "staffMember" | "invitation">
export type ResourceLimitStatus = {
  used: number
  limit: number
  remaining: number
  reached: boolean
}
