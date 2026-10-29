# Resource Limits Implementation

## Overview

The application has a single **Pro plan** with limits on resources such as:

- Projects
- Team members
- Integrations
- API keys

These limits are based on the number of resources that currently exist.

The existing database records remain the source of truth. No separate usage counters are required.

The implementation should provide a centralized, type-safe API for:

- Reading the current usage of a resource
- Checking whether a resource limit has been reached
- Rejecting operations that would exceed a limit
- Returning all resource limit statuses through tRPC

## Architecture

The resource limit system consists of three main layers:

```text
Resource limit config
        ↓
Resource counter registry
        ↓
Resource limit service
        ↓
tRPC routers / procedures
```

Suggested structure:

```text
src/
  server/
    resource-limits/
      resource-limits.config.ts
      resource-limits.registry.ts
      resource-limits.service.ts
      resource-limits.errors.ts
      resource-limits.types.ts

    routers/
      resource-limits.router.ts
      projects.router.ts
      members.router.ts
```

The resource limit service should not depend on tRPC.

tRPC is responsible for exposing limit information and translating limit failures into API errors.

---

## Resource Limit Configuration

Define all Pro plan limits in a single configuration object.

```ts
export const PRO_LIMITS = {
  projects: 20,
  teamMembers: 10,
  integrations: 5,
  apiKeys: 3
} as const
```

Derive the supported resources from the configuration.

```ts
export type LimitResource = keyof typeof PRO_LIMITS
```

This keeps resource names type-safe throughout the application.

---

## Resource Counter Registry

Each limited resource needs a function that determines its current usage.

Define a common counter signature:

```ts
type CountResource = (
  workspaceId: string
) => Promise<number>
```

The registry maps each resource to its corresponding Prisma query.

```text
projects
→ count Project records

teamMembers
→ count Member records

integrations
→ count Integration records

apiKeys
→ count ApiKey records
```

Conceptually:

```ts
export const resourceLimitRegistry = {
  projects: countProjects,
  teamMembers: countTeamMembers,
  integrations: countIntegrations,
  apiKeys: countApiKeys
} satisfies Record<LimitResource, CountResource>
```

Using `satisfies` ensures that every configured resource has a corresponding counter.

If a new limit is added to `PRO_LIMITS`, TypeScript should require a counter implementation for it.

---

## Resource Limit Service

The resource limit service provides the internal API used by tRPC procedures and other server-side code.

Application code should not access the limit configuration or counter registry directly.

The service should expose:

```ts
resourceLimits.get(workspaceId, resource)

resourceLimits.assert(workspaceId, resource)

resourceLimits.getAll(workspaceId)
```

---

## Get Resource Status

`get()` returns the current status of one resource.

```ts
await resourceLimits.get(
  workspaceId,
  'projects'
)
```

Return shape:

```ts
interface ResourceLimitStatus {
  used: number
  limit: number
  remaining: number
  reached: boolean
}
```

Example:

```json
{
  "used": 12,
  "limit": 20,
  "remaining": 8,
  "reached": false
}
```

The service calculates:

```text
used
= current database count

limit
= configured Pro limit

remaining
= max(0, limit - used)

reached
= used >= limit
```

---

## Assert Resource Limit

`assert()` is used before creating a limited resource.

```ts
await resourceLimits.assert(
  workspaceId,
  'projects'
)
```

If the workspace is below the limit, the function returns normally.

If the limit has been reached, it throws a domain-level `ResourceLimitError`.

```ts
throw new ResourceLimitError({
  resource: 'projects',
  limit: 20
})
```

The resource limit service should not throw `TRPCError` directly.

Keeping the service independent from tRPC makes it reusable from:

- tRPC procedures
- Background jobs
- Server-side functions
- Tests
- Future internal APIs

---

## Resource Limit Error

Create a dedicated domain error.

```ts
export class ResourceLimitError extends Error {
  constructor(
    public readonly resource: LimitResource,
    public readonly limit: number
  ) {
    super(`Resource limit reached for ${resource}`)
  }
}
```

The tRPC layer can translate this into a `TRPCError`.

For example:

```ts
throw new TRPCError({
  code: 'FORBIDDEN',
  message: 'Resource limit reached',
  cause: error
})
```

Alternatively, procedures can return structured error information through your global tRPC error formatter.

---

## tRPC Context

The workspace should normally already be resolved through authentication or workspace middleware.

For example:

```ts
ctx.workspace.id
```

Resource limit checks should use the workspace ID from trusted server context rather than accepting it directly from arbitrary client input whenever possible.



Conceptually:

```text
Client
  ↓
Authenticated tRPC procedure
  ↓
Workspace resolved from context
  ↓
Resource limit check
  ↓
Mutation
```

---

## Enforcing Limits in Mutations

Limits should be enforced by the backend before resource creation.

Example project mutation:

```ts
create: protectedProcedure
  .input(createProjectSchema)
  .mutation(async ({ ctx, input }) => {
    await resourceLimits.assert(
      ctx.workspace.id,
      'projects'
    )

    return ctx.prisma.project.create({
      data: {
        workspaceId: ctx.workspace.id,
        name: input.name
      }
    })
  })
```

The client may disable creation UI when a limit has been reached, but the mutation must still enforce the rule.

The backend remains authoritative.

---

## Optional tRPC Resource Limit Middleware

If many procedures use the same pattern, create reusable tRPC middleware.

Conceptually:

```ts
function withResourceLimit(resource: LimitResource) {
  return t.middleware(async ({ ctx, next }) => {
    await resourceLimits.assert(
      ctx.workspace.id,
      resource
    )

    return next()
  })
}
```

This allows procedures to express their requirement declaratively.

Conceptually:

```ts
const createProjectProcedure = protectedProcedure.use(
  withResourceLimit('projects')
)
```

Then:

```ts
create: createProjectProcedure
  .input(createProjectSchema)
  .mutation(async ({ ctx, input }) => {
    return ctx.prisma.project.create({
      data: {
        workspaceId: ctx.workspace.id,
        name: input.name
      }
    })
  })
```

Use middleware when the limit check is a simple prerequisite for the entire procedure.

Keep checks directly inside the mutation when enforcement depends on input or more complex domain logic.

---

## Resource Limits Router

Expose resource limit information through its own tRPC router.

For example:

```ts
export const resourceLimitsRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return resourceLimits.getAll(
      ctx.workspace.id
    )
  }),

  get: protectedProcedure
    .input(
      z.object({
        resource: resourceSchema
      })
    )
    .query(async ({ ctx, input }) => {
      return resourceLimits.get(
        ctx.workspace.id,
        input.resource
      )
    })
})
```

The frontend can then use:

```ts
trpc.resourceLimits.getAll.useQuery()
```

or:

```ts
trpc.resourceLimits.get.useQuery({
  resource: 'projects'
})
```

In most cases, `getAll` should be enough for settings, billing, or dashboard UI.

---

## Get All Resource Limits

`getAll()` returns every configured resource.

Example:

```ts
await resourceLimits.getAll(workspaceId)
```

Result:

```json
{
  "projects": {
    "used": 12,
    "limit": 20,
    "remaining": 8,
    "reached": false
  },
  "teamMembers": {
    "used": 7,
    "limit": 10,
    "remaining": 3,
    "reached": false
  },
  "integrations": {
    "used": 5,
    "limit": 5,
    "remaining": 0,
    "reached": true
  },
  "apiKeys": {
    "used": 1,
    "limit": 3,
    "remaining": 2,
    "reached": false
  }
}
```

Because tRPC provides end-to-end TypeScript inference, this shape can flow directly to the React client without manually duplicating API response types.

---

## Frontend Usage

The frontend can query all resource limits:

```ts
const resourceLimits =
  trpc.resourceLimits.getAll.useQuery()
```

A create button can use the relevant status:

```ts
const projectLimit =
  resourceLimits.data?.projects

const disabled =
  projectLimit?.reached ?? false
```

The UI can display:

```text
Projects
12 / 20
```

or:

```text
8 projects remaining
```

Frontend checks are only for user experience.

They must never replace backend enforcement.

---

## Source of Truth

Do not maintain separate counters such as:

```text
workspace.projectCount
workspace.memberCount
workspace.apiKeyCount
```

unless there is a proven performance requirement.

Instead, calculate current usage from the resources themselves.

