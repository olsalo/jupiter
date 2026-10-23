import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "~/.server/main"

export type BookingPageData =
  inferRouterOutputs<AppRouter>["booking"]["getPage"]
export type BookingSlot =
  inferRouterOutputs<AppRouter>["booking"]["getAvailableSlots"]["days"][number]["slots"][number]
export type BookingResult = inferRouterOutputs<AppRouter>["booking"]["create"]
export type BookingDetails = Pick<
  inferRouterInputs<AppRouter>["booking"]["create"],
  "customer" | "answers" | "notes"
>
export type BookingScope = {
  organizationSlug: string
  bookingPageSlug?: string
}
export type BookingScreen = "service" | "time" | "details" | "review"
export type BookingService = BookingPageData["services"][number]
