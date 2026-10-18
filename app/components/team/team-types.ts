import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "~/.server/main"

export type TeamPerson = inferRouterOutputs<AppRouter>["team"]["getPerson"]
export type TeamPersonContext = { person: TeamPerson | null; canManage: boolean; close: (destination?: string) => void; onPendingChange: (pending: boolean) => void; sideNavigation?: boolean }
export type TeamMasterDetailContext = { onPersonCloseStart: () => void }
