import type { LimitResource } from "./types"

export class ResourceLimitError extends Error {
  readonly appCode = "RESOURCE_LIMIT_REACHED"

  constructor(public readonly resource: LimitResource, public readonly limit: number) {
    super(`Your subscription includes ${limit} bookable people`)
    this.name = "ResourceLimitError"
  }
}
