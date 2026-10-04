import { dehydrate, useMutation, useQuery } from "@tanstack/react-query"
import { TRPCError } from "@trpc/server"
import { data, useSearchParams } from "react-router"
import { useTranslation } from "react-i18next"

import type { Route } from "./+types/form-public"
import { PublicFormNotFoundError } from "~/.server/services/forms/public-form"
import { PublicForm } from "~/components/forms/renderer/public-form"
import { FormScrollArea } from "~/components/forms/form-scroll-area"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { toast } from "~/lib/toast"
import { getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"

export async function loader(args: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(args)
  try {
    const published = await queryClient.fetchQuery(trpc.publicForms.get.queryOptions({ id: args.params.id }))
    return data({ queryClient: dehydrate(queryClient), unavailable: false, notFound: false, appearance: published.snapshot.appearance }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (!(error instanceof TRPCError) || !["NOT_FOUND", "FORBIDDEN"].includes(error.code)) throw error
    const notFound = error instanceof PublicFormNotFoundError
    return data({ queryClient: dehydrate(queryClient), unavailable: true, notFound, appearance: undefined }, { status: error.code === "NOT_FOUND" ? 404 : 403, headers: { "Cache-Control": "no-store" } })
  }
}

export function clientLoader() {
  return null
}

export function headers() {
  return { "Cache-Control": "no-store" }
}

export default function FormPublic({ params, loaderData }: Route.ComponentProps) {
  const { t } = useTranslation("forms")
  const [searchParams] = useSearchParams()
  const trpc = useTRPC()
  const published = useQuery({
    ...trpc.publicForms.get.queryOptions({ id: params.id }),
    enabled: !loaderData?.unavailable,
  })
  const submit = useMutation(trpc.publicForms.submit.mutationOptions({
    onError: (error) => {
      void published.refetch()
      if (!Object.keys(error.data?.zodError?.fieldErrors ?? {}).length) toast.error(t("errors.submit"))
    },
  }))
  const unavailable = loaderData?.unavailable || published.error?.data?.code === "NOT_FOUND" || published.error?.data?.code === "FORBIDDEN"
  const notFound = loaderData?.notFound || (
    published.error?.data?.publicFormNotFound === true
  )

  return (
    <main className="fixed inset-0 overflow-hidden">
      <title>{unavailable ? t(notFound ? "public.notFoundTitle" : "public.unavailableTitle") : published.data?.snapshot.title ?? t("workspace.form")}</title>
      <FormScrollArea appearance={published.data?.snapshot.appearance} className="h-full" showGradient={!unavailable && Boolean(published.data)} syncDocumentTheme={true}>
        {unavailable ? (
          <UnavailableForm notFound={Boolean(notFound)} />
        ) : published.data ? (
          <PublicForm
            initialEmail={searchParams.get("email") ?? ""}
            key={published.data.versionId}
            preview={false}
            snapshot={published.data.snapshot}
            submitFn={(values) => submit.mutateAsync({ id: params.id, versionId: published.data!.versionId, values })}
          />
        ) : published.isLoading ? (
          <div aria-busy={true} className="grid h-full place-items-center">
            <Spinner aria-label={t("loading")} className="size-6 text-muted-foreground" />
          </div>
        ) : (
          <div className="mx-auto max-w-151.75 px-6 pt-8">
            <Alert variant="error">
              <AlertDescription>{t("public.loadError")}</AlertDescription>
              <AlertAction><Button disabled={published.isFetching} onClick={() => { void published.refetch() }} type="button" variant="outline">{t("retry")}</Button></AlertAction>
            </Alert>
          </div>
        )}
      </FormScrollArea>
    </main>
  )
}

function UnavailableForm({ notFound }: { notFound: boolean }) {
  const { t } = useTranslation("forms")
  return (
    <div className="mx-auto max-w-151.75 px-6 pt-8">
      <Alert variant={notFound ? "error" : "info"}>
        <AlertTitle>{t(notFound ? "public.notFoundTitle" : "public.unavailableTitle")}</AlertTitle>
        <AlertDescription>{t(notFound ? "public.notFound" : "public.unavailable")}</AlertDescription>
      </Alert>
    </div>
  )
}

export function ErrorBoundary() {
  const { t } = useTranslation("forms")
  return <main className="mx-auto max-w-151.75 px-6 pt-8"><title>{t("workspace.form")}</title><Alert variant="error"><AlertDescription>{t("public.loadError")}</AlertDescription></Alert></main>
}
