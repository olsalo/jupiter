# Appointment SaaS MVP Server Implementation

## Purpose

This document defines the high-level server architecture and implementation logic for an appointment scheduling SaaS using:

- **tRPC** for the application API
- **Prisma ORM** for database access
- **PostgreSQL** as the primary database
- **Better Auth** for authentication, sessions, and organization membership
- **TypeScript** throughout the server

The goal is to implement the smallest production-shaped server that supports:

- organizations and members
- staff
- services
- locations
- customers
- staff availability
- blocked time
- public booking
- internal appointment management
- cancellation and rescheduling
- basic booking notifications
- basic calendar views

Advanced features such as waitlists, recurring appointments, payments, external calendar sync, resources, and webhooks can remain disabled or unimplemented during the initial MVP even if their database tables already exist.

---

## 1. Server responsibilities

The server owns all business rules.

The frontend should never be responsible for determining whether an appointment is valid. It may display available slots returned by the server, but the server must revalidate every booking before committing it.

The server is responsible for:

1. authenticating users
2. determining active organization context
3. enforcing organization membership and role permissions
4. validating all tRPC inputs
5. generating available booking slots
6. preventing double bookings
7. creating and modifying appointments transactionally
8. maintaining customer records
9. creating appointment history events
10. scheduling notifications
11. returning calendar-friendly appointment data

---

## 2. Suggested server module structure

```text
src/
  server/
    auth/
      auth.ts
      session.ts
      permissions.ts

    trpc/
      init.ts
      context.ts
      middleware.ts
      root.ts

    routers/
      organization.router.ts
      staff.router.ts
      service.router.ts
      location.router.ts
      customer.router.ts
      availability.router.ts
      appointment.router.ts
      booking.router.ts
      settings.router.ts

    services/
      availability.service.ts
      appointment.service.ts
      booking.service.ts
      customer.service.ts
      notification.service.ts
      permission.service.ts

    repositories/
      appointment.repository.ts
      availability.repository.ts

    jobs/
      notification.job.ts
      appointment-expiration.job.ts

    db/
      prisma.ts

    errors/
      app-error.ts

    utils/
      time.ts
      pagination.ts
      booking-code.ts
      money.ts
```

For an MVP, repositories are optional. It is acceptable for service modules to call Prisma directly if the business logic remains clearly separated from tRPC routers.

A useful rule is:

```text
tRPC router
  -> authorization + input parsing
  -> domain service
  -> Prisma transaction/query
```

Avoid putting complex booking or availability logic directly inside router procedures.

---

## 3. tRPC context

Every private tRPC request should have access to:

```ts
export type TRPCContext = {
  prisma: PrismaClient
  session: Session | null
  user: User | null
  activeOrganizationId: string | null
}
```

The context should be created from the Better Auth session.

The active organization can come from `Session.activeOrganizationId`, but it must still be validated against organization membership before it is trusted.

### Context flow

```text
HTTP request
  -> Better Auth reads session
  -> load authenticated user
  -> read activeOrganizationId
  -> create tRPC context
  -> procedure middleware checks membership
```

Never accept `organizationId` from a private frontend request and blindly trust it.

For most organization-scoped private procedures, derive the organization ID from the authenticated context.

---

## 4. tRPC procedure classes

Create a small set of reusable procedures.

### `publicProcedure`

No authentication required.

Use for:

- public booking page lookup
- public services
- public staff options
- public available slot search
- public booking creation
- public booking cancellation by secure token/code if supported
- public booking rescheduling by secure token/code if supported

### `protectedProcedure`

Requires an authenticated Better Auth user.

Use for account-level actions that are not organization-specific.

### `organizationProcedure`

Requires:

1. authenticated user
2. active organization ID
3. a valid `Member` row for that user and organization

The middleware should attach membership data:

```ts
ctx.organization = organization
ctx.member = member
```

### Role-specific procedures

Optionally build helpers such as:

```ts
adminProcedure
staffProcedure
```

