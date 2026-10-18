# SaaS MVP Information Architecture

## 1. Purpose

This document defines the MVP information architecture for the scheduling and appointment SaaS.

The goal is to keep the product understandable even though the underlying data model is much richer. The UI should reflect how users think about their work, not how the database is structured.

The MVP supports three roles:

- **Owner**
- **Admin**
- **Member**

A user with any of these roles may also be **bookable staff**. App access and bookability are separate capabilities, but they should not feel like separate identities in the UI.

The MVP does **not** include:

- payment management
- payment integrations
- third-party integrations
- developer/webhook UI
- audit-log UI
- advanced reporting

---

# 2. Product mental model

The application should feel like it contains six main concepts:

1. **Calendar** — when work happens
2. **Customers** — who books
3. **Services** — what can be booked
4. **Team** — who provides services
5. **Booking page** — how customers book
6. **Settings** — how the user, business, and SaaS subscription are configured

The database contains many supporting models, but users should not need to understand them as separate product concepts.

Examples:

- availability rules, overrides, and blocked time become **Availability**
- members, staff members, and invitations become **Team**
- service categories and service assignments remain inside **Services**
- appointment services, attendees, answers, events, and resources remain inside an **Appointment**
- notification templates remain inside **Communications**
- booking page service and staff relations remain inside **Booking page**

---

# 3. Global navigation

## Owner and Admin

```text
Calendar
Customers

Services
Team
Booking page

────────────
Settings
```

## Member

```text
Calendar
Customers

────────────
Settings
```

Members do not see administrative configuration areas they cannot use.

The sidebar should remain intentionally small. Features should only become primary navigation items when users need to visit them independently and frequently.

---

# 4. User menu

The user menu should remain minimal.

```text
Olli
Owner

Settings
Sign out
```

Do not create a separate "Account settings" destination.

All personal settings belong under:

```text
Settings → Profile
```

If a bookable user needs to manage their schedule or availability, they should do that from **Calendar**, not from the user menu or Team.

---

# 5. Calendar

## Purpose

Calendar is the operational center of the product.

It answers:

- What is happening?
- When is it happening?
- Who is it with?
- Who is providing the service?
- What needs attention?
- When am I available?

After login, Calendar should usually be the default destination.

Do not create a separate Dashboard for the MVP.

Do not create a separate Appointments navigation item.

---

## 5.1 Calendar layout

Suggested structure:

```text
Calendar

[My schedule ▾]       [Day] [Week] [Agenda]

<   October 12–18   >                Today

[Service ▾] [Location ▾]

[Edit availability]                 [+ Appointment]

──────────────────────────────────────────────────
                    calendar
```

For owner/admin users, the staff selector may contain:

```text
Olli (me)
Jane
Michael
Everyone
```

For a member with limited visibility, it may simply show:

```text
My schedule
```

For a bookable user, default to their own schedule.

For a non-bookable user, default to the most useful business view.

---

## 5.2 Calendar views

MVP views:

- **Day**
- **Week**
- **Agenda**

Agenda is the appointment-list experience.

This avoids creating a separate "Appointments" page while still supporting users who prefer lists over calendar grids.

---

## 5.3 Creating work

Primary Calendar action:

```text
+ Appointment
```

Secondary time-based actions may live in the same action menu:

```text
New
  Appointment
  Block time
```

Avoid creating separate navigation for blocked time.

---

## 5.4 Appointment interaction

Selecting an appointment should open a side drawer rather than forcing the user away from the Calendar.

Suggested drawer:

```text
Appointment

Sarah Johnson
Haircut · 60 min

Mon 14:00–15:00
Jane · Helsinki

Status
Confirmed

Customer
Sarah Johnson
sarah@example.com

Notes
...

Activity
Booking created
Confirmation sent

[More] [Reschedule] [Complete]
```

The drawer is the primary surface for:

- appointment status
- customer
- staff member
- location
- services
- attendees
- booking answers
- notes
- appointment history
- cancellation
- rescheduling
- completion
- check-in if supported

Backend models related to appointments should be absorbed into this experience rather than exposed as separate pages.

---

# 6. Availability and time off

