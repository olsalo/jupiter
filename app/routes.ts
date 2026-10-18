import { type RouteConfig, index, route } from "@react-router/dev/routes"

export default [
  route("/", "routes/layout.tsx", [
    index("routes/overview.tsx"),
    route("example", "routes/example/example.tsx", [
      route("new", "routes/example/new-note-modal.tsx"),
      route(":noteId", "routes/example/note-modal.tsx", [
        index("routes/example/note-view.tsx"),
        route("edit", "routes/example/note-edit.tsx"),
      ]),
    ]),
    route("calendar", "routes/calendar/calendar.tsx", [
      route("availability", "routes/calendar/availability.tsx"),
      route("block-time", "routes/calendar/block-time.tsx"),
      route("extra-availability", "routes/calendar/extra-availability.tsx"),
      route("new", "routes/calendar/new-appointment.tsx"),
      route(":appointmentId", "routes/calendar/appointment-sheet.tsx", [
        index("routes/calendar/appointment-view.tsx"),
        route("edit", "routes/calendar/appointment-edit.tsx"),
        route("reschedule", "routes/calendar/appointment-reschedule.tsx"),
      ]),
    ]),
    route("customers", "routes/customers/customers.tsx", [
      route("new", "routes/customers/new-customer.tsx"),
      route(":customerId", "routes/customers/customer-sheet.tsx", [
        index("routes/customers/customer-view.tsx"),
        route("edit", "routes/customers/customer-edit.tsx"),
      ]),
    ]),
    route("services", "routes/services/services.tsx", [
      route("new", "routes/services/new-service.tsx"),
      route(":serviceId", "routes/services/service-sheet.tsx", [
        index("routes/services/service-view.tsx"),
        route("edit", "routes/services/service-edit.tsx"),
        route("intake", "routes/services/service-intake.tsx"),
      ]),
    ]),
    route("booking-pages", "routes/booking-pages/booking-pages.tsx", [
      route("new", "routes/booking-pages/new-booking-page.tsx"),
      route(":bookingPageId", "routes/booking-pages/booking-page-sheet.tsx", [
        index("routes/booking-pages/booking-page-view.tsx"),
        route("edit", "routes/booking-pages/booking-page-edit.tsx"),
      ]),
    ]),
    route("team", "routes/team/team.tsx", [
      route("new", "routes/team/new-person.tsx"),
      route(":personId", "routes/team/person-sheet.tsx", [
        index("routes/team/person-view.tsx"),
        route("edit", "routes/team/person-edit.tsx"),
      ]),
    ]),
    route("team-v2", "routes/team-v2/team.tsx", [
      route("new", "routes/team-v2/new-person.tsx"),
      route(":personId", "routes/team-v2/person-detail.tsx", [
        route("", "routes/team-v2/person-view.tsx", [
          route("new", "routes/team-v2/new-view-person.tsx"),
        ]),
        route("edit", "routes/team-v2/person-edit.tsx", [
          route("new", "routes/team-v2/new-edit-person.tsx"),
        ]),
      ]),
    ]),
  ]),
  route("/book/:organizationSlug/:bookingPageSlug?", "routes/booking/public-booking.tsx"),
  route("/booking/:bookingCode", "routes/booking/booking-layout.tsx", [
    index("routes/booking/booking-details.tsx"),
    route("cancel", "routes/booking/cancel-booking.tsx"),
    route("reschedule", "routes/booking/reschedule-booking.tsx"),
  ]),
  route("/auth", "routes/auth.tsx"),
  route("/invite/:invitationId", "routes/invite.tsx"),
  route("/onboarding", "routes/onboarding/onboarding.tsx", [
    route("business", "routes/onboarding/business.tsx"),
    route("subscription", "routes/onboarding/subscription.tsx"),
  ]),
  route("api/locale", "routes/api/locale.ts"),
  route("api/format-preference", "routes/api/format-preference.ts"),
  route("api/theme", "routes/api/theme.ts"),
  route("api/auth/*", "routes/api/auth.ts"),
  route("api/trpc/*", "routes/api/trpc.ts"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig
