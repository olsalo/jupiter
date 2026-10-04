import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"

import { NoteForm } from "~/components/note-form"
import { Button } from "~/components/ui/button"
import {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "~/components/ui/sheet"
import { useTRPC } from "~/lib/trpc/client"
import { toast } from "~/lib/toast"

export default function NewNoteModal() {
  const { t } = useTranslation("notes")
  const navigate = useNavigate()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const isClosingRef = useRef(false)
  const hasNavigatedRef = useRef(false)
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
    navigate("/example", { replace: true })
  }

  function startClosing(afterSubmit = false) {
    if (isClosingRef.current || (createMutation.isPending && !afterSubmit)) return

    isClosingRef.current = true
    setIsOpen(false)
    closeTimerRef.current = setTimeout(closeModal, 400)
  }

  return (
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
      <SheetPopup className="sm:max-w-xl" side="right" variant="inset">
        <SheetHeader>
          <SheetTitle>{t("form.createTitle")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        <SheetPanel>
          <NoteForm
            defaultValues={{ body: "", title: "" }}
            id="create-note-form"
            submitFn={(input) => createMutation.mutateAsync(input)}
          />
        </SheetPanel>
        <SheetFooter>
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
            {createMutation.isPending ? t("form.creating") : t("form.create")}
          </Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  )
}