Availability belongs in **Calendar** because users think of it as part of their schedule.

For a bookable user:

```text
Calendar
  → Edit availability
```

Suggested drawer or modal:

```text
Availability

Weekly hours

Mon   09:00–17:00
Tue   09:00–17:00
Wed   Not available
Thu   09:00–17:00
Fri   09:00–15:00

Upcoming changes

Oct 20   Off
Oct 24   12:00–18:00

[+ Add time off]
[+ Add extra availability]
```

The UI should hide the distinction between:

- recurring availability
- one-off availability overrides
- blocked time

Users should experience those as:

- **Weekly hours**
- **Time off**
- **Extra availability**
- **Blocked time**

---

# 7. Customers

## Purpose

Customers are a first-class destination because users need to find and work with customers independently of individual appointments.

Root page:

```text
Customers                                  + New customer

Search customers...

Name              Contact              Last visit     Next visit
Sarah Johnson     sarah@...             Oct 3          Oct 19
John Smith        +358...               Sep 26         —
```

---

## 7.1 Customer detail

Suggested structure:

```text
Sarah Johnson

Overview | Appointments | Notes
```

### Overview

Contains:

- name
- email
- phone
- company
- address when relevant
- tags
- next appointment
- recent appointment
- key notes

### Appointments

Contains:

- upcoming appointments
- appointment history
- cancelled/no-show history when useful

### Notes

Contains staff-created notes about the customer.

Do not create separate navigation for:

- customer notes
- customer tags
- customer attendees

These remain part of Customer.

---

# 8. Services

## Purpose

Services define what the business offers and what customers can book.

Services deserve primary navigation for owner/admin because they are a core business object.

Root page:

```text
Services                                      + New service

Beauty
  Haircut                     60 min     €65
  Hair coloring              120 min    €140

Consultations
  Initial consultation        30 min     €30
```

Service categories should organize the page but should not become their own destination.

---

## 8.1 Service detail

Suggested sections:

```text
Service

General
Staff & locations
Booking
Customer questions
Advanced
```

### General

- name
- description
- duration
- buffer time
- price if used in MVP
- delivery type
- capacity
- color
- image
- active/inactive

If pricing is not operationally relevant in the MVP, it can remain minimal even if the schema supports it.

### Staff & locations

Manage:

- which team members provide the service
- which locations offer the service

### Booking

Manage:

- minimum booking notice
- maximum advance booking
- cancellation notice
- reschedule notice
- confirmation requirement
- waitlist enablement if included in MVP

### Customer questions

Manage questions customers answer during booking.

Keep them inside the service editor.

### Advanced

Only expose if needed:

- resource requirements
- other specialized behavior

---

# 9. Team

## Purpose

Team is the administrative view of people in the business.

It is not the place where users should normally manage themselves.

A bookable owner/admin/member should manage everyday personal scheduling from Calendar.

Team is for owner/admin actions such as:

- adding people
- configuring bookability
- assigning services
- managing another person's availability
- managing access
- changing role
- removing people

---

## 9.1 Team list

Suggested structure:

```text
Team                                           + Add person

Olli                                      You
Owner · Bookable

Jane
Admin · Not bookable

Michael
Member · Bookable

Sarah
No account · Bookable
```

The UI should make two separate capabilities understandable without presenting them as two identities:

- **app access**
- **bookable**

Examples:

- Owner + bookable
- Admin + not bookable
- Member + bookable
- No login + bookable

---

## 9.2 Team member detail

For owner/admin managing another person:

```text
Jane Doe

Profile | Booking | Availability | Access
```

### Profile

- name
- photo
- email
- phone
- bio
- timezone if needed

### Booking

Booking defines **how this person participates in customer booking**.

```text
Booking

Accepting bookings       On

Services
☑ Haircut
☑ Consultation
☐ Coloring

Locations
☑ Helsinki
☐ Espoo
☑ Tampere
```

Contains:

- accepting bookings on/off
- services this person provides
- locations where this person works

These settings answer:

> Can this person be booked, for what, and where?

### Availability

Availability defines **when this person can actually be booked**.