For MVP, simple role checks inside service methods are also acceptable.

Recommended role behavior:

- `owner`: everything
- `admin`: everything except destructive owner/billing operations
- `member`: operational appointment access

If staff members should only see their own appointments, derive the linked `StaffMember` through `Member.staffProfile`.

---

## 5. Organization scoping

Every appointment-domain query must be organization-scoped.

Good:

```ts
await prisma.appointment.findMany({
  where: {
    organizationId: ctx.organization.id
  }
})
```

Bad:

```ts
await prisma.appointment.findMany()
```

Even when querying by a globally unique ID, include `organizationId` wherever practical:

```ts
await prisma.appointment.findFirst({
  where: {
    id: input.id,
    organizationId
  }
})
```

This prevents accidental cross-tenant access and makes authorization easier to audit.

---

## 6. MVP routers

## 6.1 Organization router

Suggested procedures:

```text
organization.getCurrent
organization.updateSettings
```

`getCurrent` returns:

- organization identity
- settings
- current member role

`updateSettings` should handle only MVP-relevant settings initially:

- timezone
- currency
- booking enabled
- slot interval
- minimum booking notice
- maximum booking advance
- cancellation notice
- reschedule notice
- auto-confirm setting

---

## 6.2 Staff router

Suggested procedures:

```text
staff.list
staff.get
staff.create
staff.update
staff.setServices
staff.setLocations
staff.archive
```

Avoid hard deleting staff with historical appointments.

For MVP, "delete" should generally mean:

```ts
isActive = false
acceptsAppointments = false
```

### Staff creation

When creating staff:

1. validate organization
2. create `StaffMember`
3. optionally connect an existing organization `Member`
4. attach allowed services
5. attach allowed locations

A staff member does not require a login account.

---

## 6.3 Service router

Suggested procedures:

```text
service.list
service.get
service.create
service.update
service.archive
```

MVP fields:

- name
- slug
- description
- duration
- buffer before
- buffer after
- price
- currency
- delivery type
- maximum attendees
- booking notice
- booking horizon
- active state

When changing a service, existing appointments must not change because appointment service details are snapshotted into `AppointmentService`.

---

## 6.4 Location router

Suggested procedures:

```text
location.list
location.create
location.update
location.archive
```

A location may represent:

- physical office
- store
- salon
- clinic
- remote/online location

For MVP, location can be optional if the organization only operates from one place.

---

## 6.5 Customer router

Suggested procedures:

```text
customer.list
customer.get
customer.create
customer.update
customer.getAppointments
```

### Customer matching

During public booking, the server should try to reuse an existing customer before creating a new one.

Recommended MVP matching order:

1. exact normalized email match within organization
2. exact normalized phone match within organization
3. create new customer

Never globally deduplicate customers across organizations.

A shared customer identity model can be added later if required.

---

## 6.6 Availability router

Suggested procedures:

```text
availability.getRules
availability.replaceRules
availability.listOverrides
availability.createOverride
availability.deleteOverride
availability.listBlockedTime
availability.createBlockedTime
availability.deleteBlockedTime
availability.getSlots
```

The main server-side complexity is `getSlots`.

---

## 7. Availability model

For MVP, availability should be resolved from the following sources:

```text
weekly availability rules
  + one-off availability overrides
  - blocked time
  - existing appointments
  - service buffers
  = bookable intervals
```

External calendars and resource availability can be integrated later.

### Weekly rules

A weekly rule defines:

```text
staff/location
+ weekday
+ local start minute
+ local end minute
+ timezone
```

Example:

```text
Monday
09:00-12:00
13:00-17:00
```

would be represented as two rules.

### Overrides

Overrides take precedence over weekly availability.

Examples:

- staff unavailable all day due to vacation
- office closed for a holiday
- staff works an extra Saturday

### Blocked time

Blocked time represents explicit non-bookable intervals such as:

- lunch
- internal meeting
- maintenance
- personal appointment

---

## 8. Slot generation algorithm

The slot generation service should accept something similar to:

```ts
type GetAvailableSlotsInput = {
  organizationId: string
  serviceId: string
  staffMemberId?: string
  locationId?: string
  from: Date
  to: Date
}
```

The public API should limit the date range so clients cannot request enormous windows.

For example:

```text
maximum slot query range: 31 days
```

### Step 1: Load service

Load the active service with:

- duration
- buffers
- booking notice
- booking horizon
- eligible staff
- eligible locations

Reject inactive services.

### Step 2: Resolve candidate staff

If the caller selected a staff member:

- validate that staff member belongs to the organization
- validate active state
- validate that they provide the selected service

Otherwise:

- query all active staff who provide the service

### Step 3: Resolve candidate locations

If a location was selected:

- validate the service is available there
- validate staff can work there

Otherwise use compatible locations.

For an online-only MVP, location can be omitted entirely.

### Step 4: Build base availability windows

For each date and staff member:

1. determine local weekday in the relevant timezone
2. load matching `AvailabilityRule` rows
3. convert rule minutes into actual UTC instants for that date

Time zone conversion must happen server-side.

Do not treat recurring local working hours as UTC hours.

### Step 5: Apply overrides

Load all overlapping `AvailabilityOverride` rows.

Rules:

- unavailable override subtracts time
- available override adds time

If both exist, define deterministic priority. For MVP, latest-created override can win, or reject overlapping contradictory overrides when they are created.

Rejecting conflicting overrides is simpler.

### Step 6: Load conflicts

Load overlapping:

- `BlockedTime`
- non-cancelled appointments

Appointment statuses that should block availability:

```text
PENDING
CONFIRMED
CHECKED_IN
IN_PROGRESS
```

Statuses that should not block:

```text
CANCELLED
COMPLETED
NO_SHOW
```

Whether `COMPLETED` blocks is irrelevant for future slot queries, but excluding it is logically correct.

For pending booking holds, use `expiresAt`.

Expired pending appointments should not block availability.

### Step 7: Add appointment buffers

Suppose the service has:

```text
60 minute duration
15 minute buffer before
10 minute buffer after
```

A booking from `10:00-11:00` occupies:

```text
09:45-11:10
```

The slot itself remains `10:00-11:00`, but conflict detection uses the expanded interval.

### Step 8: Generate slots

Use the organization's configured slot interval.

Example:

```text
availability window: 09:00-12:00
service duration: 60m
slot interval: 15m
```

Candidate starts:

```text
09:00
09:15
09:30
09:45
10:00
10:15
10:30
10:45
11:00
```

Each candidate must fit fully inside available time, including required buffers.

### Step 9: Apply booking rules

Filter by:

- current time
- minimum booking notice
- maximum booking advance
- service-specific rules
- organization-level rules

Service-specific values should override organization defaults when defined.

### Step 10: Merge or group response

Return slots grouped by date.

Example response:

```ts
{
  days: [
    {
      date: '2026-10-12',
      slots: [
        {
          startsAt: '2026-10-12T07:00:00.000Z',
          endsAt: '2026-10-12T08:00:00.000Z',
          staffMemberId: 'staff_123',
          locationId: 'loc_123'
        }
      ]
    }
  ]
}
```

The frontend should display local times using the organization or booking timezone.

---

## 9. Public booking router

Suggested procedures:

```text
booking.getPage
booking.getAvailableSlots
booking.create
booking.getByCode
booking.cancel
booking.reschedule
```

This router is public and must therefore perform strict validation and rate limiting.

### `booking.getPage`

Input:

```ts
{
  organizationSlug: string
  bookingPageSlug?: string
}
```

Return only public information:

- organization display name
- booking page configuration
- active services
- selectable staff
- selectable locations
- public booking settings

Never return private staff/member data.

---

## 10. Booking creation flow

`booking.create` is the most important transaction in the MVP.

Input example:

```ts
type CreateBookingInput = {
  organizationSlug: string
  serviceId: string
  staffMemberId?: string
  locationId?: string
  startsAt: string
  customer: {
    firstName: string
    lastName?: string
    email?: string
    phone?: string
  }
  notes?: string
  answers?: Array<{
    questionId: string
    value: unknown
  }>
}
```

### Booking creation sequence

```text
1. resolve organization
2. verify public booking enabled
3. load service
4. resolve staff/location
5. validate customer fields
6. begin database transaction
7. re-check requested slot inside transaction
8. create/reuse customer
9. create appointment
10. create appointment service snapshot
11. create booking answers
12. create appointment event
13. create notification jobs
14. commit transaction
15. return booking confirmation
```

The critical rule is:

> Never trust a previously returned available slot.

Availability may have changed between the slot query and booking submission.

The server must calculate the requested slot again before creating the appointment.

---

## 11. Preventing double bookings

A normal Prisma transaction alone is not sufficient if two booking requests race each other.

Example:

```text
Request A checks 10:00 -> free
Request B checks 10:00 -> free
Request A creates appointment
Request B creates appointment
```

Both can succeed if the reads happen before either write commits.

For MVP, use a PostgreSQL transaction-level advisory lock around the staff/date being booked.

Conceptually:

```text
BEGIN

acquire advisory lock for:
  organizationId + staffMemberId + local booking date

re-run availability check

insert appointment

COMMIT
```

The exact implementation can use `prisma.$queryRaw` to call PostgreSQL advisory locking inside a Prisma transaction.

Another production option is a PostgreSQL exclusion constraint on time ranges, but advisory locks are easier to integrate with Prisma initially, especially when buffer logic and conditional statuses are involved.

### Lock granularity

Recommended MVP lock key:

```text
organization + staff + booking date
```

This serializes bookings for one staff member on one date while allowing unrelated staff/date bookings to proceed concurrently.

If rooms/resources become part of availability later, lock those resources as well.

---

## 12. Appointment creation

The appointment service should own internal and public appointment creation.

Recommended API:

```ts
createAppointment({
  organizationId,
  customerId,
  service,
  staffMemberId,
  locationId,
  startsAt,
  source,
  notes
})
```

The service should calculate:

```ts
endsAt = startsAt + service.durationMinutes
```

Do not accept arbitrary `endsAt` from public clients.

For manual admin bookings, a separate custom-duration path can be added later.

### Appointment status

Use:

```text
CONFIRMED
```

when the service/organization supports automatic confirmation.

Otherwise use:

```text
PENDING
```

If pending appointments are used as temporary checkout holds, set `expiresAt`.

---

## 13. Appointment service snapshot

When an appointment is created, write an `AppointmentService` record containing:

- service ID
- service name
- duration
- unit price
- total price
- buffers
- assigned staff

Example:

```ts
await tx.appointmentService.create({
  data: {
    appointmentId,
    serviceId: service.id,
    staffMemberId,
    name: service.name,
    durationMinutes: service.durationMinutes,
    unitPrice: service.price,
    totalPrice: service.price,
    bufferBeforeMinutes: service.bufferBeforeMinutes,
    bufferAfterMinutes: service.bufferAfterMinutes
  }
})
```

Historical appointments should rely on snapshot data when displaying what was actually booked.

---

## 14. Internal appointment router

Suggested procedures:

```text
appointment.list
appointment.get
appointment.create
appointment.updateNotes
appointment.confirm
appointment.cancel
appointment.reschedule
appointment.complete
appointment.markNoShow
appointment.checkIn
```

### Appointment list

Support server-side filters:

- start/end date
- status
- staff member
- location
- customer

For calendar screens, always query by date range.

Avoid loading all appointments for an organization.

Example:

```ts
where: {
  organizationId,
  startsAt: {
    gte: input.from,
    lt: input.to
  }
}
```

Include only relations needed by the calendar UI.

---

## 15. Rescheduling

Rescheduling should use the same availability engine as new bookings.

Flow:

```text
1. load appointment
2. verify rescheduling allowed
3. validate notice period
4. acquire booking lock
5. check new slot
6. update appointment times
7. create appointment event
8. queue reschedule notification
```

For MVP, update the existing appointment row.

The schema supports `rescheduledFromId`, so later you can switch to immutable appointment revisions if required.

When checking conflicts, exclude the appointment currently being rescheduled.

---

## 16. Cancellation

Cancellation should be a status change rather than deletion.

Flow:

```text
1. load appointment
2. validate current status
3. validate cancellation notice if customer-initiated
4. update status = CANCELLED
5. set cancelledAt
6. store cancellationReason
7. create AppointmentEvent
8. queue cancellation notification
```

Never delete appointments because historical data is valuable for:

- customer history
- analytics
- audit trails
- no-show metrics
- disputes

---

## 17. Appointment status transitions

Keep status transitions explicit.

Recommended MVP state machine:

```text
PENDING
  -> CONFIRMED
  -> CANCELLED

CONFIRMED
  -> CHECKED_IN
  -> COMPLETED
  -> NO_SHOW
  -> CANCELLED

CHECKED_IN
  -> IN_PROGRESS
  -> COMPLETED
  -> CANCELLED

IN_PROGRESS
  -> COMPLETED
```

Do not allow arbitrary status strings from the client.

Expose procedures representing business actions instead of a generic:

```text
appointment.updateStatus
```

This keeps validation understandable.

---

## 18. Appointment events

Write an `AppointmentEvent` whenever meaningful state changes occur.

Examples:

```text
CREATED
CONFIRMED
RESCHEDULED
CANCELLED
CHECKED_IN
STARTED
COMPLETED
NO_SHOW
```

Event creation should occur inside the same database transaction as the appointment modification.

Example:

```text
transaction
  update appointment
  create appointment event
commit
```

This guarantees that the event history cannot disagree with the appointment mutation.

---

## 19. Booking codes and public access

Every appointment has a `bookingCode`.

Do not use simple sequential codes.

Generate a high-entropy random value, for example:

```text
24-32 random URL-safe characters
```

The public booking detail endpoint can use:

```text
bookingCode + customer email verification
```

or a separate signed access token.

For a simple MVP, a sufficiently random booking code can act as a bearer secret, but avoid exposing sensitive internal notes or customer metadata through it.

Public booking lookup should return only customer-safe information.

---

## 20. Input validation

Use Zod schemas at the tRPC boundary.

Examples:

```ts
const createServiceInput = z.object({
  name: z.string().trim().min(1).max(120),
  durationMinutes: z.number().int().min(5).max(24 * 60),
  bufferBeforeMinutes: z.number().int().min(0).max(240),
  bufferAfterMinutes: z.number().int().min(0).max(240),
  price: z.string(),
  currency: z.string().length(3)
})
```

Validate business invariants in services, not only in Zod.

For example, Zod can validate that `durationMinutes` is a positive integer, but the service should verify that the selected staff actually provides the selected service.

---

## 21. Error model

Use predictable tRPC error codes.

Recommended mappings:

```text
UNAUTHORIZED
  no valid user session

FORBIDDEN
  user is authenticated but lacks organization access

NOT_FOUND
  organization entity not found within tenant

BAD_REQUEST
  invalid business state or impossible request

CONFLICT
  requested booking slot is no longer available

TOO_MANY_REQUESTS
  public booking endpoint rate limited

INTERNAL_SERVER_ERROR
  unexpected server failure
```

For booking conflicts, return a machine-readable application code as well.

Example:

```ts
{
  code: 'CONFLICT',
  cause: {
    appCode: 'SLOT_UNAVAILABLE'
  }
}
```

The frontend can then refresh available slots.

---

## 22. Notifications

For MVP, implement email only.

Create notification records transactionally, but send them asynchronously.

Booking transaction:

```text
create appointment
create Notification(status = PENDING)
commit
```

Worker:

```text
load pending notifications
send email
mark SENT
```

