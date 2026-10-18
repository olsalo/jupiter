# Appointment SaaS Frontend MVP Guide

## 1. Purpose

This document defines a high-level frontend implementation guide for an appointment scheduling SaaS.

The frontend should make the most common operational tasks fast:

- View the schedule
- Create, edit, reschedule, and cancel appointments
- Manage customers
- Manage services
- Manage staff
- Configure availability
- Manage locations
- Configure booking rules
- Configure notifications
- Configure the public booking page
- Review basic business performance

The recommended UX pattern is:

- Full pages for primary navigation and high-level workspaces
- Sheets for create, edit, and detail views
- Modals for confirmations, destructive actions, and small focused tasks
- Inline controls where an action is simple enough that opening a sheet would add unnecessary friction

The MVP should prioritize clarity and fast operational workflows over deep customization.

---

# 2. Frontend Architecture

## Suggested Stack

Assumed frontend stack:

- React
- TypeScript
- Tailwind CSS
- tRPC client
- React Query through tRPC
- Better Auth client
- A date/time library with timezone support
- A calendar UI library or custom calendar implementation

## Core Frontend Layers

Organize the frontend into these layers:

```text
App shell
  ├─ Navigation
  ├─ Organization context
  ├─ Page routes
  ├─ Query state
  ├─ Sheet/modal state
  └─ Toasts / global feedback

Feature modules
  ├─ Appointments
  ├─ Calendar
  ├─ Customers
  ├─ Services
  ├─ Staff
  ├─ Availability
  ├─ Locations
  ├─ Booking page
  ├─ Notifications
  ├─ Integrations
  └─ Settings
```

Prefer feature-local components, validation schemas, hooks, and tRPC calls instead of one large global frontend module.

---

# 3. App Shell

## Main Navigation

Recommended primary navigation:

```text
Dashboard
Calendar
Appointments
Customers
Services
Staff
Availability
Locations
Booking Page

Settings
```

For a smaller MVP, `Calendar` can serve as the primary appointments workspace and `Appointments` can be omitted initially.

## Top Bar

The top bar should include:

- Organization switcher
- Current organization name
- Global create button
- User menu
- Optional notifications indicator

Recommended global create menu:

```text
+ New
  ├─ Appointment
  ├─ Customer
  ├─ Service
  └─ Staff member
```

## Organization Context

Every organization-scoped page should use the active organization from Better Auth.

The UI should never require the user to manually select an organization inside forms when an active organization already exists.

If there is no active organization:

- Redirect to organization selection/setup
- Do not render organization-scoped data

---

# 4. Sheet and Modal Interaction Model

## Sheets

Use sheets for:

- View appointment
- Create appointment
- Edit appointment
- View customer
- Edit customer
- Create customer
- View service
- Edit service
- Create service
- View staff member
- Edit staff member
- Create staff member
- Edit availability
- View waitlist entry
- Payment details
- Notification details
- Location create/edit

Recommended sheet behavior:

- Desktop: right-side sheet
- Mobile: full-screen sheet
- Keep URL state in sync where useful
- Preserve page context behind the sheet
- Allow deep links for important objects when practical

Example:

```text
/calendar?appointment=appt_123
```

This lets a user open an appointment, copy the URL, refresh, and return to the same state.

## Modals

Use modals for:

- Delete confirmation
- Cancel appointment
- Confirm reschedule
- Refund confirmation
- Remove staff member
- Remove service
- Disconnect integration
- Unsaved changes warning
- Short one-step actions

Avoid putting long forms inside centered modals.

## Nested UI

Avoid nesting full sheets inside sheets.

Preferred pattern:

```text
Appointment sheet
  -> Edit
  -> same sheet changes to edit mode
```

or:

```text
Appointment sheet
  -> opens small confirmation modal
```

If another entity needs editing, close or replace the current sheet state.

---

# 5. Dashboard

The dashboard should answer:

- What is happening today?
- What needs attention?
- How busy are we?
- Are there cancellations or no-shows?

## MVP Dashboard Cards

Include:

- Appointments today
- Upcoming appointments
- Revenue today
- Cancellations today
- No-shows
- New customers

## Today's Schedule

Show a compact schedule list:

```text
09:00  Haircut          Jane Smith      Mia
10:00  Consultation     Alex Brown      Leo
11:30  Massage          Emma Wilson     Mia
```

Clicking a row opens the appointment sheet.