```text
Availability

Weekly hours

Helsinki
Mon    09:00–17:00
Tue    09:00–17:00

Tampere
Thu    10:00–18:00
Fri    10:00–16:00

Upcoming changes
Oct 20        Off
Oct 24        Helsinki · 12:00–18:00
```

Contains:

- recurring weekly hours
- time off
- extra availability
- blocked time

Availability may be location-specific when a person works different hours at different locations.

The distinction is:

```text
Booking
= Can this person be booked?
= For what?
= Where?

Availability
= When?
```

### Access

Only for people with app access.

Contains:

- app access enabled/disabled
- role
- invitation state
- remove access

Role options:

- Owner
- Admin
- Member

Owner-specific restrictions apply.

---

## 9.3 Managing yourself from Team

The current user may appear in Team because they are part of the roster.

However, Team should not become the main self-management route.

For the current user:

- schedule and availability belong in Calendar
- profile belongs in Settings → Profile
- bookable status, services, and work locations remain administrative configuration under Team → Person → Booking
- role/access remains visible only where appropriate

This avoids forcing users to "find themselves" in Team to manage everyday work.

---

## 9.4 Booking vs availability scope

Keep these concepts separate throughout the product:

```text
Team → Person → Booking
    whether they accept bookings
    which services they provide
    which locations they work at

Team → Person → Availability
    recurring working hours
    time off
    extra availability
    blocked time

Calendar → Edit availability
    self-service access to the current user's availability
```

A person may work at multiple locations and have different availability per location.

# 10. Booking page

## Purpose

Booking page is the customer-facing representation of the business.

It deserves primary navigation for owner/admin because it is something they publish, preview, and share.

For MVP, present it as a singular concept:

```text
Booking page
```

Even if the underlying schema supports multiple booking pages.

Only introduce plural "Booking pages" once users can actually create and manage multiple pages.

---

## 10.1 Booking page root

Suggested structure:

```text
Booking page

Live

yourapp.com/acme

[Copy link] [Open page]

Appearance
Services
Staff
Location
Customer flow
Questions
```

A desktop preview may appear alongside settings where useful.

---

## 10.2 Booking page sections

### Appearance

- title
- description
- logo
- success message

### Services

- which services appear
- ordering

### Staff

- which staff appear
- whether customers choose staff

### Location

- default location
- whether customers choose a location

### Customer flow

- require service selection
- allow staff selection
- allow location selection

### Questions

Booking questions should preferably be managed from the relevant Service where possible.

The Booking page may surface a summary or link to them rather than creating a second editing model.

---

# 11. Settings

## Purpose

There is one Settings area.

It contains both:

- personal settings
- business settings

Do not create separate concepts such as "Account settings" and "Business settings" in the main IA.

Role-based visibility determines which tabs a user sees.

---

## 11.1 Member Settings

```text
Settings

Profile
```

Optionally include other truly personal preferences later.

---

## 11.2 Admin Settings

```text
Settings

Profile
Business
Locations
Booking
Communications
```

---

## 11.3 Owner Settings

```text
Settings

Profile
Business
Locations
Booking
Communications
Plan & billing
```

Owner uses the same operational and business configuration areas as Admin, with one additional owner-only area for the SaaS subscription.

---

# 12. Settings → Profile

Profile is the current user's profile.

Suggested fields:

```text
Profile

Photo
Name
Email
Phone
Language

Security
Password
Active sessions
```

If customer-facing staff information such as bio belongs to the current user, it may appear here with clear helper text:

```text
Bio
Shown to customers on your booking page.
```

The UI should not expose a distinction between User and StaffMember identities.

If the backend stores profile information in multiple records, the product should still present one coherent profile.

---

# 13. Settings → Business

Business-level defaults:

```text
Business

Business name
Logo
Timezone
Country
Currency
Week starts on
```

Only settings that affect the business as a whole belong here.

Personal display preferences should not be treated as business policy.

Examples of personal preferences that should remain personal if introduced:

- default calendar view
- calendar start hour
- calendar end hour
- whether weekends are shown

These can initially be stored locally if the MVP does not require server persistence.

---

## 13.1 Holidays & closures