Do not perform network email sending inside the booking transaction.

A slow email provider should never cause appointment creation to fail.

### MVP notifications

Implement:

- booking confirmation
- cancellation
- reschedule
- appointment reminder

Reminder notifications can be created when the appointment is created or generated periodically by a worker.

A simple MVP approach is a recurring worker that finds appointments needing reminders.

---

## 23. Background jobs

At minimum, implement two recurring jobs.

### Notification sender

Runs frequently and processes:

```text
Notification.status = PENDING/SCHEDULED
scheduledAt <= now
```

Use bounded batches.

Example:

```text
100 notifications per worker iteration
```

### Expired pending appointment cleanup

If appointment holds are used:

```text
status = PENDING
expiresAt < now
```

Either:

- mark them `CANCELLED`
- or exclude them from availability once expired

Prefer marking them cancelled eventually for clear history.

---

## 24. Prisma transaction boundaries

Use transactions around operations that mutate multiple related rows.

### Booking transaction

```text
customer upsert/find
appointment create
appointment service create
booking answers create
appointment event create
notification create
```

### Cancellation transaction

```text
appointment update
appointment event create
notification create
```

### Reschedule transaction

```text
availability recheck
appointment update
appointment event create
notification create
```

### Service creation

A transaction is useful if creating:

```text
service
staff-service assignments
service-location assignments
questions
```

---

## 25. Prisma query discipline

Prefer explicit selects for list endpoints.

Example:

```ts
await prisma.appointment.findMany({
  where: {
    organizationId,
    startsAt: {
      gte: from,
      lt: to
    }
  },
  select: {
    id: true,
    bookingCode: true,
    status: true,
    startsAt: true,
    endsAt: true,
    customer: {
      select: {
        id: true,
        firstName: true,
        lastName: true
      }
    },
    staffMember: {
      select: {
        id: true,
        name: true
      }
    }
  }
})
```

Avoid deep `include: { ... }` trees by default because they can make list endpoints unnecessarily expensive.

---

## 26. Pagination

Use cursor pagination for customer and appointment history lists.

For calendar date-range queries, pagination is usually unnecessary because the date window already bounds the result.

Example cursor API:

```ts
{
  cursor?: string
  limit: number
}
```

Recommended maximum limit:

```text
100
```

---

## 27. Date and timezone rules

This area should be centralized in a time utility module.

Rules:

1. store appointment timestamps as PostgreSQL timestamps representing UTC instants
2. store the booking timezone separately
3. interpret weekly availability in its configured local timezone
4. return ISO timestamps over tRPC
5. never perform slot calculations using browser-local time

The availability engine must correctly handle DST transitions.

Use a timezone-aware date library or Temporal-compatible implementation rather than manual offset arithmetic.

---

## 28. Better Auth integration

Better Auth should remain responsible for:

- user accounts
- sessions
- authentication providers
- organization membership/auth integration if you use its organization plugin

Your appointment domain remains responsible for:

- staff profiles
- appointment permissions
- organization appointment settings
- business objects

Do not merge `StaffMember` and `User`.

A staff member may exist without an account, while an organization admin may have a user account but not be bookable staff.

### Active organization

At request time:

```text
Better Auth session
  -> activeOrganizationId
  -> verify Member exists
  -> organization-scoped tRPC context
```

If no active organization exists, organization procedures should return a clear error rather than silently selecting one.

---

## 29. Permission model

Centralize permission checks.

Example helper:

```ts
assertPermission(member, 'appointment:update')
```

MVP permission categories:

```text
organization:manage
staff:manage
service:manage
availability:manage
customer:read
customer:manage
appointment:read
appointment:create
appointment:update
appointment:cancel
```

Initially these can map directly to roles.

Later, custom organization roles can be added without changing router logic.

---

## 30. Public endpoint protection

Public booking endpoints need more abuse protection than authenticated tRPC procedures.

Add:

- IP-based rate limits
- organization/booking-page rate limits
- input length limits
- generic error messages where enumeration is a concern
- bot protection if abuse appears

