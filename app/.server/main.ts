import { createTRPCRouter } from "./trpc"
import { billingRouter } from "./routers/billing"
import { exampleRouter } from "./routers/example"
import { onboardingRouter } from "./routers/onboarding"
import { organizationsRouter } from "./routers/organizations"
import { profileRouter } from "./routers/profile"
import { teamRouter } from "./routers/team"

export const appRouter = createTRPCRouter({
  billing: billingRouter,
  example: exampleRouter,
  onboarding: onboardingRouter,
  organizations: organizationsRouter,
  profile: profileRouter,
  team: teamRouter,
})

export type AppRouter = typeof appRouter