Business-wide closures belong under **Settings → Business** because they affect the whole business.

Suggested structure:

```text
Business

General
Holidays & closures
```

Examples:

```text
Christmas Day
Dec 25
Closed all day

New Year's Day
Jan 1
Closed all day
```

Use scope consistently:

```text
Business
  → holidays and closures affecting everyone

Location
  → hours and closures affecting one location

Team member
  → availability and time off affecting one person
```

Business-wide and location-specific closures should also be visible in **Calendar** so users can see their effect in context. Calendar is the operational display surface, while Settings is where admins configure them.

# 14. Settings → Locations

Locations should live inside Settings rather than primary navigation for MVP.

Root:

```text
Locations                                     + Add location

Helsinki
Mannerheimintie 10
Active

Espoo
...
```

Location detail may contain:

```text
General
Availability
Services
Team
Resources
```

Only include the sections needed for MVP.

General location information:

- name
- address
- contact information
- timezone
- booking instructions
- active/inactive

Location-specific scheduling configuration may include:

- regular opening hours
- location-specific closures
- shortened opening days
- special one-off opening hours

Example:

```text
Helsinki location

Regular hours
Mon–Fri 09:00–18:00

Closures
Dec 6     Closed
Dec 24    Closes at 14:00
```

---

# 15. Settings → Booking

This contains business-wide booking defaults.

Suggested structure:

```text
Booking

Online booking
[On]

Booking window
Minimum booking notice        2 hours
Maximum advance booking       90 days

Changes
Customers can cancel          On
Cancellation notice           24 hours

Customers can reschedule      On
Reschedule notice             12 hours

Confirmation
● Confirm automatically
○ Require confirmation

Customer information
☑ Require email
☐ Require phone
```

Service-level settings may override relevant business defaults.

The mental model should be:

```text
Business defaults
        ↓
Service-specific overrides
```

---

# 16. Settings → Communications

Communications contains customer-facing appointment messaging.

Suggested MVP:

```text
Communications

Booking confirmation          On
Cancellation email            On
Reschedule email              On
Appointment reminder          On
Reminder timing               24 hours before

Sender name
Reply-to email
```

Do not expose notification delivery infrastructure or template records as separate concepts.

If template editing is included, clicking a communication type opens its message editor.

---

# 17. Settings → Plan & billing

Owner only.

This area is for the business's subscription to the SaaS. It is separate from any customer payment functionality.

Suggested MVP:

```text
Plan & billing

Current plan
Billing interval
Subscription status
Renewal date
Seats

[Manage billing]
```

Depending on what the billing provider exposes, this area may also link to:

- payment method management
- invoices and receipts
- plan changes
- subscription cancellation

Do not expose **Plan & billing** to Admin or Member.

Customer payments are outside the MVP and should not be mixed with SaaS subscription billing.

# 18. Role model

The role model should remain simple.

```text
Member = operate
Admin  = configure
Owner  = configure + manage SaaS billing
```

Bookability is independent of role.

---

# 19. Role permissions

| Area | Member | Admin | Owner |
|---|---|---|---|
| Calendar | Yes | Yes | Yes |
| Create appointments | Yes | Yes | Yes |
| Update appointment status | Yes | Yes | Yes |
| Customers | Yes | Yes | Yes |
| Own availability | If bookable | If bookable | If bookable |
| Other staff availability | No | Yes | Yes |
| Services configuration | No | Yes | Yes |
| Team administration | No | Yes | Yes |
| Add/invite people | No | Yes | Yes |
| Change Member/Admin roles | No | Yes | Yes |
| Booking page | No | Yes | Yes |
| Business settings | No | Yes | Yes |
| Locations | No | Yes | Yes |
| Booking settings | No | Yes | Yes |
| Communications | No | Yes | Yes |
| Plan & billing | No | No | Yes |

Exact appointment/customer permissions may be tightened later if real product needs require it.

Avoid fine-grained permission design in MVP unless there is a validated requirement.

---

# 20. Visibility rules

Use progressive disclosure aggressively.

Do not show features that are irrelevant to the current business.

Examples:

### Waitlist

Do not show Waitlist globally by default.

