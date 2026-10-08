import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useOutletContext, useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import Icon from "~/components/icons"
import type { NoteModalContext } from "~/components/notes/note-modal-context"
import { NoteModalSkeleton } from "~/components/notes/note-modal-skeleton"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { ResponsiveSheetDescription, ResponsiveSheetFooter, ResponsiveSheetHeader, ResponsiveSheetPanel, ResponsiveSheetTitle } from "~/components/responsive-sheet"
import { createDateTimeFormatter, defaultTimeZone } from "~/lib/format-preference"

export function loader() {
  return null
}

export function clientLoader() {
  return null
}

export default function NoteView() {
  const { i18n, t } = useTranslation("notes")
  const { note, loading, titleId, descriptionId } = useOutletContext<NoteModalContext>()
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const navigate = useNavigate()
  const hasError = !note
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

  return (
    <>
      {loading ? (
        <NoteModalSkeleton descriptionId={descriptionId} isEditing={false} titleId={titleId} />
      ) : (
        <>
          <ResponsiveSheetHeader>
            <ResponsiveSheetTitle id={titleId}>{note?.title ?? t("view.loadError")}</ResponsiveSheetTitle>
            <ResponsiveSheetDescription id={descriptionId}>{t("view.description")}</ResponsiveSheetDescription>
          </ResponsiveSheetHeader>
          <ResponsiveSheetPanel className="flex min-h-0 flex-1 flex-col gap-6">
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
          </ResponsiveSheetPanel>
          <ResponsiveSheetFooter>
            <Button disabled={!note} onClick={() => void navigate("edit", { replace: true })} type="button">
              <Icon aria-hidden="true" name="edit" size={16} />
              {t("actions.edit")}
            </Button>
          </ResponsiveSheetFooter>
        </>
      )}
    </>
  )
}
