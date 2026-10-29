# Public Booking Page IA

## 1. Purpose

This document defines the information architecture and UX for the public customer booking experience.

The goal is to make booking feel fast, obvious, and trustworthy even when the business has:

- multiple services
- multiple locations
- multiple staff members
- staff-specific service assignments
- staff-specific locations
- location-specific availability
- service-specific booking rules
- optional booking questions
- different appointment durations
- business and location closures

The public booking experience should not expose the complexity of the underlying scheduling model.

The customer should feel like they are answering a small sequence of natural questions:

```text
What do you want?
Where?
With whom?
When?
Who are you?
Confirm
```

Not every business needs every step. The flow must remove unnecessary steps automatically.

---

# 2. Primary UX principle

The public booking page should progressively narrow valid choices.

Each answer should reduce the next set of options.

```text
Service
   ↓
valid locations
   ↓
valid staff
   ↓
available dates and times
```

Or, when location is irrelevant:

```text
Service
   ↓
valid staff
   ↓
available dates and times
```

The customer should never be allowed to choose an invalid combination and only discover the problem at the end.

Examples:

- do not show a location where the selected service is unavailable
- do not show a staff member who does not provide the selected service
- do not show a time when the selected staff member is unavailable
- do not show dates outside booking rules
- do not show times during business/location closures

---

# 3. Public route structure

Recommended public routes:

```text
/book/:businessSlug
/book/:businessSlug/confirmation/:bookingCode
```

If multiple public booking pages are exposed later:

```text
/book/:businessSlug/:bookingPageSlug
```

For MVP, one public booking page per business should feel like the default.

The customer should not need to understand the concept of "booking pages".

---

# 4. Overall booking flow

Default flow:

```text
Booking page
    ↓
Service
    ↓
Location if needed
    ↓
Staff if needed
    ↓
Date & time
    ↓
Customer details
    ↓
Booking questions if any
    ↓
Review
    ↓
Confirmation
```

However, the UI should collapse unnecessary steps.

### One service

Skip service selection.

### One valid location

Select it automatically.

### One valid staff member

Select them automatically.

### Staff selection disabled

Use:

```text
Any available staff
```

without asking the customer to choose.

### Online service

Do not ask for a physical location unless the product has a meaningful location concept for that service.

The ideal customer experience may therefore be as short as:

```text
Choose time
→ Your details
→ Confirm
```

---

# 5. Booking page landing state

The landing page should immediately answer:

- whose booking page is this?
- what can I book?
- what happens next?

Suggested structure:

```text
[Logo]

Acme Salon

Book an appointment

Choose a service

Haircut
60 min · €65
Short description

Hair coloring
120 min · €140
Short description

Consultation
30 min
Short description
```

The page should not begin with:

- account creation
- customer login
- a generic calendar
- staff selection
- a wall of business information

The first decision should usually be **service** because it determines most downstream availability.

---

# 6. Persistent booking context

As the customer progresses, keep the current selections visible.

Desktop:

```text
Book an appointment

Service        Haircut
Location       Helsinki
Staff          Jane
Date           Tue 27 Oct
Time           14:00

[Change]
```

Mobile:

```text
Haircut
Helsinki · Jane
Tue 27 Oct · 14:00
```

This summary should be compact and editable.

Do not make customers use the browser Back button to change previous selections.

Each selected item should have an obvious `Change` action.

Changing an upstream answer should invalidate downstream answers when necessary.

Example:

```text
Haircut
Jane
14:00
```

If the customer changes service to `Consultation` and Jane does not provide it:

- clear Jane
- clear the selected time
- explain that availability has been updated

Do not silently preserve invalid state.

---

# 7. Progress indication

Use a lightweight progress indicator.

For example:

```text
Service  >  Time  >  Details  >  Confirm
```

Do not mechanically show every possible internal step.

If location and staff selection are required, they can appear within the booking-selection stage rather than making the experience feel like a seven-step checkout.

Recommended conceptual progress:

```text
1. Appointment
2. Your details
3. Confirm
```

