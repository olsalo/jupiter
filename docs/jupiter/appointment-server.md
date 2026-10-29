# Appointment server

The MVP extends the existing `app/.server/main.ts` tRPC router, Better Auth
context, Prisma client, and appointment models. There is no new server framework
or change to the existing route structure. Inputs live in
`app/lib/schemas/appointments.ts`.

## API

- `organizations.getCurrent`, `organizations.updateSettings`
- `service.list/get/create/update/archive/setLocations`
- `staff.list/get/create/update/archive/setServices/setLocations`
- `location.list/create/update/archive`
- `customer.list/get/create/update/getAppointments`
- `availability.getRules/replaceRules/listOverrides/createOverride/deleteOverride`
- `availability.listBlockedTime/createBlockedTime/deleteBlockedTime/getSlots`
- `appointment.list/get/create/updateNotes/confirm/cancel/reschedule/checkIn/start/complete/markNoShow`
- `booking.getPage/getAvailableSlots/create/getByCode/cancel/reschedule`

Private scheduling APIs require an explicitly active organization and recheck
membership. Owners and admins manage staff, services, locations, availability,
and booking settings. Members may manage customers and operate their linked
staff profile's appointments. A member without a staff profile cannot access
appointments. Existing billing, onboarding, team, and example routers are retained.

Calendar requests require a date range of at most 93 days. Customer lists and
history use bounded ID cursors. Slot queries allow up to 31 days, 50 candidate
staff, and 20 eligible locations. Weekly windows and available overrides are
combined; unavailable overrides, blocks, and appointments subtract occupied time.
Contradictory overrides with overlapping scopes are rejected.

## Booking rules

Assign services to staff and configure weekly rules. Locations are optional when
a service has no location assignments. If it has assignments, only active
locations shared with the selected staff are eligible. Configure service locations
with `service.setLocations` and staff locations with `staff.setLocations`.

A named booking page restricts services and staff to its assigned lists, when
nonempty, and enforces its selection flags and default location. Omitting the
page slug uses the organization's default booking page when configured, otherwise
the general booking page. Explicit location selection overrides the page default,
which overrides the organization default. Default timezone falls back to the
organization timezone when cleared. Public responses exclude
staff contact details, member data, customer records, notes, and internal metadata.
A random 32-character booking code is a bearer secret for lookup and changes.

All scheduling writes take a PostgreSQL transaction-level advisory lock per
organization, including schedule/configuration edits. This intentionally coarse
MVP lock covers any-staff assignment, cross-midnight buffers, customer matching,
and organization-wide closures. The transaction then revalidates the complete
occupied interval before inserting or rescheduling. Independent organizations
remain concurrent; busy organizations can later move to ordered staff/day locks.

Service names, price, duration, and buffers are snapshotted. Rescheduling retains
them. Cancelled, completed, no-show, and expired pending appointments do not block
slots. Expired pending holds cannot be confirmed. Normal pending appointments
await manual confirmation and do not expire automatically.

Temporal converts recurring local rules to UTC. On DST transition days, the
engine evaluates actual instants against wall-clock working minutes, omitting
nonexistent times and including both valid repeated periods. Slots return ISO
instants grouped by the organization timezone. Existing private APIs retain
Jupiter's SuperJSON date handling.

The existing service notice column is non-null with a zero default, so zero
inherits the organization's minimum notice. Positive service notices override it. New services inherit the organization currency
unless their creation input supplies a currency explicitly; existing services and
appointment snapshots retain their own currency.
Nullable horizons and cancellation/reschedule notices inherit settings normally.
Group capacity, payment-required services, and resource-required services are
rejected until those features are implemented. Staff-specific price/duration
assignment overrides are not exposed by this MVP API.

## Notifications and jobs

Booking/lifecycle transactions queue email records. Provider calls happen in the
worker, never in booking transactions. Reminders use the organization’s configured offsets (24 hours by default)
when those times are still in the future. Up to five distinct offsets are supported,
including 24 hours and 2 hours before the appointment. Changing reminder settings
atomically rebuilds unsent reminders for future active appointments. Rescheduling/cancellation
cancels outdated unsent messages and creates replacements as appropriate.

The application build (`npm run build`) also bundles the worker. To rebuild just
the worker, use `npm run build:appointment-jobs`. Run
`npm run jobs:appointments` once per minute using a process scheduler. It uses
the existing email provider configuration (`EMAIL_PROVIDER`, `EMAIL_FROM`, and
`RESEND_API_KEY` or `PLUNK_API_KEY`). It requires a configured provider and key
rather than treating disabled delivery as success.

The worker processes up to 100 records per iteration, claims messages atomically
with five-minute leases, and retries failures with backoff up to five attempts.
A crashed worker's lease is reclaimable. Delivery is at-least-once: a crash after
the provider accepts an email but before the SENT update may cause a duplicate.
The same worker cancels expired holds and removes rate-limit audit rows older
than a day. Ordinary appointment audit history is retained.

## Public endpoint protection

Jupiter defaults to `X-Real-IP` supplied by Traefik. `TRUSTED_CLIENT_IP_HEADER`
can override the header, with `BOOKING_TRUSTED_IP_HEADER` as a legacy fallback.
The trusted proxy must strip client-supplied values and set the visitor's IP.
Production rejects missing or invalid IP headers instead of sharing an unknown-client bucket. Organization and client
limits are stored in PostgreSQL and work across app instances: 600 reads or 100
writes per organization per minute, with 120 reads or 10 writes per client.