If waitlisting is included and enabled, expose it contextually, for example:

```text
Calendar
  Calendar | Agenda | Waitlist
```

Only show Waitlist when:

- at least one service has waitlist enabled, or
- at least one waitlist entry exists

### Resources

If resources are not essential for initial customers, hide them entirely.

If required:

```text
Settings → Locations → Resources
```

or:

```text
Settings → Resources
```

depending on how strongly they are tied to location in actual usage.

### Advanced infrastructure

Do not expose in MVP navigation:

- webhook endpoints
- webhook deliveries
- audit log
- external calendar synchronization
- payment/refund infrastructure
- integration records

---

# 21. MVP route map

Suggested route structure:

```text
/
  → redirect to /calendar

/calendar
/customers
/customers/:customerId

/services
/services/:serviceId

/team
/team/:staffMemberId

/booking-page

/settings/profile
/settings/business
/settings/locations
/settings/locations/:locationId
/settings/booking
/settings/communications
/settings/billing
```

Possible appointment deep-link route:

```text
/calendar?appointment=:appointmentId
```

This keeps Calendar as the appointment context while still supporting direct links.

Alternative:

```text
/appointments/:appointmentId
```

may exist technically for deep linking, but it should still render the appointment experience in Calendar context rather than become a primary navigation destination.

---

# 22. Navigation behavior by role

## Member

```text
Calendar
Customers

Settings
  Profile
```

If the member is bookable:

- Calendar defaults to their schedule
- Edit availability is shown

If not bookable:

- availability controls are hidden

---

## Admin

```text
Calendar
Customers

Services
Team
Booking page

Settings
  Profile
  Business
  Locations
  Booking
  Communications
```

If bookable:

- Calendar defaults to their own schedule unless another preference is remembered
- Edit availability is available directly from Calendar

---

## Owner

```text
Calendar
Customers

Services
Team
Booking page

Settings
  Profile
  Business
  Locations
  Booking
  Communications
  Plan & billing
```

Owner otherwise uses the same product as Admin. The only additional MVP settings area is SaaS subscription billing.

Do not create a separate owner experience.

---

# 23. Page ownership rules

Use these rules when deciding where future functionality belongs.

## Put it in Calendar when it is about:

- time
- appointments
- schedule
- availability
- time off
- blocked time

## Put it in Customers when it is about:

- customer identity
- customer history
- notes
- tags
- upcoming/past bookings

## Put it in Services when it is about:

- what can be booked
- duration
- service rules
- service questions
- service assignment
- service availability constraints

## Put it in Team when it is about:

- another person's role
- whether someone accepts bookings
- services someone provides
- locations where someone works
- another person's availability
- another person's app access
- adding/removing people

## Put it in Booking page when it is about:

- the public booking experience
- what customers can see/select
- booking page content
- publishing and sharing

## Put it in Settings when it is about:

- the current user's profile
- organization-wide defaults
- locations
- booking policy
- communications
- business governance

---

# 24. What should not become navigation

The following schema concepts should remain embedded within higher-level product concepts:

```text
AppointmentSeries
AppointmentService
AppointmentAttendee
AppointmentEvent
BookingAnswer

ServiceCategory
StaffService
StaffLocation
ServiceLocation

CustomerNote
CustomerTag
CustomerTagAssignment

AvailabilityRule
AvailabilityOverride
BlockedTime

BookingQuestion
BookingAnswer

BookingPageService
BookingPageStaff

NotificationTemplate
Notification
```

These are valuable domain models, but they are not automatically valuable navigation destinations.

---

# 25. Onboarding

The goal of onboarding is:

> Get the business to a state where a customer can successfully book an appointment.

Suggested checklist:

```text
Welcome

Get ready to accept bookings

1. Add business details
2. Create your first service
3. Set your availability
4. Add a location if needed
5. Review your booking page
6. Publish and copy your booking link
```

The checklist should not block access to the rest of the app.

The user should be able to explore freely and return to incomplete setup later.

---

# 26. Empty states

Empty states should teach the product through the user's goal, not through the database object.

## Calendar

```text
No appointments yet

Once customers book, their appointments will appear here.

[Create appointment]
```