High-risk endpoints:

```text
booking.getAvailableSlots
booking.create
booking.cancel
booking.reschedule
```

The availability endpoint can be computationally expensive, so constrain:

- maximum date range
- maximum staff count
- maximum locations
- maximum returned slots

---

## 31. Booking availability caching

Do not cache availability aggressively for MVP.

Availability changes whenever someone books, cancels, blocks time, or edits schedules.

A small in-memory/request-level cache for repeated internal calculations is fine, but the booking write path must always query authoritative database state.

Later, a Redis cache can be introduced for public slot searches if required.

---

## 32. MVP features to implement now

### Auth and tenancy

- Better Auth session context
- active organization resolution
- organization membership middleware
- simple role permissions

### Business configuration

- organization appointment settings
- services
- staff
- locations
- service/staff relationships
- staff/location relationships

### Availability

- weekly rules
- availability overrides
- blocked time
- slot generation
- appointment conflict detection
- booking notice rules

### Customers

- create/update customer
- email/phone dedupe within organization
- appointment history

### Appointments

- create manually
- list by date range
- get details
- confirm
- cancel
- reschedule
- check in
- complete
- no-show
- event history

### Public booking

- load booking page
- load services/staff/locations
- query available slots
- create booking
- booking confirmation lookup
- cancel booking
- reschedule booking

### Notifications

- confirmation email
- cancellation email
- reschedule email
- reminder email
- basic worker

---

## 33. Features to defer after MVP

The schema can support these, but server implementation can wait:

- Stripe appointment payments
- deposits
- refunds
- Google Calendar sync
- Outlook Calendar sync
- video conferencing integrations
- waitlists
- recurring appointment creation UI
- resource/equipment scheduling
- group booking capacity logic
- SMS notifications
- custom notification templates UI
- custom booking forms beyond basic questions
- outbound webhooks
- advanced audit log UI
- analytics/revenue reports
- coupon codes
- taxes
- multi-service appointments

Do not let these delay the core booking loop.

---

## 34. Recommended implementation order

Implement vertically rather than finishing every CRUD router first.

### Phase 1: tenancy and configuration

```text
Better Auth context
organization middleware
organization settings
services
staff
locations
```

### Phase 2: availability

```text
weekly rules
blocked time
overrides
slot calculation tests
```

Availability should have strong automated tests before public booking is added.

### Phase 3: booking loop

```text
customers
booking.create
appointment snapshot
concurrency lock
appointment.list
appointment.get
```

At this point the product can accept appointments.

### Phase 4: lifecycle

```text
cancel
reschedule
confirm
complete
no-show
appointment events
```

### Phase 5: communications

```text
notification records
email sender worker
reminders
```

### Phase 6: hardening

```text
rate limiting
audit logging
query optimization
observability
error tracking
load/concurrency tests
```

---

## 35. Availability tests

The availability service deserves the largest test suite in the MVP.

Minimum cases:

```text
returns slots during weekly availability
returns no slots outside weekly availability
handles multiple windows in one day
subtracts blocked time
subtracts existing appointment
accounts for buffer before
accounts for buffer after
honors slot interval
honors minimum notice
honors maximum booking horizon
honors unavailable override
honors extra available override
handles selected staff
handles any-staff booking
handles location restrictions
ignores cancelled appointments
ignores expired pending appointments
excludes current appointment during rescheduling
handles DST start
handles DST end
```

Also add a concurrency integration test:

```text
send two booking requests for same staff/time
expect exactly one success
expect exactly one SLOT_UNAVAILABLE conflict
```

---

## 36. Database indexing priorities

The supplied schema already contains useful indexes. For MVP performance, the most important query shapes are:

```text
Appointment
  organizationId + startsAt
  organizationId + status + startsAt
  staffMemberId + startsAt + endsAt
  locationId + startsAt + endsAt

AvailabilityRule
  staffMemberId + dayOfWeek
  organizationId + dayOfWeek

AvailabilityOverride
  staffMemberId + startsAt + endsAt

BlockedTime
  staffMemberId + startsAt + endsAt

Customer
  organizationId + email
  organizationId + phone
```