Inside **Appointment**, the customer chooses:

- service
- location when needed
- staff when needed
- date
- time

This keeps the overall experience feeling short.

---

# 8. Service selection

## Purpose

Answer:

> What would you like to book?

Service cards should show enough information to make a decision.

Recommended:

```text
Haircut

60 min
€65

Classic haircut and finish.

[Select]
```

Potential fields:

- service name
- short description
- duration
- price if applicable
- image only when genuinely useful
- delivery type when important

Avoid showing operational details such as:

- buffers
- booking notice rules
- internal categories
- resource requirements
- staff assignments

## 8.1 Service categories

If the business has many services, group them naturally:

```text
Hair
  Haircut
  Hair coloring

Consultations
  Initial consultation
  Follow-up consultation
```

Categories are visual organization, not a separate booking step.

For larger catalogs, add search, but do not add search for a small list.

## 8.2 Service selection behavior

Selecting a service should immediately constrain:

- locations
- staff
- available dates
- available times

If the service is available from exactly one valid staff member and one location, those values should be automatically selected.

---

# 9. Location selection

Only show this step when location is a meaningful customer choice.

Question:

> Where would you like your appointment?

Suggested cards:

```text
Helsinki

Mannerheimintie 10
00100 Helsinki

[Select]
```

Do not show:

- inactive locations
- locations where the selected service is unavailable
- locations where no eligible staff can provide the selected service

## 9.1 One location

If only one valid location remains, select it automatically.

It can still appear in the booking summary.

Do not force a confirmation click for a non-choice.

## 9.2 Online or phone services

For online services, `Online appointment` should usually replace the location selection entirely.

For phone services, `Phone appointment` may similarly avoid a location step.

For flexible services, only present meaningful customer choices.

---

# 10. Staff selection

The customer should only choose staff when that decision matters.

Question:

> Who would you like to book with?

Recommended first option:

```text
Any available
Get the earliest available time
```

Then individual staff:

```text
Jane

Senior stylist
Short bio

[Select]
```

This is preferable to forcing customers to understand the team before they have seen availability.

## 10.1 Any available

`Any available` should be the default when staff selection is enabled unless the business has a strong reason otherwise.

This gives customers:

- more availability
- faster booking
- less decision fatigue

When selected, time results can show the assigned staff member or staff can be assigned automatically after selecting the time.

The customer should know who they are booking before final confirmation.

## 10.2 Staff cards

Show only customer-relevant information:

- name
- photo
- short bio/title if useful

Do not show:

- role such as Admin or Owner
- app access
- internal permissions
- private contact information
- internal availability configuration

## 10.3 Staff filtering

Only show staff who:

- accept bookings
- provide the selected service
- work at the selected location when applicable

Staff with no availability in the currently visible date range may remain selectable if future availability exists, but avoid presenting permanently invalid choices.

---

# 11. Date and time selection

This is the most important interaction in the public booking experience.

The customer should see actual available times, not configure a date/time and later discover it is unavailable.

Recommended desktop structure:

```text
Choose a time

October 2026

Mon 26   Tue 27   Wed 28   Thu 29   Fri 30
          ●         ●         ●         ●

Tue 27 October

Morning
09:00   09:30   10:30

Afternoon
13:00   14:00   15:30

Evening
17:00
```

Mobile:

```text
Choose a time

‹  Tue 27 Oct  ›

Morning
[09:00] [09:30]
[10:30]

Afternoon
[13:00] [14:00]
[15:30]
```

---

# 12. Date picker behavior

Do not make unavailable dates look selectable.

Use clear states:

```text
available
limited availability
unavailable
selected
today
```

Dates outside allowed booking ranges should be disabled.

The availability calculation must consider:

- business closures
- location closures
- staff working hours
- staff time off
- extra availability
- blocked time
- existing appointments
- service duration
- buffers
- minimum booking notice
- maximum advance booking

The customer should only see valid start times.

---

# 13. Finding the next available time

A key UX feature should be:

```text
Next available
```

If the selected date has no times:

```text
No availability on Tue 27 Oct.

Next available:
Wed 28 Oct at 10:30

[View Wednesday]
```

Do not leave the customer at a dead end.

If there is no availability in the current week:

```text
No times available this week.

[Show next available]
```

The system should help move the customer forward.

---

# 14. Time grouping

Group time slots into understandable dayparts:

```text
Morning
Afternoon
Evening
```

Avoid a massive dropdown containing every interval.

Only show actual available starts.

---

# 15. Any available scheduling

If the customer selected `Any available`, time slots should represent availability across eligible staff.

Example:

```text
10:00
Jane

10:30
Olli

11:00
Jane
```

If staff identity is not important during time selection, the UI can show only times and reveal the assigned person after selection.

However, the assigned person should be visible before final confirmation.

---

# 16. Selected appointment summary

After time selection, show a clear summary:

```text
Your appointment

Haircut
Tue 27 Oct · 14:00–15:00
Jane
Helsinki

[Change]
```

This summary should remain visible throughout customer details and confirmation.

---

# 17. Customer details

Keep required information minimal.

Recommended base form:

```text
Your details

First name *
Last name

Email *
Phone
```

Only require phone when the business requires it.

Do not collect fields simply because the database supports them.

Avoid asking for:

- address
- company
- job title
- date of birth

unless the specific business workflow genuinely needs them.

---

# 18. Existing customer behavior

Do not require account login.

If the email or phone matches an existing customer record, handle that internally.

The public experience remains:

```text
Enter your details
```

not:

```text
An account already exists. Please log in.
```

Account creation should not become a prerequisite for booking.

---

# 19. Booking questions

Service-specific questions appear after basic customer details.

Example:

```text
A few questions

Do you have any allergies?
[                                      ]

Preferred style
[ Short ]
[ Medium ]
[ Long ]
```

Only show questions relevant to the selected service.

Required questions should be clearly marked.

Do not mix business-internal questions with customer-facing booking questions.

---

# 20. Customer message

If the business accepts a customer message, present it explicitly:

```text
Anything we should know?
Optional

[                                      ]
```

Avoid ambiguous labels like `Notes` because customers may not know who sees them.

---

# 21. Review step

Before final booking, show one clear review screen.

```text
Review your appointment

Haircut
60 min

Tue 27 Oct
14:00–15:00

Jane

Helsinki
Mannerheimintie 10

Your details
Sarah Johnson
sarah@example.com
+358...

[Edit]

Cancellation
Free cancellation until Mon 26 Oct at 14:00

[Confirm booking]
```

The customer should not need to navigate backward to verify what they selected.

---

# 22. Booking policy disclosure

Show policies at the moment they matter.

Examples:

```text
You can cancel until 24 hours before your appointment.
```

```text
You can reschedule until 12 hours before your appointment.
```

Avoid placing important cancellation rules only in a footer or terms page.

Keep policy text concise.

---

# 23. Confirmation behavior

After confirmation:

```text
You're booked

Haircut
Tue 27 Oct · 14:00–15:00
Jane
Helsinki

Confirmation sent to
sarah@example.com

[Add to calendar]
[Manage booking]
```

Also show the booking reference if useful.

Do not show an internal database ID.

---

# 24. Manage booking

The confirmation page should provide a clear path to customer self-service.

Recommended route:

```text
/book/manage/:bookingCode
```

or a secure tokenized equivalent.

Customer actions may include:

```text
View appointment
Reschedule
Cancel
```

Only show actions allowed by business rules and current timing.

If the deadline has passed:

```text
Online cancellation is no longer available.
Please contact Acme Salon.
```

---

# 25. Rescheduling

Rescheduling should reuse the existing booking time-selection flow.

```text
Current appointment

Tue 27 Oct · 14:00
Haircut · Jane · Helsinki

Choose a new time
```

Keep service, location, and staff selected when still valid.

Do not make the customer rebuild the entire appointment unnecessarily.

After selection:

```text
Move appointment to

Thu 29 Oct · 10:30

[Confirm reschedule]
```

---

# 26. Cancellation

Cancellation should be simple and deliberate.

```text
Cancel appointment?

Haircut
Tue 27 Oct · 14:00
Jane

Reason
Optional
[                                      ]

[Keep appointment] [Cancel appointment]
```

After cancellation:

```text
Appointment cancelled

A cancellation confirmation has been sent to
sarah@example.com
```

---

# 27. Waitlist

Waitlist should only appear when:

- the selected service allows waitlisting
- no suitable time is available

Do not make Waitlist part of the default booking flow.

Example:

```text
No suitable times available.

[Show next available]

or

Join the waitlist
We'll contact you if a matching time opens up.
```

Waitlist should reuse already selected context and should not ask the customer to re-enter information already provided.

---

# 28. Booking page header

Keep the public header minimal.

Recommended:

```text
[Logo] Acme Salon
```

Optional:

```text
Contact
```

Avoid normal SaaS navigation.

The customer is there to complete one task.

Do not show:

- dashboard links
- product marketing navigation
- admin login prominently
- unrelated business management features

---

# 29. Business information

Customer-relevant information can appear contextually.

### Location step

Show:

- address
- booking instructions

### Confirmation

Show:

- address
- relevant arrival instructions
- contact details

### Footer

May show:

- business contact information
- privacy policy
- terms if required

Do not front-load the booking page with a large business profile.

---

# 30. Mobile-first behavior

Assume a large share of customers book from mobile.

The experience should be designed vertically first.

Use:

- large tap targets
- sticky primary action when useful
- one main decision per screen
- native-feeling date interaction
- minimal text entry
- no horizontal tables
- no tiny week calendar

Recommended mobile sequence:

```text
Service
↓
Location / staff if needed
↓
Date
↓
Time
↓
Details
↓
Confirm
```

Do not reproduce the admin Calendar UI on mobile.

Public booking needs a dedicated customer flow.

---

# 31. Desktop behavior

Desktop may use a two-column layout.

Example:

```text
┌─────────────────────────────┬──────────────────────┐
│                             │ Your appointment     │
│ Choose a time               │                      │
│                             │ Haircut              │
│ [calendar]                  │ Jane                 │
│                             │ Helsinki             │
│ Morning                     │                      │
│ 09:00  10:00  11:30        │ 60 min               │
│                             │                      │
│ Afternoon                   │                      │
│ 13:00  14:00  16:00        │                      │
└─────────────────────────────┴──────────────────────┘
```

The right summary should not become an additional navigation area.

---

# 32. Back navigation

Always allow the customer to go backward without losing valid answers.

If they go back from Details to Time, all choices remain.

If they go back and change Location, only downstream state that becomes invalid should reset.

---

# 33. Loading states

Availability may require server computation.

Do not freeze the whole page.

Use contextual states:

```text
Finding available times...
```

Skeleton only the availability region.

Keep selected booking context visible.

Avoid spinners with no explanation.

---

# 34. Error states

Errors should tell the customer how to recover.

Bad:

```text
Something went wrong.
```

Better:

```text
That time is no longer available.

Someone booked it while you were completing the form.

[Choose another time]
```

Other useful cases:

```text
Booking is temporarily unavailable.
Please try again.
```

```text
Online booking is currently disabled.
Contact Acme Salon at ...
```

```text
This service is no longer available.
[Choose another service]
```

---

# 35. Concurrent booking conflicts

Availability must be revalidated during confirmation.

A displayed slot is not guaranteed until the booking is successfully created.

If another customer takes the slot:

```text
That time was just booked.

Here are the next available times:

14:30
15:00
16:30
```

Do not discard the customer's entered contact information or booking questions.

Only require them to choose a new time.

---

# 36. Form validation

Validate inline.

Examples:

```text
Enter your email address.
```

```text
Enter a valid phone number.
```

```text
Choose a time to continue.
```

Do not wait until final submission to show a page full of validation errors.

Focus the first invalid field.

---

# 37. Accessibility

The booking flow should support:

- keyboard navigation
- visible focus states
- screen-reader labels
- semantic headings
- sufficient contrast
- error messages associated with fields
- status announcements when availability updates

Do not communicate availability or status by color alone.

Time slots must be proper interactive controls, not clickable text containers.

---

# 38. Localization

Public booking should respect:

- booking page locale
- customer/browser locale when appropriate
- business timezone
- location timezone when applicable
- local date formatting
- local time formatting

Always make timezone clear when ambiguity exists, particularly for online appointments.

Do not force timezone terminology into ordinary local bookings.

---

# 39. Business closures and holidays

Public availability should automatically respect:

```text
Business holiday
        ↓
all locations unavailable

Location closure
        ↓
that location unavailable

Staff time off
        ↓
that staff member unavailable
```

Customers should not need to understand why a date is unavailable unless explanation is helpful.

Example:

```text
Closed
Christmas Day
```

may be useful.

Most ordinary unavailable dates can simply be disabled.

---

# 40. Staff availability and locations

The public booking engine must respect both:

```text
Team → Person → Booking
    accepting bookings
    services
    locations
```

and:

```text
Team → Person → Availability
    weekly hours
    time off
    extra availability
```

A staff member should only appear in public booking when they:

- accept bookings
- provide the selected service
- work at the selected location if applicable

Their time slots should then be calculated from availability.

---

# 41. Service-specific rules

Service configuration may affect public booking through:

- duration
- buffers
- booking notice
- maximum booking advance
- cancellation notice
- reschedule notice
- confirmation requirement
- waitlist availability
- capacity

These rules should affect behavior without becoming technical UI.

Example:

Instead of:

```text
Minimum booking notice: 1440 minutes
```

show nothing unless necessary.

If needed:

```text
This service must be booked at least 24 hours in advance.
```

---

# 42. Confirmation state

If appointments auto-confirm:

```text
You're booked
```

If manual confirmation is required:

```text
Request received

We'll confirm your appointment shortly.

Requested:
Tue 27 Oct · 14:00
Haircut · Jane
```

Do not tell the customer they are confirmed when the appointment is actually pending.

The visual and language distinction should be clear.

---

# 43. Appointment capacity

For group services, availability should account for remaining capacity.

If customers choose number of attendees, place it close to service selection:

```text
Participants

[-] 2 [+]
```

Only expose this when the service supports multiple attendees.

Do not show capacity concepts for normal one-to-one appointments.

---

# 44. Booking page configuration mapping

Admin configuration:

```text
Booking page
├── Appearance
├── Services
├── Staff
├── Location
└── Customer flow
```

Public behavior:

```text
Appearance
→ logo, title, description

Services
→ which services can be booked

Staff
→ which staff may appear

Location
→ which locations may appear

Customer flow
→ whether service/staff/location selection is shown
```

The public experience should consume these settings but not expose the configuration model.

---

# 45. IA by customer state

## New visitor

```text
Booking page
→ choose appointment
→ details
→ confirm
```

## Returning through confirmation link

```text
Appointment
→ reschedule
→ cancel
```

## No availability

```text
No times
→ next available
→ optionally waitlist
```

## Booking disabled

```text
Booking unavailable
→ business contact information
```

---

# 46. Recommended public component hierarchy

```text
PublicBookingPage

├── BusinessHeader
├── BookingProgress
├── BookingStep
│
├── AppointmentSelection
│   ├── ServiceSelection
│   ├── LocationSelection
│   ├── StaffSelection
│   └── TimeSelection
│
├── CustomerDetails
├── BookingQuestions
├── BookingReview
├── BookingSummary
└── BookingConfirmation
```

Management flow:

```text
ManageBookingPage

├── AppointmentSummary
├── RescheduleAction
└── CancelAction
```

---

# 47. State model

Conceptual booking state:

```text
service
location
staffPreference
assignedStaff
date
time
customer
answers
```

Changing state should invalidate only dependent values.

Dependency example:

```text
service
├── location
├── staff
└── time

location
├── staff
└── time

staff
└── time
```

Customer details and answers should normally survive time-slot conflicts.

---

# 48. Suggested MVP screens

The MVP only needs these public screens/states:

```text
1. Appointment selection
2. Customer details
3. Review
4. Confirmation
5. Manage booking
6. Reschedule
7. Cancel
```

Appointment selection dynamically contains:

```text
service
location if needed
staff if needed
date
time
```

Avoid turning each small choice into a separate URL unless there is a specific technical or analytics reason.

---

# 49. What not to expose

Do not expose these concepts directly to customers:

```text
StaffMember
AvailabilityRule
AvailabilityOverride
BlockedTime
ServiceLocation
StaffLocation
BookingPageStaff
BookingPageService
AppointmentStatus enum
AppointmentSource
NotificationTemplate
Resource assignment
internal appointment events
```

Translate them into customer concepts:

```text
Staff member
Available time
Location
Service
Appointment
Confirmation
```

---

# 50. Public terminology

Prefer:

```text
Book an appointment
Service
Location
Staff / Team member
Any available
Choose a time
Your details
Review
Confirm booking
Reschedule
Cancel appointment
```

Avoid internal/product terminology such as:

```text
Create appointment
StaffMember
Availability override
Booking record
Appointment source
Pending entity
```

Customer-facing language should describe the customer's task.

---

# 51. Primary success metric

The UX should optimize for:

> A customer who knows what they want can successfully book without needing instructions.

Useful product metrics later:

- booking page → service selected
- service selected → time selected
- time selected → details completed
- confirmation success rate
- abandonment by step
- no-availability rate
- next-available usage
- reschedule success rate

Do not optimize only for raw page views.

---

# 52. Golden path

The ideal flow should feel approximately like this:

```text
Acme Salon

Book an appointment

Haircut
60 min
[Select]

↓

Where?
Helsinki
[Select]

↓

Who?
[Any available]
Jane
Olli

↓

Choose a time

Tue 27 Oct
[10:00] [11:30] [14:00]

↓

Your details

Sarah
sarah@example.com

↓

Review

Haircut
Tue 27 Oct · 14:00
Jane
Helsinki

[Confirm booking]

↓

You're booked

Tue 27 Oct · 14:00
Haircut with Jane

[Manage booking]
```

For a simpler business, the same system should collapse to:

```text
Choose a time
→ Your details
→ Confirm
```

That ability to collapse complexity is central to an excellent booking UX.

---

# 53. Final IA

```text
Public booking

├── Appointment
│   ├── Service
│   ├── Location                 conditional
│   ├── Staff                    conditional
│   └── Date & time
│
├── Your details
│   ├── Contact information
│   └── Booking questions        conditional
│
├── Review
│   ├── Appointment summary
│   ├── Customer details
│   └── Cancellation/reschedule policy
│
├── Confirmation
│   ├── Confirmed or request received
│   ├── Appointment details
│   └── Manage booking
│
└── Manage booking
    ├── View
    ├── Reschedule               when allowed
    └── Cancel                   when allowed
```

---

# 54. North-star UX rules

1. **Ask only questions that affect the booking.**
2. **Never make the customer choose from invalid options.**
3. **Automatically select non-choices.**
4. **Show actual availability, not generic date/time inputs.**
5. **Keep the selected appointment visible.**
6. **Allow customers to change earlier choices without restarting.**
7. **Preserve entered information when a slot becomes unavailable.**
8. **Help customers recover from no availability.**
9. **Do not require an account to book.**
10. **Design mobile-first.**
11. **Keep operational/database terminology out of the public UI.**
12. **Use one availability engine for public and admin booking.**
13. **Show policies where they affect the customer's decision.**
14. **Make confirmation state truthful: confirmed vs awaiting approval.**
15. **Collapse the flow aggressively when there is only one valid choice.**

The public booking page should feel like a guided appointment decision, not a form for creating an appointment record.