## Attention Section

Useful items:

- Unconfirmed appointments
- Failed notifications
- Unpaid appointments
- Waitlist entries
- Appointments missing required information

This can be very lightweight in the MVP.

---

# 6. Calendar

The calendar is the core operational UI.

## Views

MVP:

- Day
- Week

Optional:

- Month
- Staff timeline

Week view is usually the most important.

## Calendar Controls

Include:

- Previous
- Today
- Next
- Date picker
- Day/week toggle
- Staff filter
- Location filter
- Service filter
- Appointment status filter

## Appointment Blocks

Appointment blocks should show:

- Start/end time
- Customer name
- Service
- Staff member
- Status indicator

Example:

```text
09:00 - 10:00
Haircut
Jane Smith
Mia
```

Do not overload blocks with secondary data.

## Calendar Interactions

MVP interactions:

- Click empty slot -> Create appointment sheet
- Click appointment -> Appointment detail sheet
- Drag appointment -> Reschedule confirmation
- Resize appointment -> Optional, can wait until post-MVP
- Current-time indicator
- Blocked-time display

## Creating from a Calendar Slot

When the user clicks a slot, prefill:

- Date
- Start time
- Staff if clicked inside a staff column
- Location if calendar is filtered to a location

The create sheet should then ask for:

1. Customer
2. Service
3. Staff
4. Date/time
5. Location
6. Notes
7. Payment if relevant

---

# 7. Appointment Sheet

The appointment detail sheet should be one of the strongest screens in the app.

## Header

Show:

- Customer
- Status
- Date/time
- Main actions

Actions:

```text
Edit
Reschedule
Confirm
Cancel
Mark complete
Mark no-show
```

Only show actions valid for the current state.

## Overview

Display:

- Services
- Staff
- Location
- Duration
- Price
- Payment status
- Booking source
- Booking code
- Customer notes
- Internal notes

## Timeline

Show important events:

```text
Appointment created
Confirmation sent
Appointment confirmed
Rescheduled
Payment received
Completed
```

## Customer Summary

Include:

- Name
- Email
- Phone
- Previous appointments count
- Link/open customer profile

## Payment Summary

If payments are enabled:

- Total
- Paid
- Remaining
- Refunds

## Notification Summary

Show:

- Confirmation sent
- Reminder status
- Failed notifications

Keep this collapsed unless needed.

---

# 8. Create/Edit Appointment Sheet

The form should optimize for speed.

## Fields

Recommended order:

### Customer

Search existing customers by:

- Name
- Email
- Phone

If no match:

```text
+ Create customer
```

Prefer inline quick-create rather than forcing the user to leave the appointment form.

### Service

Select one or more services if multi-service bookings are supported.

Show:

- Duration
- Price

### Staff

Filter staff based on selected services.

Allow:

- Specific staff
- Any available staff, if supported

### Location

Filter based on service and staff availability.

### Date and Time

Do not use a raw datetime input as the main booking UX.

Use:

```text
Date picker
Available time slots
```

If an admin can override availability, expose that as a deliberate action:

```text
Show unavailable times
```

### Notes

Separate:

- Customer-visible notes
- Internal notes

### Price

For admin-created appointments:

- Display calculated total
- Allow adjustment only if business rules support it

### Confirmation

Allow:

- Send confirmation
- Skip confirmation

Default to the organization setting.

---

# 9. Appointment List

If you include a separate Appointments page, it should be table-focused.

## Columns

Recommended:

- Date/time
- Customer
- Service
- Staff
- Location
- Status
- Payment
- Source

## Filters

- Date range
- Status
- Staff
- Service
- Location
- Payment status
- Booking source

## Actions

Click a row to open the appointment sheet.

Avoid putting many icon buttons directly in each row.

Use an overflow menu for secondary actions.

---

# 10. Customers

## Customer List

Columns:

- Name
- Email
- Phone
- Last appointment
- Next appointment
- Total appointments

Filters:

- Search
- Tags
- Has upcoming appointment
- New / returning customer

## Customer Sheet

Sections:

### Overview

- Contact details
- Notes
- Tags
- Marketing consent

### Upcoming Appointments

Clickable list.

### Appointment History

Show:

- Date
- Service
- Staff
- Status
- Amount

### Notes

Allow staff to add internal customer notes.

## Customer Create/Edit

Fields:

- First name
- Last name
- Email
- Phone
- Locale
- Timezone
- Address
- Company
- Date of birth
- Tags
- Marketing consent

The MVP form can expose only the common fields by default and place secondary fields under an expandable "More details" section.

---

# 11. Services

## Service List

Use a table or cards.

Show:

- Name
- Category
- Duration
- Price
- Staff count
- Location count
- Active/inactive

## Service Sheet

Sections:

### Basics

- Name
- Description
- Category
- Image
- Color

### Duration

- Duration
- Buffer before
- Buffer after

### Pricing

- Price
- Currency
- Payment requirement
- Deposit

### Booking Rules

- Minimum booking notice
- Maximum advance booking
- Cancellation notice
- Reschedule notice
- Requires confirmation
- Waitlist enabled

### Availability

- Assigned staff
- Assigned locations

### Capacity

- Max attendees

### Intake

- Booking questions

---

# 12. Staff

## Staff List

Show:

- Name
- Email
- Services
- Locations
- Next appointment
- Status

## Staff Sheet

Sections:

### Profile

- Name
- Email
- Phone
- Image
- Bio
- Timezone

### Services

Assigned services with optional staff-specific:

- Duration
- Price

### Locations

Assigned locations.

### Availability

Summary of weekly schedule.

Provide:

```text
Edit availability
```

### Calendar Integration

Show connected external calendars.

### Status

- Active
- Accepts appointments

---

# 13. Availability

Availability deserves its own page because it becomes difficult to manage inside generic forms.

## Main Availability Screen

Recommended layout:

```text
Staff selector
Location selector

Monday      09:00 - 17:00
Tuesday     09:00 - 17:00
Wednesday   09:00 - 17:00
Thursday    09:00 - 17:00
Friday      09:00 - 15:00
Saturday    Closed
Sunday      Closed
```

Actions:

- Add time range
- Copy Monday to weekdays
- Copy schedule to another staff member
- Clear day

## Availability Rule Editor

Use a sheet.

Fields:

- Day
- Start
- End
- Location
- Effective from
- Effective until

Support multiple intervals per day.

Example:

```text
Monday
09:00 - 12:00
13:00 - 17:00
```

## Time Off / Overrides

Separate section:

```text
Time off
Special hours
Closures
```

Create override sheet fields:

- Date/range
- Available or unavailable
- Staff
- Location
- Start/end
- Reason

---

# 14. Locations

## Location List

Show:

- Name
- Address
- Staff count
- Services count
- Active/inactive

## Location Sheet

Fields:

- Name
- Address
- City
- Postal code
- Country
- Timezone
- Phone
- Email
- Booking instructions
- Active

Optional:

- Map coordinates

Do not require coordinates in the MVP.

---

# 15. Public Booking Page

The business-facing admin should have a Booking Page section.

## Booking Page List

Allow multiple booking pages if supported.

Show:

- Name
- Slug
- URL
- Status

Actions:

- Edit
- Preview
- Copy booking link
- Disable

## Booking Page Editor

Sections:

### Basics

- Name
- Slug
- Page title
- Description
- Logo

### Selection Behavior

- Require service selection
- Allow staff selection
- Allow location selection
- Default location

### Available Services

Choose services exposed on the page.

### Available Staff

Choose staff exposed on the page.

### Confirmation

- Success message

### Preview

Always include a clear preview action.

---

# 16. Public Customer Booking Flow

The public booking flow should be simple and step-based.

Recommended steps:

```text
1. Service
2. Staff / location
3. Date & time
4. Your details
5. Additional questions
6. Payment
7. Confirmation
```

Skip steps that are unnecessary.

Example:

- One location -> do not ask location
- One staff member -> do not ask staff
- No custom questions -> skip questions
- No payment -> skip payment

## Service Selection

Show:

- Service name
- Description
- Duration
- Price

## Staff Selection

Allow:

```text
Any available staff
Mia
Leo
Anna
```

"Any available" should usually be the easiest default.

## Time Selection

Show available dates and slots only.

Do not expose unavailable slots unless there is a useful reason.

## Customer Details

Fields:

- Name
- Email
- Phone, depending on settings

## Confirmation

Show:

- Date/time
- Timezone
- Service
- Staff
- Location
- Price
- Booking code

Provide actions:

- Add to calendar
- Reschedule
- Cancel

---

# 17. Booking Questions

Booking questions can be managed under:

```text
Services -> Service -> Intake
```

or:

```text
Settings -> Booking Questions
```

For MVP, service-level management is easier.

## Question Editor

Use a sheet.

Fields:

- Label
- Description
- Type
- Placeholder
- Required
- Options
- Sort order
- Active

Supported MVP types:

- Short text
- Long text
- Boolean
- Single select
- Multi select

Additional types can be added later.

---

# 18. Notifications

## Notification Settings

The frontend should let admins configure:

- Booking confirmation
- Cancellation confirmation
- Reschedule confirmation
- Reminder timing

For MVP, email is enough.

SMS can be added later.

## Notification Template Screen

List:

- Template name
- Event
- Channel
- Enabled
- Reminder offset

## Template Edit Sheet

Fields:

- Subject
- Body
- Enabled
- Reminder offset

Show available variables:

```text
{{customerName}}
{{serviceName}}
{{staffName}}
{{appointmentDate}}
{{appointmentTime}}
{{locationName}}
{{bookingCode}}
```

A live preview is useful but optional for MVP.

---

# 19. Settings Information Architecture

Recommended settings navigation:

```text
Settings
  ├─ General
  ├─ Booking
  ├─ Calendar
  ├─ Notifications
  ├─ Payments
  ├─ Team & Permissions
  ├─ Integrations
  ├─ Billing
  └─ Danger Zone
```

Not every section needs to ship in the first release.

---

# 20. General Settings

Fields:

- Business name
- Logo
- Business ID
- Timezone
- Country
- Currency
- Week starts on
- Locale

Potential later additions:

- Business phone
- Business email
- Address
- Website

Timezone should be treated as an important setting, not an advanced hidden field.

---

# 21. Booking Settings

This should contain organization-wide defaults.

## Availability / Slot Rules

- Default slot interval
- Minimum booking notice
- Maximum booking advance
- Default cancellation notice
- Default reschedule notice

## Customer Requirements

- Require email
- Require phone

## Appointment Behavior

- Auto-confirm appointments
- Allow customer cancellation
- Allow customer rescheduling
- Booking enabled

## Defaults

- Default location
- Default timezone
- Default booking page

Service-level settings can override global defaults where supported.

---

# 22. Calendar Settings

Recommended settings:

- Week starts on
- Default calendar view
- Default start/end hour
- Show weekends
- Show cancelled appointments
- Calendar slot interval

Optional:

- Appointment colors by service
- Appointment colors by staff
- Compact calendar mode

---

# 23. Notification Settings

MVP settings:

- Send booking confirmation
- Send cancellation email
- Send reschedule email
- Enable appointment reminders

Reminder configuration:

```text
24 hours before
2 hours before
```

Allow one or more reminders if backend support exists.

Also show:

- Sender name
- Reply-to address

Provider-level settings should stay under integrations if using an external email/SMS provider.

---

# 24. Payment Settings

If appointment payments ship in MVP:

- Enable online payments
- Payment provider status
- Default payment requirement
- Default deposit amount
- Allow manual payments
- Refund behavior

If payments are not part of MVP, keep this section hidden.

SaaS subscription billing should stay separate from appointment payment settings.

---

# 25. Team and Permissions

At minimum show organization members.

Columns:

- Name
- Email
- Role
- Staff profile
- Status

Actions:

- Invite member
- Change role
- Link to staff profile
- Remove member

MVP roles can stay simple:

```text
Owner
Admin
Member
```

If the product needs staff-specific restrictions later:

```text
Owner
Admin
Manager
Staff
Viewer
```

Avoid building a granular permission matrix too early.

---

# 26. Integrations

MVP integration page should use cards.

Example:

```text
Google Calendar
Connected

Outlook Calendar
Not connected

Stripe
Connected
```

Each integration card can open a sheet with:

- Connection status
- Connected account
- Sync settings
- Disconnect

For calendar integrations:

- Calendar selection
- Block availability from external events
- Write appointments to external calendar

---

# 27. Billing

This section is for the SaaS subscription, not customer appointment payments.

Show:

- Current plan
- Subscription status
- Billing interval
- Seats
- Renewal date
- Stripe customer portal action

If Better Auth or your billing system already provides this UI elsewhere, link to that instead of duplicating it.

---

# 28. Danger Zone

Potential actions:

- Disable public booking
- Delete organization
- Export data

Destructive actions should always use confirmation modals.

