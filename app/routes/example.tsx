import { dehydrate, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { inferRouterOutputs } from "@trpc/server"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Outlet,
  useMatches,
  useNavigate,
  useRevalidator,
  useRouteLoaderData,
} from "react-router"

import type { AppRouter } from "~/.server/main"
import type { Route } from "./+types/example"
import { DeleteConfirmationDialog } from "~/components/delete-confirmation-dialog"
import Icon from "~/components/icons"
import { TablePage, TablePageHeader } from "~/components/table-page"
import {
  TanStackTable,
  type TanStackTableColumn,
} from "~/components/tanstack-table"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import {
  createDateTimeFormatter,
  defaultTimeZone,
} from "~/lib/format-preference"
import { getClientTRPC, getQueryClient, useTRPC } from "~/lib/trpc/client"
import { clearMobileNavigationQuery } from "~/lib/mobile-navigation"
import { createTRPC } from "~/lib/trpc/server"
import { useDeleteConfirmation } from "~/lib/hooks"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"
import { toast } from "~/lib/toast"
import type { loader as rootLoader } from "~/root"

type ListNotesOutput = inferRouterOutputs<AppRouter>["example"]["list"]
type Note = ListNotesOutput[number]

export async function loader(loaderArgs: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(loaderArgs)
  await queryClient
    .query(trpc.example.list.queryOptions())
    .catch(() => undefined)

  return {
    queryClient: dehydrate(queryClient),
  }
}

export function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { queryClient, trpc } = getClientTRPC()
  clearMobileNavigationQuery(queryClient, trpc.example.list.queryKey(), request, "/example")

  return null
}

export const shouldRevalidate = shouldRevalidateAppRoute

export default function Notes() {
  const { i18n, t } = useTranslation("notes")
  const isNoteModal = useMatches().some((match) => match.id === "routes/example-note-modal")
  const navigate = useNavigate()
  const trpc = useTRPC()
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const queryClient = useQueryClient()
  const notesQuery = useQuery({
    ...trpc.example.list.queryOptions(),
  })
  const notesCountQuery = useQuery({
    ...trpc.example.count.queryOptions(),
    enabled: false,
  })
  const notes = notesQuery.data ?? []
  const showNotesError = notesQuery.isError && notes.length === 0
  const showRefreshError = notesQuery.isError && notes.length > 0
  const skeletonRowCount = notesQuery.data?.length ?? notesCountQuery.data
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)

  useEffect(() => {
    void import("./example-note-modal").catch(() => undefined)
    void import("./example-new-note-modal").catch(() => undefined)
  }, [])

  const dateTimeFormatter = useMemo(
    () =>
      createDateTimeFormatter({
        formatPreference: rootData?.formatPreference ?? "eu",
        language: i18n.resolvedLanguage === "fi" ? "fi" : "en",
        timeZone: rootData?.organizationTimezone ?? defaultTimeZone,
      }),
    [
      i18n.resolvedLanguage,
      rootData?.formatPreference,
      rootData?.organizationTimezone,
    ],
  )

  const deleteMutation = useMutation(
    trpc.example.delete.mutationOptions({
      onMutate: ({ id }) => {
        setDeletingNoteId(id)
      },
      onError: () => {
        toast.error(t("errors.delete"))
      },
      onSettled: () => {
        setDeletingNoteId(null)
      },
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.example.list.queryFilter()),
          queryClient.invalidateQueries(trpc.example.count.queryFilter()),
        ])
      },
    }),
  )
  const deleteItems = useCallback(
    (noteIds: readonly string[]) =>
      Promise.all(
        noteIds.map((id) => deleteMutation.mutateAsync({ id })),
      ),
    [deleteMutation],
  )
  const deleteConfirmation = useDeleteConfirmation({ deleteItems })

  const columns = useMemo<TanStackTableColumn<Note>[]>(
    () => [
      {
        accessorKey: "title",
        header: t("form.title.label"),
        cell: ({ row }) => (
          <span className="truncate font-medium" title={row.original.title}>
            {row.original.title}
          </span>
        ),
        meta: {
          grow: 0.9,
          minWidth: "14rem",
        },
      },
      {
        accessorKey: "body",
        header: t("form.body.label"),
        cell: ({ row }) => (
          <span
            className="line-clamp-2 text-muted-foreground"
            title={row.original.body}
          >
            {row.original.body}
          </span>
        ),
        meta: {
          grow: 1.6,
          minWidth: "18rem",
          skeleton: "textLines",
        },
      },
      {
        accessorKey: "updatedAt",
        header: t("labels.updated"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {dateTimeFormatter(row.original.updatedAt)}
          </span>
        ),
        meta: {
          minWidth: "11rem",
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("actions.delete")}</span>,
        cell: ({ row }) => {
          const isDeleting = deletingNoteId === row.original.id

          return (
            <div className="flex items-center justify-end gap-1 max-md:flex-row max-md:items-center">
              <Button
                aria-label={t("actions.edit")}
                className="max-md:flex-1 max-md:w-full max-md:border-transparent max-md:bg-secondary max-md:text-secondary-foreground max-md:shadow-none max-md:hover:border-transparent max-md:hover:bg-secondary/90 max-md:data-pressed:border-transparent max-md:data-pressed:bg-secondary/90"
                onClick={(event) => {
                  event.stopPropagation()
                  openEditSheet(row.original)
                }}
                size="icon-sm"
                type="button"
                variant="outline"
              >
                <Icon aria-hidden="true" name="edit" size={16} />
                <span className="hidden max-md:inline">{t("actions.edit")}</span>
              </Button>
              <Button
                aria-label={t("actions.delete")}
                className="max-md:flex-1 max-md:w-full max-md:border-transparent max-md:bg-secondary max-md:text-secondary-foreground max-md:shadow-none max-md:hover:border-transparent max-md:hover:bg-secondary/90 max-md:data-pressed:border-transparent max-md:data-pressed:bg-secondary/90"
                disabled={deleteMutation.isPending}
                onClick={(event) => {
                  event.stopPropagation()
                  deleteConfirmation.requestDelete([row.original.id])
                }}
                size="icon-sm"
                type="button"
                variant="destructive-outline"
              >
                <Icon
                  aria-hidden="true"
                  name={isDeleting ? "loader" : "delete"}
                  size={16}
                />
                <span className="hidden max-md:inline">{t("actions.delete")}</span>
              </Button>
            </div>
          )
        },
        meta: {
          align: "end",
          isAction: true,
          width: "7rem",
        },
      },
    ],
    [dateTimeFormatter, deleteMutation, deletingNoteId, t],
  )

  function openCreateSheet() {
    navigate("new")
  }

  function openEditSheet(note: Note) {
    navigate(`${encodeURIComponent(note.id)}?mode=edit`)
  }

  function openViewSheet(note: Note) {
    navigate(encodeURIComponent(note.id))
  }

  return (
    <TablePage>
      {isNoteModal ? null : <title>{t("title")}</title>}
      <TablePageHeader
        actions={
          <Button
            aria-label={t("actions.add")}
            className="electron-no-drag h-9 rounded-xl max-md:w-9 max-md:px-0"
            onClick={openCreateSheet}
            size="lg"
            type="button"
          >
            <Icon aria-hidden="true" name="add" size={20} />
            <span className="max-md:sr-only">{t("actions.add")}</span>
          </Button>
        }
        description={t("description")}
        refreshing={notesQuery.isRefetching}
        title={t("title")}
      />

      {showRefreshError ? (
        <Alert variant="warning">
          <AlertTitle>{t("errors.refresh")}</AlertTitle>
          <AlertDescription>{t("errors.stale")}</AlertDescription>
          <AlertAction>
            <Button
              disabled={notesQuery.isFetching}
              onClick={() => void notesQuery.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("actions.retry")}
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      {showNotesError ? (
        <Alert variant="error">
          <AlertTitle>{t("errors.load")}</AlertTitle>
          <AlertDescription>{t("errors.retryDescription")}</AlertDescription>
          <AlertAction>
            <Button
              disabled={notesQuery.isFetching}
              onClick={() => void notesQuery.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("actions.retry")}
            </Button>
          </AlertAction>
        </Alert>
      ) : (
        <TanStackTable
          ariaLabel={t("title")}
          className="h-auto min-h-[24rem] md:min-h-0"
          columns={columns}
          data={notes}
          enablePagination={false}
          emptyContent={
            <Empty className="min-h-0 w-full border-0 bg-transparent">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Icon aria-hidden="true" name="notes" size={18} />
                </EmptyMedia>
                <EmptyTitle>{t("empty.title")}</EmptyTitle>
                <EmptyDescription>{t("empty.description")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          }
          fillHeight={true}
          fixedSelectionToolbar={true}
          getRowId={(note) => note.id}
          loading={notesQuery.isLoading}
          loadingLabel={t("loadingList")}
          skeletonRowCount={skeletonRowCount}
          multiSelect={{
            actions: [
              {
                id: "delete",
                icon: "delete",
                label: t("actions.delete"),
                loading: deleteMutation.isPending,
                onClick: ({ clearSelection, selectedRows }) => {
                  deleteConfirmation.requestDelete(
                    selectedRows.map((note) => note.id),
                    clearSelection,
                  )
                },
                variant: "destructive",
              },
            ],
            clearSelectionLabel: t("selection.clear"),
            getRowLabel: (note) => t("selection.row", { title: note.title }),
            selectedLabel: (count) => t("selection.selected", { count }),
            selectAllLabel: t("selection.selectAll"),
            toolbarLabel: t("selection.toolbar"),
          }}
          onRowClick={openViewSheet}
          rowClassName="max-md:min-h-72"
        />
      )}

      <Outlet />

      <DeleteConfirmationDialog
        cancelLabel={t("deleteConfirmation.cancel")}
        confirmLabel={t("deleteConfirmation.confirm")}
        description={t("deleteConfirmation.description")}
        isPending={deleteMutation.isPending}
        onOpenChange={deleteConfirmation.setIsOpen}
        onConfirm={deleteConfirmation.confirmDelete}
        open={deleteConfirmation.isOpen}
        title={
          deleteConfirmation.confirmation?.ids.length === 1
            ? t("deleteConfirmation.title")
            : t("deleteConfirmation.titlePlural", {
                count: deleteConfirmation.confirmation?.ids.length ?? 0,
              })
        }
      />
    </TablePage>
  )
}

export function ErrorBoundary() {
  const { t } = useTranslation("notes")
  const revalidator = useRevalidator()

  return (
    <TablePage>
      <title>{t("title")}</title>
      <TablePageHeader
        description={t("description")}
        title={t("title")}
      />
      <Alert variant="error">
        <AlertTitle>{t("errors.load")}</AlertTitle>
        <AlertDescription>{t("errors.retryDescription")}</AlertDescription>
        <AlertAction>
          <Button
            disabled={revalidator.state !== "idle"}
            onClick={() => void revalidator.revalidate()}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("actions.retry")}
          </Button>
        </AlertAction>
      </Alert>
    </TablePage>
  )
}
