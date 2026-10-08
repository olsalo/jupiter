import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router"

import { NoteForm } from "~/components/note-form"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import {
  ResponsiveSheet,
  ResponsiveSheetPopup,
  ResponsiveSheetDescription,
  ResponsiveSheetFooter,
  ResponsiveSheetHeader,
  ResponsiveSheetPanel,
  ResponsiveSheetTitle,
} from "~/components/responsive-sheet"
import { useTRPC } from "~/lib/trpc/client"
import { toast } from "~/lib/toast"
import { useHydrated } from "~/lib/use-hydrated"
import type { Route } from "./+types/new-note-modal"
import { resources } from "~/locales"

export function meta({ matches }: Route.MetaArgs) {
  const locale = matches[0]?.loaderData?.locale
  return [{ title: resources[locale === "fi" ? "fi" : "en"].notes.form.createTitle }]
}

export default function NewNoteModal() {
  const { t } = useTranslation("notes")
  const location = useLocation()
  const navigate = useNavigate()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const hydrated = useHydrated()
  const [isOpen, setIsOpen] = useState(!hydrated)
  const titleId = useId()
  const descriptionId = useId()
  const isClosingRef = useRef(false)
  const hasNavigatedRef = useRef(false)
  const returnToListRef = useRef(location.state?.fromExampleList === true)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const createMutation = useMutation(
    trpc.example.create.mutationOptions({
      onError: () => {
        toast.error(t("errors.create"))
      },
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.example.list.queryFilter()),
          queryClient.invalidateQueries(trpc.example.count.queryFilter()),
        ])
        startClosing(true)
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

  function startClosing(afterSubmit = false) {
    if (isClosingRef.current || (createMutation.isPending && !afterSubmit)) return

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
          className="sm:max-w-xl"
          closeLabel={t("actions.close")}
          descriptionId={descriptionId}
          open={isOpen}
          side="right"
          titleId={titleId}
          variant="inset"
        >
          <ResponsiveSheetHeader>
            <ResponsiveSheetTitle id={titleId}>{t("form.createTitle")}</ResponsiveSheetTitle>
            <ResponsiveSheetDescription id={descriptionId}>{t("description")}</ResponsiveSheetDescription>
          </ResponsiveSheetHeader>
          <ResponsiveSheetPanel>
            <NoteForm
              defaultValues={{ body: "", title: "" }}
              id="create-note-form"
              submitFn={(input) => createMutation.mutateAsync(input)}
            />
          </ResponsiveSheetPanel>
          <ResponsiveSheetFooter>
            <Button
              disabled={createMutation.isPending}
              onClick={() => startClosing()}
              type="button"
              variant="ghost"
            >
              {t("form.cancel")}
            </Button>
            <Button
              disabled={createMutation.isPending}
              form="create-note-form"
              type="submit"
            >
              {createMutation.isPending ? <Spinner aria-hidden={true} /> : null}
              {createMutation.isPending ? t("form.creating") : t("form.create")}
            </Button>
          </ResponsiveSheetFooter>
        </ResponsiveSheetPopup>
      </ResponsiveSheet>
    </>
  )
}