For deleting an organization, require stronger confirmation such as typing the organization name.

---

# 29. Search

At minimum, provide search in:

- Customers
- Appointments
- Services
- Staff

A global command menu can come later.

Useful global search eventually:

```text
Search Jane Smith
  Customer: Jane Smith
  Appointment: Jane Smith - Oct 12
```

---

# 30. Empty States

Every main page should have a useful empty state.

Example:

```text
No services yet

Create your first service before accepting bookings.

[Create service]
```

Important empty states:

- No appointments
- No customers
- No services
- No staff
- No locations
- No availability
- No booking page
- No integration

Avoid empty tables with no guidance.

---

# 31. Loading and Error States

## Loading

Prefer:

- Skeletons for page-level content
- Small spinners for button mutations

Avoid blocking the entire app during a small mutation.

## Errors

Use:

- Inline field errors for validation
- Toasts for unexpected mutation failures
- Page-level error states for query failures

Examples:

```text
This time slot is no longer available.
```

This should be a first-class booking error because concurrent bookings can make a previously shown slot invalid.

---

# 32. Optimistic UI

Use optimistic updates selectively.

Good candidates:

- Customer notes
- Simple active/inactive toggles
- Tags
- Non-critical metadata

Avoid optimistic updates for:

- Appointment creation
- Rescheduling
- Payments
- Availability conflicts

These should wait for the server because the server is the source of truth for conflicts.

---

# 33. Query and Cache Strategy

Use tRPC query invalidation around feature boundaries.

Examples:

After appointment create/update:

```text
invalidate calendar range
invalidate appointment list
invalidate customer appointments
invalidate dashboard summary
```

After service update:

```text
invalidate services
invalidate public booking config
```

After availability update:

```text
invalidate availability rules
invalidate affected available-slot queries
```

Do not refetch the entire application after every mutation.

---

# 34. URL State

Use URL query state where it improves navigation.

Examples:

```text
/calendar?date=2026-10-09
/calendar?date=2026-10-09&view=week
/calendar?appointment=abc123
/customers?customer=customer123
/services?service=service123
```

Benefits:

- Back/forward navigation
- Refresh persistence
- Shareable internal links

Temporary form state does not need to be stored in the URL.

---

# 35. Permissions in the UI

Frontend permissions are for UX only.

The server must still enforce authorization.

The frontend should:

- Hide actions the user cannot perform
- Disable unavailable actions where context matters
- Avoid rendering inaccessible settings sections
- Avoid loading sensitive data unnecessarily

Examples:

A regular staff member may see:

```text
Calendar
Customers
Own appointments
Own availability
```

while an admin may also see:

```text
Services
Staff
Locations
Booking page
Settings
Billing
```

---

# 36. Mobile Behavior

Sheets should become full-screen on mobile.

Calendar mobile priorities:

- Day view first
- Staff selector
- Date navigation
- Appointment list for selected day

Do not force a desktop-style seven-column weekly calendar onto narrow screens.

Useful mobile layout:

```text
Friday 9 Oct

09:00
Haircut
Jane Smith

10:30
Consultation
Alex Brown
```

---

# 37. Recommended MVP Pages

Ship these first:

```text
/dashboard
/calendar
/customers
/services
/staff
/availability
/locations
/booking-pages
/settings/general
/settings/booking
/settings/notifications
/settings/team
```

If payments are included:

```text
/settings/payments
```

If calendar sync is included:

```text
/settings/integrations
```

---

# 38. Recommended MVP Sheets

Build these reusable sheets:

```text
AppointmentSheet
AppointmentFormSheet

CustomerSheet
CustomerFormSheet

ServiceSheet
ServiceFormSheet

StaffSheet
StaffFormSheet

LocationFormSheet

AvailabilityRuleSheet
AvailabilityOverrideSheet

BookingPageFormSheet

NotificationTemplateSheet
```

A single component can often support both create and edit modes:

```ts
type ServiceFormSheetProps =
  | {
      mode: 'create'
      serviceId?: never
    }
  | {
      mode: 'edit'
      serviceId: string
    }
```

---

# 39. Recommended Confirmation Modals

```text
CancelAppointmentModal
DeleteServiceModal
DeleteCustomerModal
DeleteStaffModal
DeleteLocationModal
DisconnectIntegrationModal
RefundPaymentModal
UnsavedChangesModal
```

Prefer clear action labels:

```text
Cancel appointment
Delete service
Disconnect Google Calendar
```

instead of generic:

```text
Confirm
Yes
OK
```

---

# 40. Recommended MVP Build Order

## Phase 1: App Shell

Build:

- Authenticated layout
- Active organization handling
- Navigation
- Sheet system
- Modal system
- Toasts
- Query/error boundaries

## Phase 2: Services, Staff, Locations

Build:

- Service CRUD
- Staff CRUD
- Location CRUD
- Staff/service assignment
- Staff/location assignment

These are prerequisites for meaningful scheduling.

## Phase 3: Availability

Build:

- Weekly availability
- Availability overrides
- Time off
- Availability display

## Phase 4: Calendar and Appointments

Build:

- Week/day calendar
- Appointment detail sheet
- Appointment create/edit sheet
- Cancel
- Reschedule
- Complete
- No-show

## Phase 5: Customers

Build:

- Customer list
- Customer detail
- Appointment history
- Notes

## Phase 6: Public Booking

Build:

- Booking page
- Service selection
- Staff/location selection
- Slot selection
- Customer details
- Confirmation

## Phase 7: Notifications

Build:

- Notification settings
- Templates
- Reminder configuration
- Delivery status in appointment view

## Phase 8: Integrations / Payments

Add only after the core scheduling experience is stable.

---

# 41. MVP Scope Recommendation

For the first usable release, the frontend needs to make these workflows excellent:

### Admin workflow

```text
Create service
  ->
Create staff
  ->
Set staff availability
  ->
Create booking page
  ->
Receive bookings
  ->
Manage appointments from calendar
```

### Customer workflow

```text
Open booking page
  ->
Choose service
  ->
Choose slot
  ->
Enter details
  ->
Confirm
  ->
Receive confirmation
```

### Daily staff workflow

```text
Open calendar
  ->
See today's schedule
  ->
Open appointment
  ->
Review customer
  ->
Complete / cancel / no-show
```

Everything else is secondary to these three loops.

---

# 42. Frontend Principles

Use these as product constraints for the MVP:

1. Calendar is the operational center of the product.
2. Sheets preserve context and should be preferred for entity CRUD.
3. Modals should stay small and focused.
4. The server owns availability and conflict validation.
5. Forms should prefill aggressively based on context.
6. Hide irrelevant choices instead of asking the user to configure everything.
7. Global settings provide defaults, service settings provide overrides.
8. Destructive actions should be explicit.
9. Public booking should show the minimum number of steps necessary.
10. Mobile scheduling should prioritize day-based workflows over dense calendar layouts.
11. Avoid building highly granular permissions before real users require them.
12. Keep appointment payment settings separate from SaaS subscription billing.
13. Keep customer-facing notes separate from internal operational notes.
14. Preserve historical appointment data even when services or staff later change.
15. Make timezone context visible whenever ambiguity is possible.

---

# 43. Suggested Frontend Feature Structure

A practical React feature structure could look like:

```text
src/
  features/
    appointments/
      components/
      hooks/
      schemas/
      utils/
      appointment-sheet.tsx
      appointment-form-sheet.tsx

    calendar/
      components/
      hooks/
      utils/

    customers/
      components/
      schemas/
      customer-sheet.tsx
      customer-form-sheet.tsx

    services/
      components/
      schemas/
      service-sheet.tsx
      service-form-sheet.tsx

    staff/
      components/
      schemas/
      staff-sheet.tsx
      staff-form-sheet.tsx

    availability/
      components/
      utils/
      availability-rule-sheet.tsx
      availability-override-sheet.tsx

    locations/
      components/
      schemas/

    booking-pages/
      components/
      schemas/

    notifications/
      components/
      schemas/

    settings/
      components/

  components/
    ui/
    app-shell/
    sheets/
    modals/

  lib/
    auth/
    trpc/
    dates/
    permissions/
```

Keep domain-specific logic in feature modules rather than growing generic component folders indefinitely.

---

# 44. Final MVP Navigation Example

```text
Dashboard

Schedule
  Calendar
  Appointments

People
  Customers
  Staff

Business
  Services
  Availability
  Locations
  Booking Page

Settings
```

For the smallest MVP, simplify to:

```text
Dashboard
Calendar
Customers
Services
Staff
Availability
Booking Page
Settings
```

This is enough to support the full appointment lifecycle without making the product feel fragmented.
