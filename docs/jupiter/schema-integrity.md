# Schema integrity and historical bookings

Run `npm run db:push` to generate the client, check existing data, sync Prisma, apply versioned backfills once, and install database checks and tenant guards. Run `npm run db:generate` after schema changes. `db:preflight` only reads data; `db:constraints` reapplies the database checks without repeating completed backfills.

The versioned backfill is in `prisma/schema-changes/20261022-integrity.ts`. `SchemaChange` records completed versions. Keep this table in backups. Future backfills need a new version; do not change the behavior of an already-applied backfill.

## Business boundaries

Required business-owned references use composite foreign keys where both columns are present. Optional references and assignment tables are checked by database triggers generated from the active schema's relations. This preserves existing `SetNull` and cascade behavior without adding redundant business columns to every assignment table.

The guards reject mismatched customers, staff, locations, services, categories, resources, booking pages, questions, payments and other business-owned references. They also prohibit moving an existing record between businesses. User/account references are shared identities and remain outside these tenant rules. Moving business data requires an explicit export/import rather than changing its ownership key.

Scheduling checks enforce valid intervals, weekly minute ranges, positive durations and quantities, nonnegative buffers, notices and money, valid calendar ranges, and nonnegative notification attempts. These PostgreSQL checks and triggers are intentionally installed by `db:constraints` because Prisma's schema does not express all of them.

## Inheritance and snapshots

`Service.minBookingNoticeMinutes = null` inherits the business value. Zero explicitly allows immediate booking. Existing zero values were migrated to null once to preserve their previous inherited behavior; later explicit zeros are preserved.

New bookings capture cancellation/rescheduling permissions and notice periods, minimum notice and advance limits. Their public management pages, available rescheduling slots, admin suggestions and mutations use those captured values. Subsequent catalogue/settings edits apply to new bookings. Replacing a service on an existing booking retains its captured booking policies.

Intake answers capture question labels, types, options and order. Team booking details use those labels and order even if the question is edited later. Private answers remain excluded from public booking-link responses.

For existing records, the backfill captures the settings and question definitions available at migration time. Historical values that had already been changed before this update cannot be reconstructed. Raw/imported appointments without policy snapshots retain the legacy fallback; imports should supply the captured policies or use the booking service.

## Notification queue

`scheduledAt` remains the intended send time. `nextAttemptAt` is the retry deadline, `lockedUntil`/`leaseToken` identify the active worker claim, and `attempts` counts delivery attempts. Completion and failure clear the claim. Workers filter due schedules, due retries and expired/unclaimed leases and use optimistic claims to prevent concurrent delivery of the same queue row. Provider delivery still needs provider-supported idempotency to cover a crash after send but before acknowledgement.

Global worker indexes cover notification channel/status/retry/schedule and pending appointment status/expiry. Business-specific indexes remain available for the UI.

## Naming and dates

- `OrganizationSettings.countryCode` maps to the existing `location` database column
- `OrganizationSettings.timezone` defines recurring business hours; optional `bookingTimezone` maps to the existing `defaultTimezone` column and controls the public booking display timezone
- `onboardingStep` is a nullable enum using the existing `availability` and `holidays` values
- Customer birthdays use PostgreSQL `date`; booking instants retain their timestamps and explicit timezone

Authentication-provider uniqueness and existing ID defaults were not changed.

## Verification

`tests/schema-integrity.integration.ts` exercises raw and Prisma cross-business writes, ownership changes, scheduling checks, explicit-zero/inherited notice, date-only birthdays, policy/question snapshots and public/admin rescheduling. Notification integration tests cover concurrent claims, original scheduling timestamps, retries and terminal states. Tests use isolated records and remove them afterward.
