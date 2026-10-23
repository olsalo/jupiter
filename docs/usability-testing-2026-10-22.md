# Jupiter usability and booking verification — 22 October 2026

Tested the current working tree using a fresh account, the local UI, and isolated database integration records. Existing uncommitted work was preserved. Browser checks covered desktop (1440 × 1000) and mobile (390 × 844), English and Finnish, and European/US display formats.

## Walkthrough and saved data

- Signed in with the development email code and completed business details, weekday availability, and holidays
- Verified one business location and owner staff profile, EUR currency, Helsinki timezone, Finnish characters, completed onboarding state, and five saved 09:00–17:00 weekday rules
- Created an in-person service with a 30-minute duration, €45.50 price, 10-minute preparation buffer, 5-minute cleanup buffer, and owner/location assignments
- Saved a custom booking URL, page title, welcome text, and confirmation message and checked the public page
- Checked required-field errors, invalid email validation, Back navigation preserving entered details, review, and public booking submission
- Compared database records with the UI: customer name/email/locale, customer message, staff, location, UTC instants, business timezone, price/currency, duration, and buffer snapshots matched
- Verified the calendar and booking panel show the customer and appointment correctly
- Rescheduled 10:00–10:30 to 11:00–11:30 and checked persisted events and the updated calendar
- Confirmed the old slot became available, the new slot disappeared, and starts overlapping preparation/cleanup buffers disappeared
- Cancelled through the public confirmation dialog and verified the saved cancellation, cancelled display, removal of change/cancel controls, and release of the slot and surrounding buffer times
- Checked mobile layout visually and verified no horizontal page overflow

## Fixes

1. Default business/page offices blocked locationless online and phone services. Remote services now ignore inherited physical locations when they have no location assignment. Explicit location validation and assigned locations remain in effect. The regression covers a public booking with a default office and hidden location selection.
2. Customer messages were saved but absent from the calendar panel, and intake answers were not returned in booking details. The team now sees the submitted message and ordered answers. Boolean answers use the selected language, and false/zero values remain visible. Public booking responses do not expose answers.
3. Single-service booking pages skipped the only screen displaying welcome text. The welcome text now also appears when choosing a time for a single service.
4. Calendar slot components rejected nullable location names during typechecking and could print “null” in accessible labels. Unnamed locations are now handled without that label.
5. Saving booking-page settings produced a Base UI uncontrolled-field warning. The page's text fields now use controlled RVF values and save without console errors.
6. Availability tests and the separate usability dev server use dedicated Vite caches. `VITE_TEST_CACHE_DIR` allows a test server to avoid the existing development server's cache.

## Passing checks

- `npm run typecheck`
- `npm run build` (client, server, appointment worker)
- `tests/appointment-availability.test.ts`
- `tests/appointments.integration.ts`
- `tests/onboarding-flow.integration.ts`
- `tests/onboarding-routing.integration.ts`
- `tests/onboarding-ssr.integration.ts`
- `tests/public-booking-navigation.integration.ts`
- `tests/admin-booking-page.integration.ts`
- `tests/business-schedule.integration.ts`
- `tests/booking-reschedule.integration.ts`
- `tests/booking-settings.integration.ts`
- `tests/business-location.integration.ts`
- `tests/organization-settings.integration.ts`
- `tests/calendar-booking.integration.ts`
- `tests/booking-customer-details.test.ts`
- `git diff --check`

The availability checks cover inherited/custom schedules, blocked time, breaks, exceptions, holidays, buffers, off-grid adjacent starts, notice periods, advance limits, expired holds, daylight-saving changes, simultaneous bookings, and concurrent attempts to reserve one slot. Booking integration checks also cover tenant boundaries, permissions, service snapshots, and public cancellation/rescheduling policies.

## Scope and cleanup

Real email delivery and Stripe checkout were disabled for the browser walkthrough. External email delivery and paid checkout were not tested. Notification queue behavior is covered by the integration checks. Disposable UI and integration records were removed, and the separately started test server was stopped. The pre-existing development server was left running.