Use `EXPLAIN ANALYZE` once realistic appointment counts exist instead of prematurely adding many indexes.

---

## 37. Observability

Log domain events rather than raw arbitrary strings.

Useful fields:

```text
requestId
organizationId
userId
appointmentId
staffMemberId
procedure
operation
errorCode
durationMs
```

Never log:

- auth tokens
- session tokens
- full payment data
- private customer notes
- secrets

Track at minimum:

- booking success count
- booking conflict count
- booking error count
- slot query latency
- appointment create latency
- notification failures

---

## 38. Example high-level router code

```ts
export const bookingRouter = router({
  getAvailableSlots: publicProcedure
    .input(getAvailableSlotsSchema)
    .query(async ({ ctx, input }) => {
      return getAvailableSlots(ctx.prisma, input)
    }),

  create: publicProcedure
    .input(createBookingSchema)
    .mutation(async ({ ctx, input }) => {
      return createBooking(ctx.prisma, input)
    })
})
```

Keep `createBooking` responsible for the complete business operation rather than splitting the booking workflow across multiple client calls.

Bad flow:

```text
client creates customer
client creates appointment
client creates appointment service
client creates notification
```

Good flow:

```text
client calls booking.create once
server performs one atomic domain operation
```

---

## 39. Example organization middleware

```ts
const organizationProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const organizationId = ctx.session?.activeOrganizationId

    if (!organizationId || !ctx.user) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'No active organization'
      })
    }

    const member = await ctx.prisma.member.findFirst({
      where: {
        organizationId,
        userId: ctx.user.id
      },
      include: {
        organization: true,
        staffProfile: true
      }
    })

    if (!member) {
      throw new TRPCError({
        code: 'FORBIDDEN'
      })
    }

    return next({
      ctx: {
        ...ctx,
        organizationId,
        organization: member.organization,
        member
      }
    })
  }
)
```

The exact Better Auth session shape can be adapted to your existing auth setup.

---

## 40. Example booking service shape

```ts
export async function createBooking(
  prisma: PrismaClient,
  input: CreateBookingInput
) {
  const organization = await resolveBookingOrganization(prisma, input)
  const service = await resolveBookableService(prisma, organization.id, input.serviceId)
  const assignment = await resolveStaffAndLocation(prisma, {
    organizationId: organization.id,
    serviceId: service.id,
    staffMemberId: input.staffMemberId,
    locationId: input.locationId,
    startsAt: input.startsAt
  })

  return prisma.$transaction(async tx => {
    await acquireBookingLock(tx, {
      organizationId: organization.id,
      staffMemberId: assignment.staffMemberId,
      startsAt: input.startsAt
    })

    await assertSlotStillAvailable(tx, {
      organizationId: organization.id,
      service,
      staffMemberId: assignment.staffMemberId,
      locationId: assignment.locationId,
      startsAt: input.startsAt
    })

    const customer = await findOrCreateCustomer(tx, {
      organizationId: organization.id,
      ...input.customer
    })

    return persistBooking(tx, {
      organization,
      customer,
      service,
      assignment,
      input
    })
  })
}
```

This separation keeps the tRPC layer small while making the booking engine independently testable.

---

## 41. Definition of MVP done

The server MVP is complete when the following scenario is reliable end to end:

```text
business creates service
business creates staff
business configures weekly availability
customer opens public booking page
customer selects service
server returns actual available slots
customer books a slot
server prevents duplicate booking races
appointment appears in staff calendar
confirmation email is queued/sent
customer can reschedule
customer can cancel
staff can confirm/check-in/complete/no-show appointment
all actions remain isolated to the correct organization
```

If this flow is stable, transactional, timezone-correct, and protected against double booking, the server has the foundation needed for the rest of the appointment SaaS.
