import type { Route } from "./+types/form-responses"
import { FormResponsesView } from "~/components/forms/form-responses-view"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"

export function clientLoader() {
  return null
}

export const shouldRevalidate = shouldRevalidateAppRoute

export default function FormResponses({ params }: Route.ComponentProps) {
  return <FormResponsesView formId={params.id} key={params.id} selectedId={params.responseId ?? null} />
}