```text
Project rows
→ project usage

Member rows
→ team member usage

Integration rows
→ integration usage

ApiKey rows
→ API key usage
```

This avoids synchronization problems between counters and actual database state.

---

## Concurrency

A simple:

```text
count
→ assert
→ create
```

flow can have a race condition.

For example:

```text
Current projects: 19
Limit: 20

Mutation A counts 19
Mutation B counts 19

Mutation A creates project
Mutation B creates project

Final count: 21
```

tRPC does not change this behavior because concurrency is ultimately a database concern.

If strict enforcement is required, the limit check and resource creation need to be concurrency-safe.

Possible approaches include:

- Prisma transactions
- Serializable transactions
- Explicit database locking
- Database-level atomic enforcement

The appropriate mechanism can be implemented per resource.

For resources where temporarily exceeding the limit by one is not critical, the initial implementation can use a normal count check.

---

## Error Handling in tRPC

Resource limit failures should have a predictable error representation.

For example, convert `ResourceLimitError` into:

```ts
new TRPCError({
  code: 'FORBIDDEN',
  message: 'Resource limit reached',
  cause: error
})
```

The client can inspect the tRPC error and show an appropriate message.

If the application uses a custom tRPC error formatter, expose structured metadata such as:

```json
{
  "code": "RESOURCE_LIMIT_REACHED",
  "resource": "projects",
  "limit": 20
}
```

This allows the frontend to distinguish a plan limit from other authorization failures.

---

## Adding a New Resource Limit

Adding a new limit should require only two domain-level changes.

### 1. Add the configured limit

```ts
export const PRO_LIMITS = {
  projects: 20,
  teamMembers: 10,
  integrations: 5,
  apiKeys: 3,
  webhooks: 10
} as const
```

### 2. Add the counter

```ts
export const resourceLimitRegistry = {
  projects: countProjects,
  teamMembers: countTeamMembers,
  integrations: countIntegrations,
  apiKeys: countApiKeys,
  webhooks: countWebhooks
} satisfies Record<LimitResource, CountResource>
```

The generic service and `getAll` tRPC procedure should require no changes.

A new creation mutation can enforce it with:

```ts
await resourceLimits.assert(
  ctx.workspace.id,
  'webhooks'
)
```

or:

```ts
protectedProcedure.use(
  withResourceLimit('webhooks')
)
```

---

## Testing

### Resource Limit Service

Unit tests should cover:

- Usage below the limit
- Usage exactly at the limit
- Usage above the limit
- Correct `remaining` calculation
- Correct `reached` value
- `assert()` allowing valid operations
- `assert()` throwing when the limit is reached
- `getAll()` returning every configured resource

### tRPC Procedures

Integration tests should verify:

- Authenticated workspaces can fetch their limits
- Creation works below the limit
- Creation is rejected at the limit
- Limit errors are mapped to the expected tRPC error
- A user cannot query or enforce limits against another workspace

### Concurrency

Resources requiring strict limits should have tests covering simultaneous creation attempts.

---

## Future Extension

The initial system is intentionally designed around:

```text
One Pro plan
+
Resource-based limits
```

If additional plans are introduced later, the configuration can evolve into:

```ts
const PLAN_LIMITS = {
  free: {
    projects: 3,
    teamMembers: 1
  },

  pro: {
    projects: 20,
    teamMembers: 10
  }
}
```

The counter registry, service, and tRPC layer can remain largely unchanged.

Metered usage such as:

- API requests
- AI tokens
- Emails sent
- Processing minutes

should be implemented separately because those represent consumption over time rather than currently existing resources.

---

## Summary

The implementation should follow this flow:

```text
PRO_LIMITS
    ↓
Resource counter registry
    ↓
Generic resource limit service
    ↓
tRPC query / middleware / mutation
    ↓
Prisma resource creation
```

Key principles:

```text
Limits are defined in code

Existing database resources are the source of truth

A registry defines how each resource is counted

The generic service is independent from tRPC

tRPC handles transport-level errors and exposure

Backend mutations enforce all limits

Frontend checks are UX only

Workspace identity comes from trusted context

Adding a new resource requires minimal implementation

More complex entitlement infrastructure is deferred until needed
```
