import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useOutletContext } from "react-router"

import type { Route } from "./+types/note-edit"
import { NoteForm } from "~/components/note-form"
import type { NoteModalContext } from "~/components/notes/note-modal-context"
import { NoteModalSkeleton } from "~/components/notes/note-modal-skeleton"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { ResponsiveSheetDescription, ResponsiveSheetFooter, ResponsiveSheetHeader, ResponsiveSheetPanel, ResponsiveSheetTitle } from "~/components/responsive-sheet"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { resources } from "~/locales"

export function meta({ matches }: Route.MetaArgs) {
  const locale = matches[0]?.loaderData?.locale
  return [{ title: resources[locale === "fi" ? "fi" : "en"].notes.form.editTitle }]
}

export function loader() {
  return null
}

export function clientLoader() {
  return null
}

export const shouldRevalidate = shouldRevalidateAppRoute

export default function NoteEdit({ params }: Route.ComponentProps) {
  const { t } = useTranslation("notes")
  const { note, loading, titleId, descriptionId } = useOutletContext<NoteModalContext>()
  const [isDirty, setIsDirty] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const trpc = useTRPC()
  const updateMutation = useMutation(trpc.example.update.mutationOptions({
    onError: () => toast.error(t("errors.update")),
    onSuccess: async (savedNote) => {
      queryClient.setQueryData(trpc.example.get.queryKey({ id: params.noteId }), savedNote)
      await queryClient.invalidateQueries(trpc.example.list.queryFilter())
      await navigate("..", { replace: true })
    },
  }))

  if (loading) {
    return (
      <>
        <NoteModalSkeleton descriptionId={descriptionId} isEditing={true} titleId={titleId} />
      </>
    )
  }

  return (
    <>
      <ResponsiveSheetHeader>
        <ResponsiveSheetTitle id={titleId}>{t("form.editTitle")}</ResponsiveSheetTitle>
        <ResponsiveSheetDescription id={descriptionId}>{t("description")}</ResponsiveSheetDescription>
      </ResponsiveSheetHeader>
      <ResponsiveSheetPanel>
        {note ? (
          <NoteForm
            defaultValues={{ body: note.body, title: note.title }}
            id="edit-note-form"
            key={note.id}
            onDirtyChange={setIsDirty}
            submitFn={(input) => updateMutation.mutateAsync({ ...input, id: note.id })}
          />
        ) : (
          <Alert variant="error">
            <AlertDescription>{t("view.loadError")}</AlertDescription>
          </Alert>
        )}
      </ResponsiveSheetPanel>
      <ResponsiveSheetFooter>
        <Button disabled={updateMutation.isPending} onClick={() => void navigate("..", { replace: true })} type="button" variant="ghost">
          {t("form.cancel")}
        </Button>
        <Button disabled={!note || !isDirty || updateMutation.isPending} form="edit-note-form" type="submit">
          {updateMutation.isPending ? <Spinner aria-hidden={true} /> : null}
          {updateMutation.isPending ? t("form.saving") : t("form.save")}
        </Button>
      </ResponsiveSheetFooter>
    </>
  )
}
