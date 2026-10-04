import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { TRPCClientError } from "@trpc/client"
import { createContext, useContext, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { NavLink, useNavigate, useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import Icon from "~/components/icons"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { Dialog, DialogClose, DialogPopup, DialogTitle } from "~/components/ui/dialog"
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu"
import { useMediaQuery } from "~/lib/hooks"
import { cn } from "~/lib/utils"
import { useTRPC } from "~/lib/trpc/client"
import { toast } from "~/lib/toast"
import { isAnswerableItem, type FormEditorDraft } from "~/lib/forms/form-types"
import { applyPublishedForm, hasFormEditorChanges } from "~/lib/forms/form-publish-changes"

type FormWorkspaceDialogProps = {
  children: ReactNode
  formId: string
  onClose: (save: Promise<void>) => void
  onCloseComplete: () => void
  open: boolean
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED"
  title: string
}

type SaveField = () => Promise<number | void>
export type FormWorkspaceSaveStatus = "saved" | "pending" | "saving" | "error"

type FormWorkspaceSaveContextValue = {
  registerSave: (save: SaveField) => () => void
  registerPublishValidation: (validate: () => Promise<boolean>) => () => void
  saveStatus: FormWorkspaceSaveStatus
  showSaveStatus: boolean
  setSaveStatus: (status: FormWorkspaceSaveStatus) => void
  setEditorDraft: (draft: FormEditorDraft | null) => void
}

const FormWorkspaceSaveContext = createContext<FormWorkspaceSaveContextValue | null>(
  null,
)

export function useRegisterFormWorkspaceSave() {
  return useContext(FormWorkspaceSaveContext)?.registerSave
}

export function useFormWorkspaceSaveStatus() {
  return useContext(FormWorkspaceSaveContext)
}

export function useRegisterFormWorkspacePublishValidation() {
  return useContext(FormWorkspaceSaveContext)?.registerPublishValidation
}

const sections = ["edit", "responses", "settings"] as const
const sectionIcons = { edit: "forms", responses: "chartBar", settings: "settings" } as const

export function FormWorkspaceDialog({ formId, children, onClose, onCloseComplete, open, status, title }: FormWorkspaceDialogProps) {
  const { t } = useTranslation("forms")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const formOptions = trpc.forms.get.queryOptions({ id: formId })
  const draft = useQuery(formOptions)
  const [publishing, setPublishing] = useState(false)
  const publish = useMutation(trpc.forms.publish.mutationOptions())
  const [saveStatus, setSaveStatusValue] = useState<FormWorkspaceSaveStatus>("saved")
  const saveStatusRef = useRef(saveStatus)
  const [showSaveStatus, setShowSaveStatus] = useState(false)
  const [editorDraft, setEditorDraft] = useState<FormEditorDraft | null>(null)
  // Mutation cache writes are immediate, while query subscribers update on a later tick.
  const currentDraft = queryClient.getQueryData(formOptions.queryKey) ?? draft.data
  const currentStatus = currentDraft?.status ?? status
  const hasChangesToPublish = hasFormEditorChanges(editorDraft, currentDraft)
  const hasQuestionsToPublish = Boolean((editorDraft ?? currentDraft)?.sections.some((section) => section.items.some((item) => isAnswerableItem(item.type))))
  const setSaveStatus = (nextStatus: FormWorkspaceSaveStatus) => {
    if (nextStatus === "pending") {
      saveStatusRef.current = nextStatus
      setShowSaveStatus(true)
      setSaveStatusValue(nextStatus)
      return
    }
    if (nextStatus === "error") {
      saveStatusRef.current = nextStatus
      setShowSaveStatus(false)
      setSaveStatusValue(nextStatus)
      return
    }
    if (nextStatus === "saving" && saveStatusRef.current === "error") {
      return
    }
    saveStatusRef.current = nextStatus
    setSaveStatusValue(nextStatus)
  }
  const navigate = useNavigate()
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const isMobile = useMediaQuery("max-640px")
  const savesRef = useRef(new Set<SaveField>())
  const validationsRef = useRef(new Set<() => Promise<boolean>>())
  const registerPublishValidation = useRef((validate: () => Promise<boolean>) => {
    validationsRef.current.add(validate)
    return () => { validationsRef.current.delete(validate) }
  })
  const pendingSavesRef = useRef(new Set<Promise<number | void>>())
  const registerSave = useRef((save: SaveField) => {
    savesRef.current.add(save)
    return () => {
      savesRef.current.delete(save)
      const pendingSave = save()
      pendingSavesRef.current.add(pendingSave)
      void pendingSave.then(
        () => pendingSavesRef.current.delete(pendingSave),
        () => pendingSavesRef.current.delete(pendingSave),
      )
    }
  })

  const publishDraft = async () => {
    if (!hasQuestionsToPublish) return
    setPublishing(true)
    try {
      const valid = await Promise.all(Array.from(validationsRef.current, (validate) => validate()))
      if (valid.some((result) => !result)) {
        toast.error(t("workspace.publishInvalid"))
        return
      }
      const savedRevisions = await Promise.all([
        ...pendingSavesRef.current,
        ...Array.from(savesRef.current, (save) => save()),
      ])
      const revision = savedRevisions.filter((value): value is number => typeof value === "number").at(-1)
        ?? queryClient.getQueryData(formOptions.queryKey)?.draftRevision
      if (revision === undefined) throw new Error("Draft is not loaded")
      const submittedDraft = queryClient.getQueryData(formOptions.queryKey)
      if (!submittedDraft || submittedDraft.draftRevision !== revision) throw new Error("Saved draft is not loaded")
      const published = await publish.mutateAsync({ id: formId, revision })
      queryClient.setQueryData(formOptions.queryKey, (current) => applyPublishedForm(current ?? submittedDraft, submittedDraft, published.version))
      await Promise.all([
        queryClient.invalidateQueries(trpc.forms.list.queryFilter()),
        queryClient.invalidateQueries(trpc.forms.overview.queryFilter()),
        queryClient.invalidateQueries(formOptions),
        queryClient.invalidateQueries(trpc.forms.settings.get.queryOptions({ id: formId })),
      ])
      toast.success(t(published.version > 1 ? "workspace.updated" : "workspace.published"))
    } catch (error) {
      toast.error(t(error instanceof TRPCClientError && error.data?.code === "BAD_REQUEST"
        ? "workspace.publishInvalid"
        : error instanceof TRPCClientError && error.data?.code === "CONFLICT"
          ? "workspace.conflict"
          : "errors.publish"))
    } finally {
      setPublishing(false)
    }
  }
  const shareForm = async () => {
    if (!draft.data?.publishedVersion) return
    try {
      await navigator.clipboard.writeText(new URL(`/f/${formId}`, window.location.origin).href)
      toast.success(t("workspace.linkCopied"))
    } catch {
      toast.error(t("errors.copyLink"))
    }
  }

  return (
    <FormWorkspaceSaveContext.Provider
      value={{ registerSave: registerSave.current, registerPublishValidation: registerPublishValidation.current, saveStatus, showSaveStatus, setSaveStatus, setEditorDraft }}
    >
      <Dialog
        onCloseStart={() => {
          const saves = [
            ...pendingSavesRef.current,
            ...Array.from(savesRef.current, (save) => save()),
          ]
          onClose(Promise.all(saves).then(() => undefined))
        }}
        onOpenChangeComplete={(nextOpen) => { if (!nextOpen) onCloseComplete() }}
        open={open}
      >
        <DialogPopup
          className="row-start-1 h-full max-h-full max-w-none overflow-hidden rounded-none border-0 bg-background shadow-none before:hidden sm:rounded-xl sm:border sm:shadow-xl"
          backdropClassName="max-sm:hidden"
          forceBackdrop={true}
          renderBackdrop={!isMobile}
          showCloseButton={false}
          viewportClassName={cn("grid-rows-1 p-0 sm:p-4", rootData?.isElectron && "sm:pt-10")}
        >
          <header className="grid min-h-16 shrink-0 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 border-b border-border bg-background px-3 py-2 sm:grid-cols-[1fr_auto_1fr] sm:px-4">
            <div className="col-span-2 flex min-w-0 flex-row-reverse items-center justify-between gap-3 sm:col-span-1 sm:flex-row sm:justify-start sm:gap-4">
              <DialogClose
                aria-label={t("workspace.close")}
                render={<Button size="icon" type="button" variant="ghost" />}
              >
                <Icon aria-hidden="true" name="x" />
              </DialogClose>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                <DialogTitle className="max-w-full truncate font-sans text-base font-medium text-muted-foreground">{title}</DialogTitle>
                <div className="flex flex-wrap items-center gap-2.5">
                  {currentStatus === "PUBLISHED" && hasChangesToPublish && !publishing ? (
                    <Badge className="bg-orange-500/8 text-orange-700 dark:bg-orange-500/16 dark:text-orange-400" size="lg" variant="warning">
                      {t("workspace.unpublishedChanges")}
                    </Badge>
                  ) : (
                    <Badge size="lg" variant={currentStatus === "PUBLISHED" ? "success" : currentStatus === "DRAFT" ? "secondary" : "outline"}>
                      {t(`status.${currentStatus.toLowerCase()}`)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <nav aria-label={t("workspace.tabs")} className="justify-self-start sm:justify-self-center">
              <div className="flex w-fit items-center gap-0.5 rounded-lg bg-muted p-0.5">
                {sections.map((section) => (
                  <NavLink
                    draggable={false}
                    onDragStart={(event) => event.preventDefault()}
                    className={({ isActive }) => cn(
                      "flex size-9 items-center justify-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:px-2",
                      isActive && "bg-background text-foreground shadow-xs",
                    )}
                    key={section}
                    onClick={(event) => {
                      event.preventDefault()
                      const saves = [
                        ...pendingSavesRef.current,
                        ...Array.from(savesRef.current, (save) => save()),
                      ]
                      void Promise.all(saves).then(() => navigate(section)).catch(() => undefined)
                    }}
                    to={section}
                  >
                    <Icon aria-hidden="true" className="sm:hidden" name={sectionIcons[section]} size={18} />
                    <span className="sr-only sm:not-sr-only">{t(`workspace.${section === "edit" ? "questions" : section}`)}</span>
                  </NavLink>
                ))}
              </div>
            </nav>

            <div className="flex items-center justify-end gap-2">
              {showSaveStatus && saveStatus !== "error" ? (
                <span aria-live="polite" className="me-3 hidden text-xs text-muted-foreground sm:inline">
                  {t(`workspace.save.${saveStatus === "saved" ? "saved" : "saving"}`)}
                </span>
              ) : null}
              <Menu>
                <MenuTrigger
                  aria-label={t("workspace.share")}
                  disabled={publishing}
                  render={<Button className="h-9 rounded-xl max-sm:size-9 max-sm:px-0 disabled:opacity-100" size="default" type="button" variant="outline" />}
                >
                  <Icon aria-hidden={true} name="share" size={18} />
                  <span className="hidden sm:inline">{t("workspace.share")}</span>
                  <Icon aria-hidden={true} className="hidden sm:block" name="chevronDown" size={16} />
                </MenuTrigger>
                <MenuPopup align="end" className="min-w-44" sideOffset={6}>
                  <MenuItem closeOnClick={true} disabled={!draft.data?.publishedVersion || publishing} onClick={() => { void shareForm() }}>
                    <Icon aria-hidden={true} name="copy" size={16} />
                    {t("actions.copyPublicLink")}
                  </MenuItem>
                </MenuPopup>
              </Menu>
              <Button aria-busy={publishing} aria-label={t("workspace.publish")} className="relative h-9 rounded-xl max-sm:size-9 max-sm:px-0" disabled={!draft.data || !hasChangesToPublish || !hasQuestionsToPublish || publishing || saveStatus === "error"} onClick={() => { void publishDraft() }} size="default" type="button">
                <span aria-hidden={publishing} className={cn("flex items-center gap-2", publishing && "invisible")}>
                  <Icon aria-hidden={true} name="send" size={18} />
                  <span className="hidden sm:inline">{t("workspace.publish")}</span>
                </span>
                {publishing ? <span className="absolute inset-0 grid place-items-center"><Spinner aria-hidden={true} className="size-4.5" /></span> : null}
              </Button>
            </div>
          </header>

          {children}
        </DialogPopup>
      </Dialog>
    </FormWorkspaceSaveContext.Provider>
  )
}
