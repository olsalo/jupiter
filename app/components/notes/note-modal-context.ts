import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "~/.server/main"

export type NoteModalContext = {
  note: inferRouterOutputs<AppRouter>["example"]["get"] | null
  loading: boolean
  titleId: string
  descriptionId: string
}
