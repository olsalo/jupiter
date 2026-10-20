import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "~/.server/main"

export type Customer = inferRouterOutputs<AppRouter>["customer"]["get"]
export type CustomerSummary = inferRouterOutputs<AppRouter>["customer"]["list"]["items"][number]
export type CustomerContext = { customer: Customer; close: () => void; onPendingChange: (pending: boolean) => void }
export type CustomerMasterDetailContext = { onCustomerCloseStart: () => void }
export const customerName = (customer: CustomerSummary) => [customer.firstName, customer.lastName].filter(Boolean).join(" ")
