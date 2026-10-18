import { staffRouter } from "./routers/staff"
import { serviceRouter } from "./routers/services"
import { locationRouter } from "./routers/locations"
import { customerRouter } from "./routers/customers"
import { bookingRouter } from "./routers/booking"
import { availabilityRouter } from "./routers/availability"
import { appointmentRouter } from "./routers/appointments"
import { createTRPCRouter } from "./trpc"
import { billingRouter } from "./routers/billing"
import { exampleRouter } from "./routers/example"
import { onboardingRouter } from "./routers/onboarding"
import { organizationsRouter } from "./routers/organizations"
import { profileRouter } from "./routers/profile"
import { teamRouter } from "./routers/team"

export const appRouter = createTRPCRouter({
  staff: staffRouter,
  service: serviceRouter,
  location: locationRouter,
  customer: customerRouter,
  booking: bookingRouter,
  availability: availabilityRouter,
  appointment: appointmentRouter,
  billing: billingRouter,
  example: exampleRouter,
  onboarding: onboardingRouter,
  organizations: organizationsRouter,
  profile: profileRouter,
  team: teamRouter,
})

export type AppRouter = typeof appRouter
