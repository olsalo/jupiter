import { redirect } from "react-router"

import type { Route } from "./+types/form-index"

export function loader({ params }: Route.LoaderArgs) {
  return redirect(`/forms/${params.id}/edit`)
}

export function clientLoader({ params }: Route.ClientLoaderArgs) {
  return redirect(`/forms/${params.id}/edit`)
}
