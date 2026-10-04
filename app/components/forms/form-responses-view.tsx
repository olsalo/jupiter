import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { inferRouterOutputs } from "@trpc/server"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useRouteLoaderData } from "react-router"

import type { AppRouter } from "~/.server/main"
import type { loader as rootLoader } from "~/root"
import Icon from "~/components/icons"
import { PageHeader } from "~/components/page-header"
import { TanStackTable, type TanStackTableColumn } from "~/components/tanstack-table"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Spinner } from "~/components/ui/spinner"
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip"
import { defaultTimeZone, formatDateTime, formatNumber } from "~/lib/format-preference"
import { responsesToCsv } from "~/lib/forms/response-csv"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { cn } from "~/lib/utils"

type Response = inferRouterOutputs<AppRouter>["forms"]["responses"]["list"][number]

export function FormResponsesView({ formId, selectedId }: { formId: string, selectedId: string | null }) {
  const { i18n, t } = useTranslation("forms")
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [exporting, setExporting] = useState(false)
  const navigate = useNavigate()
  const responses = useQuery(trpc.forms.responses.list.queryOptions({ id: formId }))
  const loading = responses.isLoading
  const isEmpty = !selectedId && !loading && responses.isSuccess && responses.data.length === 0
  const forms = useQuery({ ...trpc.forms.list.queryOptions(), enabled: false })
  const skeletonRowCount = responses.data?.length
    ?? forms.data?.find((form) => form.id === formId)?._count.submissions
  const selected = responses.data?.find((response) => response.id === selectedId)
  const detail = useQuery({
    ...trpc.forms.responses.get.queryOptions({ id: formId, submissionId: selectedId ?? "" }),
    enabled: Boolean(selectedId),
  })
  const waitingForSelected = Boolean(selectedId) && !selected && (responses.isPending || responses.isFetching || detail.isPending)
  const hasSelection = Boolean(selected) || waitingForSelected
  const dateOptions = {
    formatPreference: root?.formatPreference ?? "eu",
    language: i18n.resolvedLanguage === "fi" ? "fi" as const : "en" as const,
    timeZone: root?.organizationTimezone ?? defaultTimeZone,
  }
  const responderLabel = (response: Response) => response.respondentEmail ?? t("responseView.anonymous")
  const setSelectedId = (id: string | null) => {
    const path = `/forms/${formId}/responses${id ? `/${encodeURIComponent(id)}` : ""}`
    void navigate(path, { replace: true, preventScrollReset: true })
  }
  const toggleResponder = (id: string) => setSelectedId(selectedId === id ? null : id)

  async function exportResponses() {
    setExporting(true)
    try {
      const data = await queryClient.fetchQuery({
        ...trpc.forms.responses.export.queryOptions({ id: formId }),
        staleTime: 0,
        gcTime: 0,
      })
      const csv = responsesToCsv(data.responses, {
        responder: t("responseView.responder"),
        submittedAt: t("responseView.submittedAt"),
        anonymous: t("responseView.anonymous"),
      }, (date) => formatDateTime(date, dateOptions))
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
      const link = document.createElement("a")
      link.href = url
      link.download = t("responseView.exportFilename", {
        title: data.title.trim() || t("untitled"),
        timestamp: new Date().toISOString().slice(0, 10),
        interpolation: { escapeValue: false },
      }).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      toast.error(t("responseView.exportError"))
    } finally {
      setExporting(false)
    }
  }
  const columns: TanStackTableColumn<Response>[] = [
    {
      id: "responder",
      header: t("responseView.responder"),
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden={true} className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
            <Icon name="user" size={16} />
          </span>
          <button
            aria-pressed={row.original.id === selected?.id}
            className="truncate rounded-sm text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => toggleResponder(row.original.id)}
            type="button"
          >
            {responderLabel(row.original)}
          </button>
        </div>
      ),
      meta: { minWidth: "12rem", grow: 1, skeleton: "avatarText" },
    },
    {
      id: "submittedAt",
      header: t("responseView.submittedAt"),
      cell: ({ row }) => <span className="text-muted-foreground">{formatDateTime(row.original.submittedAt, dateOptions)}</span>,
      meta: { width: "12rem" },
    },
  ]

  function loadError(onRetry: () => void, fetching: boolean, title: string) {
    return (
      <Alert variant="error">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{t("errors.retry")}</AlertDescription>
        <AlertAction>
          <Button disabled={fetching} onClick={onRetry} size="sm" type="button" variant="outline">{t("retry")}</Button>
        </AlertAction>
      </Alert>
    )
  }

  return (
    <section className={cn("grid min-h-0 flex-1 grid-cols-1 overflow-hidden", !isEmpty && "md:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]")}>
      <div className={cn("flex min-h-0 min-w-0 flex-col gap-5 p-6", !isEmpty && "md:border-r", hasSelection && "max-md:hidden")}>
        <PageHeader
          actions={
            <>
              <Tooltip>
                <TooltipTrigger render={
                  <Button
                    aria-label={t("responseView.refresh")}
                    disabled={responses.isFetching}
                    onClick={() => { void responses.refetch() }}
                    size="icon"
                    type="button"
                    variant="outline"
                  />
                }>
                  <Icon aria-hidden={true} className={cn(responses.isFetching && "motion-safe:animate-spin")} name="refresh" size={16} />
                </TooltipTrigger>
                <TooltipPopup>{t("responseView.refresh")}</TooltipPopup>
              </Tooltip>
              <Button disabled={loading || !responses.data?.length} loading={exporting} onClick={() => { void exportResponses() }} type="button" variant="outline">
                <Icon aria-hidden={true} name="download" size={16} />
                {t("responseView.export")}
              </Button>
            </>
          }
          className="items-center [&_h1]:text-2xl [&_h1]:font-semibold"
          title={
            <span className="inline-flex items-center gap-3">
              {t("workspace.responses")}
              {skeletonRowCount !== undefined ? (
                <Badge aria-label={t("responses", { count: skeletonRowCount })} className="h-6 min-w-6 rounded-md px-2 text-sm tabular-nums sm:h-6 sm:min-w-6 sm:text-sm" variant="secondary">
                  {formatNumber(skeletonRowCount, dateOptions.formatPreference)}
                </Badge>
              ) : null}
            </span>
          }
        />
        {responses.isError ? loadError(() => { void responses.refetch() }, responses.isFetching, t("responseView.loadError")) : null}
        {!responses.isError || responses.data ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <TanStackTable
              ariaLabel={t("workspace.responses")}
              columns={columns}
              data={responses.data ?? []}
              emptyContent={
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Icon aria-hidden={true} name="forms" size={20} /></EmptyMedia>
                    <EmptyTitle>{t("responseView.emptyTitle")}</EmptyTitle>
                    <EmptyDescription>{t("responseView.emptyDescription")}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              }
              enableMultiSelect={false}
              enablePagination={false}
              fillHeight={false}
              getRowId={(response) => response.id}
              loading={loading}
              loadingLabel={t("responseView.loading")}
              onRowClick={(response) => toggleResponder(response.id)}
              rowClassName={(response) => response.id === selected?.id ? "bg-muted/20 md:bg-muted/36" : undefined}
              skeletonRowCount={skeletonRowCount}
            />
          </div>
        ) : null}
      </div>

      {!isEmpty ? <aside aria-label={t("responseView.answers")} className={cn("flex min-h-0 min-w-0 flex-col bg-muted/20", !hasSelection && "max-md:hidden")}>
        {waitingForSelected ? (
          <div aria-busy={true} className="flex min-h-0 flex-1 items-center justify-center p-6">
            <Spinner aria-label={t("responseView.loadingAnswers")} className="size-6 text-muted-foreground" />
          </div>
        ) : selected ? (
          <>
            <header className="flex shrink-0 flex-col gap-3 border-b p-6">
              <Button className="w-fit md:hidden" onClick={() => setSelectedId(null)} size="sm" type="button" variant="ghost">
                <Icon aria-hidden={true} name="arrowLeft" size={16} />{t("workspace.responses")}
              </Button>
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden={true} className="grid size-10 shrink-0 place-items-center rounded-full border bg-background text-muted-foreground"><Icon name="user" size={20} /></span>
                <div className="min-w-0">
                  <h2 className="break-words text-base font-semibold">{responderLabel(selected)}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(selected.submittedAt, dateOptions)}</p>
                </div>
              </div>
            </header>
            {detail.isLoading ? (
              <div className="flex min-h-0 flex-1 items-center justify-center p-6">
                <Spinner aria-label={t("responseView.loadingAnswers")} className="size-6 text-muted-foreground" />
              </div>
            ) : <ScrollArea className="h-0 flex-1" key={selected.id} scrollFade={true} viewportProps={{ className: "!overflow-x-hidden" }}>
              <div className="flex flex-col gap-6 p-6">
                {detail.isError ? loadError(() => { void detail.refetch() }, detail.isFetching, t("responseView.answersError")) : null}
                {detail.data ? (
                  detail.data.sections.length ? detail.data.sections.map((section) => (
                    <section className="flex flex-col gap-5" key={section.id}>
                      {section.title ? <h3 className="text-sm font-semibold">{section.title}</h3> : null}
                      <dl className="divide-y divide-border">
                        {section.answers.map((answer) => (
                          <div className="py-5 first:pt-0 last:pb-0" key={answer.id}>
                            <dt className="mb-2 break-words text-sm font-medium">{answer.label}</dt>
                            <dd className="whitespace-pre-wrap break-words text-sm leading-6">
                              {answer.values.length ? answer.values.length === 1 ? answer.values[0] : <ul className="list-disc space-y-1 ps-4">{answer.values.map((value, index) => <li key={index}>{value}</li>)}</ul> : <span className="text-muted-foreground">{t("responseView.noAnswer")}</span>}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  )) : <Alert variant="info"><AlertTitle>{t("responseView.noAnswers")}</AlertTitle></Alert>
                ) : null}
              </div>
            </ScrollArea>}
          </>
        ) : (
          <Empty className="min-h-0">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Icon aria-hidden={true} name="user" size={20} /></EmptyMedia>
              <EmptyTitle>{t("responseView.selectResponder")}</EmptyTitle>
              <EmptyDescription>{t("responseView.selectDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </aside> : null}
    </section>
  )
}
