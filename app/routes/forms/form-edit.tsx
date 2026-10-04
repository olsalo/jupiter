import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import type { Route } from "./+types/form-edit"
import { FormEditor } from "~/components/forms/editor/form-editor"
import { Spinner } from "~/components/ui/spinner"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"
import { useTRPC } from "~/lib/trpc/client"

export function clientLoader() {
  return null
}

export const shouldRevalidate = shouldRevalidateAppRoute

export default function FormEdit({ params }: Route.ComponentProps) {
  const { t } = useTranslation("forms")
  const trpc = useTRPC()
  const questions = useQuery(trpc.forms.get.queryOptions({ id: params.id }))
  const loading = questions.isLoading

  return loading ? (
    <div aria-busy={true} className="relative isolate grid min-h-0 flex-1 place-items-center bg-neutral-50 dark:bg-background">
      <Spinner aria-label={t("loading")} className="size-6 text-muted-foreground" />
    </div>
  ) : (
    <FormEditor formId={params.id} key={params.id} />
  )
}
