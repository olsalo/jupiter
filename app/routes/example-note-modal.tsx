import { dehydrate, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { inferRouterOutputs } from "@trpc/server"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  useNavigate,
  useRouteLoaderData,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router"

import type { Route } from "./+types/example-note-modal"
import type { AppRouter } from "~/.server/main"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import Icon from "~/components/icons"
import { NoteForm } from "~/components/note-form"
import { Skeleton } from "~/components/ui/skeleton"
import FormLabel from "~/components/form-label"
import {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "~/components/ui/sheet"
import {
  createDateTimeFormatter,
  defaultTimeZone,
} from "~/lib/format-preference"
import { getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { toast } from "~/lib/toast"
import { useModalQueryLoading } from "~/lib/use-modal-query-loading"
import type { loader as rootLoader } from "~/root"

type Note = inferRouterOutputs<AppRouter>["example"]["get"]

export async function loader(loaderArgs: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(loaderArgs)
  await queryClient
    .query(trpc.example.get.queryOptions({ id: loaderArgs.params.noteId }))
    .catch(() => undefined)

  return { queryClient: dehydrate(queryClient) }
}

export function clientLoader() {
  return null
}

export function shouldRevalidate({
  currentUrl,
  defaultShouldRevalidate,
  nextUrl,
}: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname !== nextUrl.pathname) return true
  if (currentUrl.search !== nextUrl.search) return false
  return defaultShouldRevalidate
}

export default function NoteModal({ params }: Route.ComponentProps) {
  const { i18n, t } = useTranslation("notes")
  const [isOpen, setIsOpen] = useState(false)
  const isClosingRef = useRef(false)
  const hasNavigatedRef = useRef(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editFormDirty, setEditFormDirty] = useState(false)
  const isEditing = searchParams.get("mode") === "edit"
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const notesOptions = trpc.example.list.queryOptions()
  const noteQuery = useQuery({
    ...trpc.example.get.queryOptions({ id: params.noteId }),
    initialData: () => queryClient.getQueryData(notesOptions.queryKey)
      ?.find((note) => note.id === params.noteId),
    initialDataUpdatedAt: () => queryClient.getQueryState(notesOptions.queryKey)?.dataUpdatedAt,
  })
  const loading = useModalQueryLoading(noteQuery, params.noteId)
  const note = noteQuery.data ?? null
  const hasError = !note
  const updateMutation = useMutation(
    trpc.example.update.mutationOptions({
      onError: () => {
        toast.error(t("errors.update"))
      },
      onSuccess: async (savedNote) => {
        queryClient.setQueryData(
          trpc.example.get.queryKey({ id: params.noteId }),
          savedNote,
        )
        await queryClient.invalidateQueries(trpc.example.list.queryFilter())
        closeEdit()
      },
    }),
  )
  useLayoutEffect(() => {
    setIsOpen(true)
  }, [])
  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    },
    [],
  )
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

  function closeModal() {
    if (hasNavigatedRef.current) return

    hasNavigatedRef.current = true
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    navigate("/example", { replace: true })
  }

  function startClosing() {
    if (isClosingRef.current) return

    isClosingRef.current = true
    setIsOpen(false)
    closeTimerRef.current = setTimeout(closeModal, 400)
  }

  function openEdit(note: Note | null) {
    if (!note) return

    setEditFormDirty(false)
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      nextParams.set("mode", "edit")
      return nextParams
    }, { replace: true })
  }

  function closeEdit() {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      nextParams.delete("mode")
      return nextParams
    }, { replace: true })
  }

  return (
    <>
      <title>{note?.title ?? t("title")}</title>
      <Sheet
        deferClose={false}
        onOpenChange={(open) => {
          if (!open) startClosing()
        }}
        onOpenChangeComplete={(open) => {
          if (!open && isClosingRef.current) closeModal()
        }}
        open={isOpen}
      >
        <SheetPopup
          className={isEditing ? "sm:max-w-lg" : undefined}
          side="right"
          style={{ transitionProperty: "opacity, translate, max-width" }}
          variant="inset"
        >
          {loading ? <NoteSkeleton isEditing={isEditing} /> : isEditing ? (
            <>
              <SheetHeader>
                <SheetTitle>{t("form.editTitle")}</SheetTitle>
                <SheetDescription>{t("description")}</SheetDescription>
              </SheetHeader>
              <SheetPanel>
                {hasError ? (
                  <Alert variant="error">
                    <AlertDescription>{t("view.loadError")}</AlertDescription>
                  </Alert>
                ) : note ? (
                  <NoteForm
                    defaultValues={{ body: note.body, title: note.title }}
                    id="edit-note-form"
                    onDirtyChange={setEditFormDirty}
                    submitFn={(input) =>
                      updateMutation.mutateAsync({ ...input, id: note.id })
                    }
                  />
                ) : null}
              </SheetPanel>
              <SheetFooter>
                <Button
                  disabled={updateMutation.isPending}
                  onClick={closeEdit}
                  type="button"
                  variant="ghost"
                >
                  {t("form.cancel")}
                </Button>
                <Button
                  disabled={!note || !editFormDirty || updateMutation.isPending}
                  form="edit-note-form"
                  type="submit"
                >
                  {updateMutation.isPending ? t("form.saving") : t("form.save")}
                </Button>
              </SheetFooter>
            </>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>{note?.title ?? t("view.loadError")}</SheetTitle>
                <SheetDescription>{t("view.description")}</SheetDescription>
              </SheetHeader>
              <SheetPanel className="flex min-h-0 flex-1 flex-col gap-6">
                {hasError ? (
                  <Alert variant="error">
                    <AlertDescription>{t("view.loadError")}</AlertDescription>
                  </Alert>
                ) : note ? (
                  <>
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        {t("form.body.label")}
                      </span>
                      <p className="whitespace-pre-wrap break-words text-sm">{note.body}</p>
                    </div>
                    <dl className="grid gap-3 border-t border-border/60 pt-4 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-muted-foreground">{t("labels.created")}</dt>
                        <dd className="text-right">{dateTimeFormatter(note.createdAt)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-muted-foreground">{t("labels.updated")}</dt>
                        <dd className="text-right">{dateTimeFormatter(note.updatedAt)}</dd>
                      </div>
                    </dl>
                  </>
                ) : null}
              </SheetPanel>
              <SheetFooter>
                <Button disabled={!note} onClick={() => openEdit(note)} type="button">
                  <Icon aria-hidden="true" name="edit" size={16} />
                  {t("actions.edit")}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetPopup>
      </Sheet>
    </>
  )
}

function NoteSkeleton({ isEditing }: { isEditing: boolean }) {
  const { t } = useTranslation("notes")

  return (
    <>
      <SheetHeader>
        {isEditing ? (
          <SheetTitle>{t("form.editTitle")}</SheetTitle>
        ) : (
          <>
            <SheetTitle className="sr-only">{t("view.loading")}</SheetTitle>
            <Skeleton aria-hidden={true} className="h-5 w-2/3" />
          </>
        )}
        <SheetDescription>{isEditing ? t("description") : t("view.description")}</SheetDescription>
      </SheetHeader>
      <SheetPanel
        aria-busy={true}
        aria-label={t("view.loading")}
        className={isEditing ? undefined : "flex min-h-0 flex-1 flex-col gap-6"}
        role="status"
      >
        {isEditing ? (
          <div aria-hidden={true} className="flex w-full flex-col gap-5">
            <FormLabel label={t("form.title.label")}>
              <Skeleton className="h-9 w-full rounded-lg sm:h-8" />
            </FormLabel>
            <FormLabel label={t("form.body.label")}>
              <Skeleton className="h-21 w-full rounded-lg sm:h-18" />
            </FormLabel>
          </div>
        ) : (
          <>
            <div aria-hidden={true} className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">{t("form.body.label")}</span>
              <div className="flex flex-col">
                <div className="flex h-5 items-center"><Skeleton className="h-3.5 w-full" /></div>
                <div className="flex h-5 items-center"><Skeleton className="h-3.5 w-5/6" /></div>
                <div className="flex h-5 items-center"><Skeleton className="h-3.5 w-2/3" /></div>
              </div>
            </div>
            <dl aria-hidden={true} className="grid gap-3 border-t border-border/60 pt-4 text-sm">
              {["created", "updated"].map((label) => (
                <div className="flex h-5 items-center justify-between gap-4" key={label}>
                  <dt className="text-muted-foreground">{t(`labels.${label}`)}</dt>
                  <dd className="flex justify-end"><Skeleton className="h-3.5 w-36" /></dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </SheetPanel>
      <SheetFooter>
        {isEditing ? (
          <>
            <Button disabled={true} type="button" variant="ghost">{t("form.cancel")}</Button>
            <Button disabled={true} type="button">{t("form.save")}</Button>
          </>
        ) : (
          <Button disabled={true} type="button">
            <Icon aria-hidden={true} name="edit" size={16} />
            {t("actions.edit")}
          </Button>
        )}
      </SheetFooter>
    </>
  )
}
