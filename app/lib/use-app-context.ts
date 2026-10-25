import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import type { loader as workspaceLoader } from "~/routes/layout"

export function useAppContext() {
  const root = useRouteLoaderData<typeof rootLoader>("root")
  // Workspace data is available only when its authenticated layout is matched
  const workspace = useRouteLoaderData<typeof workspaceLoader>("routes/layout")

  return { ...root, ...workspace }
}
