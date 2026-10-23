import type { LimitResource } from "./types"

export class ResourceLimitError extends Error {
  readonly appCode = "RESOURCE_LIMIT_REACHED"

  constructor(public readonly resource: LimitResource, public readonly limit: number) {
    super(`The Pro plan allows up to ${limit} team members`)
    this.name = "ResourceLimitError"
  }
}
