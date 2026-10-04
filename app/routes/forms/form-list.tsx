import { dehydrate, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Outlet, useNavigate, useRevalidator, useRouteLoaderData } from "react-router"

import type { Route } from "./+types/form-list"
import type { loader as rootLoader } from "~/root"
import { DeleteConfirmationDialog } from "~/components/delete-confirmation-dialog"
import { CreateFormButton } from "~/components/forms/create-form-button"
import { FormActionsMenu } from "~/components/forms/form-actions-menu"
import Icon from "~/components/icons"
import { PageHeader } from "~/components/page-header"
import { ResourceList } from "~/components/resource-list"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { defaultTimeZone, formatRelativeDateTime } from "~/lib/format-preference"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"
import { toast } from "~/lib/toast"
import { getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"

export async function loader(loaderArgs: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(loaderArgs)
  const forms = await queryClient.query(trpc.forms.list.queryOptions()).catch(() => undefined)
  if (forms) queryClient.setQueryData(trpc.forms.count.queryOptions().queryKey, forms.length)

  return {
    queryClient: dehydrate(queryClient),
  }
}

export function clientLoader() {
  return null
}

export const shouldRevalidate = shouldRevalidateAppRoute

export default function Forms() {
  const { i18n, t } = useTranslation("forms")
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [formToDelete, setFormToDelete] = useState<{ id: string; title: string } | null>(null)
  const formsCount = useQuery({ ...trpc.forms.count.queryOptions(), enabled: false })
  const forms = useQuery(trpc.forms.list.queryOptions())
  const showFormsError = forms.isError && !forms.data
  const showRefreshError = forms.isError && Boolean(forms.data)
  const skeletonRowCount = forms.data?.length ?? formsCount.data
  const toggleResponses = useMutation(trpc.forms.settings.update.mutationOptions({
    onSuccess: async (settings, { id }) => {
      queryClient.setQueryData(trpc.forms.settings.get.queryKey({ id }), settings)
      await Promise.all([
        queryClient.invalidateQueries(trpc.forms.list.queryFilter()),
        queryClient.invalidateQueries(trpc.forms.overview.queryFilter()),
        queryClient.invalidateQueries(trpc.forms.get.queryFilter({ id })),
        queryClient.invalidateQueries(trpc.publicForms.get.queryFilter({ id })),
      ])
      toast.success(t(settings.status ? "actions.responsesOpened" : "actions.responsesClosed"))
    },
    onError: (_error, { settings }) => toast.error(t(settings.status ? "errors.openResponses" : "errors.closeResponses")),
  }))
  const duplicateForm = useMutation(trpc.forms.duplicate.mutationOptions({
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(trpc.forms.list.queryFilter()),
        queryClient.invalidateQueries(trpc.forms.count.queryFilter()),
        queryClient.invalidateQueries(trpc.forms.overview.queryFilter()),
      ])
      toast.success(t("actions.duplicated"))
    },
    onError: () => toast.error(t("errors.duplicate")),
  }))
  const deleteForm = useMutation(trpc.forms.delete.mutationOptions({
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(trpc.forms.list.queryFilter()),
        queryClient.invalidateQueries(trpc.forms.count.queryFilter()),
        queryClient.invalidateQueries(trpc.forms.overview.queryFilter()),
      ])
      toast.success(t("actions.deleted"))
    },
    onError: () => toast.error(t("errors.delete")),
  }))
  const dateOptions = useMemo(() => ({
    formatPreference: root?.formatPreference ?? "eu",
    language: i18n.resolvedLanguage === "fi" ? "fi" as const : "en" as const,
    timeZone: root?.organizationTimezone ?? defaultTimeZone,
  }), [root?.formatPreference, root?.organizationTimezone, i18n.resolvedLanguage])
  const items = (forms.data ?? []).map((form) => {
    const title = form.title.replace(/^Untitled(?=_\d+$|$)/, t("untitled"))
    const status = form.status === "PUBLISHED" && !form.enabled ? "CLOSED" : form.status

    return {
      id: form.id,
      icon: "forms" as const,
      title,
      action: <FormActionsMenu
        formTitle={title}
        canCopyLink={form.publishedVersion !== null}
        canChangeResponses={form.status === "PUBLISHED" && form.publishedVersion !== null}
        responsesOpen={form.enabled}
        onToggleResponses={() => toggleResponses.mutate({ id: form.id, settings: { status: !form.enabled } })}
        onCopyLink={() => {
          void navigator.clipboard.writeText(new URL(`/f/${form.id}`, window.location.origin).href)
            .then(() => toast.success(t("workspace.linkCopied")))
            .catch(() => toast.error(t("errors.copyLink")))
        }}
        pending={duplicateForm.isPending || deleteForm.isPending || toggleResponses.isPending}
        onOpen={() => void navigate(`/forms/${form.id}/edit`)}
        onDuplicate={() => duplicateForm.mutate({ id: form.id })}
        onDelete={() => setFormToDelete({ id: form.id, title })}
      />,
      meta: <>
        <Badge key="status" variant={status === "PUBLISHED" ? "success" : "secondary"}>
          {t(`status.${status.toLowerCase()}`)}
        </Badge>
        <span className="text-xs text-muted-foreground">{t("responses", { count: form._count.submissions })}</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {t("edited", { date: formatRelativeDateTime(form.updatedAt, dateOptions) })}
        </span>
      </>,
    }
  })

  return (
    <section className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-6">
      <title>{t("title")}</title>
      <PageHeader
        title={t("title")}
        refreshing={forms.isRefetching}
        description={t("subtitle")}
        className="route-mobile-header max-md:flex-nowrap max-md:items-center max-md:gap-2 max-md:[&_h1]:truncate md:hidden"
        actions={
          <CreateFormButton className="size-9 rounded-xl px-0" iconOnly={true} />
        }
      />
      {showRefreshError ? (
        <Alert variant="warning">
          <AlertTitle>{t("errors.refresh")}</AlertTitle>
          <AlertDescription>{t("errors.stale")}</AlertDescription>
          <AlertAction><Button disabled={forms.isFetching} onClick={() => void forms.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction>
        </Alert>
      ) : null}
      {showFormsError ? (
        <Alert variant="error">
          <AlertTitle>{t("errors.load")}</AlertTitle>
          <AlertDescription>{t("errors.retry")}</AlertDescription>
          <AlertAction><Button disabled={forms.isFetching} onClick={() => void forms.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction>
        </Alert>
      ) : (
        <ResourceList
          emptyDescription={t("empty.description")}
          emptyIcon="forms"
          emptyTitle={t("empty.title")}
          items={items}
          onSelect={(item) => void navigate(`/forms/${item.id}/edit`)}
          loading={forms.isLoading}
          loadingLabel={t("loading")}
          skeletonHasAction={true}
          skeletonRowCount={skeletonRowCount}
        />
      )}
      <DeleteConfirmationDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        description={t("actions.deleteDescription")}
        isPending={deleteForm.isPending}
        onOpenChange={(open) => { if (!open) setFormToDelete(null) }}
        onConfirm={() => { if (formToDelete) deleteForm.mutate({ id: formToDelete.id }) }}
        open={formToDelete !== null}
        title={t("actions.deleteTitle", { title: formToDelete?.title ?? "" })}
      />
      <Outlet />
    </section>
  )
}

export function ErrorBoundary() {
  const { t } = useTranslation("forms")
  const revalidator = useRevalidator()

  return (
    <section className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-6">
      <title>{t("title")}</title>
      <PageHeader title={t("title")} description={t("subtitle")} className="route-mobile-header md:hidden" />
      <Alert variant="error">
        <AlertTitle>{t("errors.load")}</AlertTitle>
        <AlertDescription>{t("errors.retry")}</AlertDescription>
        <AlertAction>
          <Button disabled={revalidator.state !== "idle"} onClick={() => void revalidator.revalidate()} size="sm" type="button" variant="outline">
            {t("retry")}
          </Button>
        </AlertAction>
      </Alert>
    </section>
  )
}