If availability is missing:

```text
Set your availability before accepting bookings.

[Set availability]
```

## Services

```text
Create your first service

Services are what customers can book.

[Create service]
```

## Team

```text
You're the only person here

Add teammates or bookable staff when you need them.

[Add person]
```

## Booking page

```text
Your booking page is almost ready

Add a service and availability before publishing.
```

---

# 27. UX principles

## 27.1 Model user work, not database structure

A database model does not automatically deserve:

- a page
- a route
- a tab
- a navigation item

Expose concepts only when users recognize and need them.

---

## 27.2 Keep self-management close to the work

A user should not need to go:

```text
Team → Find myself → Availability
```

to change their own working hours.

Instead:

```text
Calendar → Edit availability
```

---

## 27.3 Keep administrative views administrative

Team exists because administrators need to manage the roster.

It should not become the default route for personal scheduling actions.

For a bookable owner/admin/member:

```text
Calendar → Edit availability
```

is the normal way to manage when they work.

Administrative booking configuration stays under:

```text
Team → Person → Booking
```

including:

- accepting bookings
- services
- work locations

---

## 27.4 Prefer contextual actions over new destinations

Examples:

- appointment details → Calendar drawer
- customer notes → Customer
- staff availability → Team member or own Calendar
- booking questions → Service
- booking page staff selection → Booking page
- location configuration → Settings

---

## 27.5 Use progressive disclosure

Start simple.

Only reveal:

- waitlists when enabled
- resources when used
- advanced service options when needed
- owner governance to the owner
- administrative pages to admin/owner

---

## 27.6 Avoid duplicate mental models

Do not create:

```text
Profile
Account settings
Personal settings
My booking profile
Staff profile
```

as five different user-facing concepts.

For MVP:

```text
Settings → Profile
```

is the user's profile.

Calendar owns personal scheduling.

Team owns administrative people management.

---

# 28. Final MVP IA

```text
Business

├── Calendar
│   ├── Day
│   ├── Week
│   ├── Agenda
│   ├── Appointment drawer
│   └── Availability
│
├── Customers
│   ├── Customer list
│   └── Customer
│       ├── Overview
│       ├── Appointments
│       └── Notes
│
├── Services                    Admin / Owner
│   ├── Service list
│   └── Service
│       ├── General
│       ├── Staff & locations
│       ├── Booking
│       ├── Customer questions
│       └── Advanced
│
├── Team                        Admin / Owner
│   ├── Team list
│   └── Team member
│       ├── Profile
│       ├── Booking
│       │   ├── Accepting bookings
│       │   ├── Services
│       │   └── Locations
│       ├── Availability
│       │   ├── Weekly hours
│       │   ├── Time off
│       │   └── Extra availability
│       └── Access
│
├── Booking page                Admin / Owner
│   ├── Appearance
│   ├── Services
│   ├── Staff
│   ├── Location
│   └── Customer flow
│
└── Settings
    ├── Profile                 Everyone
    ├── Business                Admin / Owner
    ├── Locations               Admin / Owner
    ├── Booking                 Admin / Owner
    ├── Communications          Admin / Owner
    └── Plan & billing          Owner
```

---

# 29. MVP exclusions from IA

Do not create top-level navigation for:

- Dashboard
- Appointments
- Availability
- Locations
- Categories
- Booking questions
- Customer notes
- Customer tags
- Waitlist
- Resources unless essential
- Payments
- Refunds
- Integrations
- Notifications
- Webhooks
- Audit logs

These either:

- belong inside another concept,
- belong inside Settings,
- appear contextually,
- or are outside the MVP.

---

# 30. North-star test for future IA decisions

Before adding a new navigation item, ask:

1. Is this a concept users actually think about independently?
2. Do users need to navigate to it frequently?
3. Is it part of an existing object or workflow instead?
4. Is it configuration rather than daily work?
5. Is it relevant to most users or only a special case?
6. Can it appear contextually only when needed?

A feature should become primary navigation only when the answer clearly supports it.

The MVP should continue to feel like:

```text
Calendar
Customers
Services
Team
Booking page
Settings
```

even as the underlying product grows substantially.
