import type { LIMIT_RESOURCES } from "./config"
import type { Prisma } from "../../../generated/prisma/client"

export type LimitResource = (typeof LIMIT_RESOURCES)[number]
export type ResourceLimitDatabase = Pick<Prisma.TransactionClient, "member" | "staffMember" | "invitation" | "subscription">
export type ResourceLimitStatus = {
  used: number
  limit: number
  remaining: number
  reached: boolean
}