A PostgreSQL-backed prelookup limit also protects invalid slug/code lookups
across app instances. No raw booking codes, customer answers, notes, or contact
fields are logged. Booking procedure outcome/latency logs and transactional
appointment events/audit records provide basic observability.

## Verification

Run `npm run test:appointments`. The availability suite needs no database. The
integration suite creates disposable users and organizations in `DATABASE_URL`
and removes them in `finally`. It never sends real email. Coverage includes
scoping/roles, date ranges, weekly windows, closures, buffers, DST gaps/repeated
hours, selected/any staff, locations, booking races, service snapshots, lifecycle,
customer matching, expiration, notification claims and retries.

## Settings API

Read all preferences with `organizations.getCurrent` and update any subset with
`organizations.updateSettings`. The existing `general`/`updateGeneral` API also
supports business ID and week start, and retains `location` as its country field
for compatibility with the current UI. `general` also returns `country` in uppercase.
Owner/admin roles can save settings; members can read them. References must point
to active locations/booking pages in the same organization. Nullable defaults,
sender name and reply-to address can be cleared with `null`.

| Settings group | API fields |
| --- | --- |
| General | `businessName`, `businessId`, `timezone`, `country`, `currency`, `weekStartsOn` |
| Slot rules | `defaultSlotIntervalMinutes`, `minBookingNoticeMinutes`, `maxBookingAdvanceDays`, `cancellationNoticeMinutes`, `rescheduleNoticeMinutes` |
| Customer requirements | `requireCustomerEmail`, `requireCustomerPhone` |
| Appointment behavior | `autoConfirmAppointments`, `allowCustomerCancellation`, `allowCustomerRescheduling`, `bookingEnabled` |
| Booking defaults | `defaultLocationId`, `defaultTimezone`, `defaultBookingPageId` |
| Calendar | `weekStartsOn`, `defaultCalendarView`, `defaultStartHour`, `defaultEndHour`, `showWeekends`, `showCancelledAppointments`, `calendarSlotIntervalMinutes` |
| Notifications | `sendBookingConfirmations`, `sendCancellationEmails`, `sendRescheduleEmails`, `enableAppointmentReminders`, `reminderOffsetsMinutes`, `senderName`, `replyToAddress` |

`country` maps to the existing `OrganizationSettings.location` column. General and
calendar share one `weekStartsOn` value (0 = Sunday through 6 = Saturday). Calendar
view supports `day`, `week`, `month` and `agenda`; start/end hours must form an
increasing range, including when only one hour is updated. Weekend visibility and
visible hours are display preferences; they do not remove bookable times. Calendar
slot interval is independent from the booking slot interval. Appointment lists
use `showCancelledAppointments` by default; `includeCancelled` or an explicit
status filter overrides it.

Reminder offsets are minute values from 1 to 10080 (one week). For both requested
reminders, save `reminderOffsetsMinutes: [1440, 120]`. Disabling reminders cancels
unsent reminders. The worker also rechecks notification toggles before delivery
and uses the current sender name/reply-to address. Provider credentials and the
verified sender email remain in integration/environment configuration. Plunk uses
its documented [sender object](https://docs.useplunk.com/api-reference/public-api/sendEmail)
for display-name customization; Resend uses a display name with the configured
verified address.

Run `npm run test:appointment-settings` for settings roundtrips, cross-tenant
reference rejection, calendar preferences, booking defaults, multiple reminders,
reminder configuration changes, sender/reply-to behavior, and role checks.

## Combined Team workspace

`/team` now manages staff profiles, organization membership and pending invitations.
The separate `/staff` route and navigation item are removed. The existing `staff`
tRPC router remains available to scheduling code.

The People tab shows organization members and unlinked staff once each, with
independent app-access, permission and appointment states. It supports contact
search and appointment filtering. Invitations remain in their own tab.

`/team/new` opens the Add person sheet. `Takes appointments` creates a staff
profile immediately and permits service/location assignments. `Give app access`
requires an email and creates a 14-day invitation. Both can be enabled together.
An access-only invitation opens the Invitations tab after saving; membership is
created on acceptance. Phone, bio and timezone belong to the staff profile.

`/team/:personId` opens details; `/team/:personId/edit` uses the same sheet to edit
a staff profile or enable appointments for an existing member. Historical member
IDs continue to resolve their linked staff profile. Existing account identity is
kept separate from organization-specific staff contact details.

- `team.addPerson` saves staff, assignments, invitation and email queue atomically
- `team.getPerson` returns the scoped person/profile/account/invitation
- `team.updatePerson` updates the profile and assigned services/locations
- `team.setRole` changes another non-owner member's Member/Admin permission
- `team.invite` accepts an optional `staffMemberId` to invite an existing profile

Invitation rows explicitly reference their intended staff profile. Better Auth
validates the recipient's verified email and links the accepted membership through
an acceptance hook, including native auth acceptance. Linking is idempotent and
never guesses a profile by name. If an existing member has no profile, adding or
inviting their staff profile links it without issuing another invitation or
changing their existing role.

Cancelling an invitation retains staff. Revoking membership unlinks staff and
preserves appointments/history. Changing the email of a profile with a pending
invite requires cancelling that invite first. Disabling appointments retains the
profile and its history; it does not revoke app access.

Combined-flow invitation emails use the notification worker. Accepted, cancelled,
or expired invitation messages are suppressed before delivery. Copy-link invites
remain supported. Run `npm run test:team` and `npm run test:team-people` to verify
the original invitation flow, combined-flow invariants and rendered sheets.
