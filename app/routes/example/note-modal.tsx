import { dehydrate, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  useNavigate,
  useLocation,
  Outlet,
  useMatches,
  type ShouldRevalidateFunctionArgs,
} from "react-router"

import type { Route } from "./+types/note-modal"
import type { NoteModalContext } from "~/components/notes/note-modal-context"
import { ResponsiveSheet, ResponsiveSheetPopup } from "~/components/responsive-sheet"
import { getClientTRPC, getQueryClient, useTRPC } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { useModalQueryLoading } from "~/lib/use-modal-query-loading"
import { useHydrated } from "~/lib/use-hydrated"
import { resources } from "~/locales"

export function meta({ loaderData, matches }: Route.MetaArgs) {
  const locale = matches[0]?.loaderData?.locale
  return [{ title: loaderData?.title ?? resources[locale === "fi" ? "fi" : "en"].notes.title }]
}

export async function loader(loaderArgs: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(loaderArgs)
  const note = await queryClient
    .query(trpc.example.get.queryOptions({ id: loaderArgs.params.noteId }))
    .catch(() => undefined)

  return { queryClient: dehydrate(queryClient), title: note?.title ?? null }
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { queryClient, trpc } = getClientTRPC()
  const cachedNote = queryClient.getQueryData(trpc.example.get.queryKey({ id: params.noteId }))
    ?? queryClient.getQueryData(trpc.example.list.queryKey())?.find((note) => note.id === params.noteId)
  const note = cachedNote ?? await queryClient.query(trpc.example.get.queryOptions({ id: params.noteId })).catch(() => undefined)

  return { title: note?.title ?? null }
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
  const { t } = useTranslation("notes")
  const hydrated = useHydrated()
  const [isOpen, setIsOpen] = useState(!hydrated)
  const titleId = useId()
  const descriptionId = useId()
  const location = useLocation()
  const isClosingRef = useRef(false)
  const hasNavigatedRef = useRef(false)
  const returnToListRef = useRef(location.state?.fromExampleList === true)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()
  const isEditing = useMatches().some((match) => match.id === "routes/example/note-edit")
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
  useLayoutEffect(() => {
    setIsOpen(true)
  }, [])
  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    },
    [],
  )

  function closeModal() {
    if (hasNavigatedRef.current) return

    hasNavigatedRef.current = true
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    if (returnToListRef.current) {
      navigate(-1)
    } else {
      navigate("/example", { replace: true })
    }
  }

  function startClosing() {
    if (isClosingRef.current) return

    isClosingRef.current = true
    setIsOpen(false)
    closeTimerRef.current = setTimeout(closeModal, 500)
  }

  return (
    <>
      <ResponsiveSheet
        deferClose={false}
        onOpenChange={(open) => {
          if (!open) startClosing()
        }}
        onOpenChangeComplete={(open) => {
          if (!open && isClosingRef.current) closeModal()
        }}
        open={isOpen}
      >
        <ResponsiveSheetPopup
          className={isEditing ? "sm:max-w-lg" : undefined}
          closeLabel={t("actions.close")}
          descriptionId={descriptionId}
          open={isOpen}
          side="right"
          style={{ transitionProperty: "opacity, translate, max-width" }}
          titleId={titleId}
          variant="inset"
        >
          <Outlet context={{ note, loading, titleId, descriptionId } satisfies NoteModalContext} />
        </ResponsiveSheetPopup>
      </ResponsiveSheet>
    </>
  )
}
