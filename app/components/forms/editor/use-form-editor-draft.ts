import { TRPCClientError } from "@trpc/client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import type { EditableItemType } from "./form-editor-types"
import { getAllowOther, getSetting } from "~/lib/forms/form-item-settings"
import { getFormDraftPayload, reconcileSavedFormDraft } from "~/lib/forms/form-editor-save"
import type { FormEditorDraft, FormItem } from "~/lib/forms/form-types"
import {
  useFormWorkspaceSaveStatus,
  useRegisterFormWorkspaceSave,
  type FormWorkspaceSaveStatus,
} from "~/components/forms/form-workspace-dialog"
import type { SingleChoiceFormItemInput, TextFormItemInput } from "~/lib/forms/schemas/form-item"
import type { FormHeadingInput } from "~/lib/forms/schemas/form-draft"
import { generateId } from "~/lib/id"
import { useTRPC } from "~/lib/trpc/client"

export function useFormEditorDraft(formId: string) {
  const { t } = useTranslation("forms")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const registerSave = useRegisterFormWorkspaceSave()
  const workspaceSaveStatus = useFormWorkspaceSaveStatus()
  const formOptions = trpc.forms.get.queryOptions({ id: formId })
  const form = useQuery(formOptions)
  const [draft, setDraft] = useState<FormEditorDraft | null>(form.data ?? null)
  const draftRef = useRef(draft)
  const cards = draft?.sections.flatMap((section) => section.items) ?? []
  const cardsRef = useRef(cards)
  const revisionRef = useRef(form.data?.draftRevision ?? 0)
  const [hasConflict, setHasConflict] = useState(false)
  const [editorSession, setEditorSession] = useState(0)
  const conflictRef = useRef(false)
  const mountedRef = useRef(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const saveStatus = workspaceSaveStatus?.saveStatus ?? "saved"
  const loadedFormIdRef = useRef(form.data?.id)
  const savedSnapshotRef = useRef(form.data ? JSON.stringify(getFormDraftPayload(form.data)) : null)
  const setEditorDraft = workspaceSaveStatus?.setEditorDraft
  useLayoutEffect(() => {
    setEditorDraft?.(draft)
  }, [draft, setEditorDraft])
  useLayoutEffect(() => () => setEditorDraft?.(null), [setEditorDraft])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savePromiseRef = useRef<Promise<void> | null>(null)
  const saveDraft = useMutation(trpc.forms.saveDraft.mutationOptions())
  const saveDraftRef = useRef(saveDraft.mutateAsync)
  saveDraftRef.current = saveDraft.mutateAsync

  const setStatus = (status: FormWorkspaceSaveStatus) => {
    workspaceSaveStatus?.setSaveStatus(status)
  }
  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }
  const flushDraft = async () => {
    clearTimer()
    if (savePromiseRef.current) return savePromiseRef.current
    if (savedSnapshotRef.current === null || !draftRef.current) return
    if (conflictRef.current) throw new Error("Draft conflict")

    const promise = (async () => {
      while (true) {
        const payload = getFormDraftPayload(draftRef.current!)
        const snapshot = JSON.stringify(payload)
        if (snapshot === savedSnapshotRef.current) {
          setStatus("saved")
          return
        }
        setStatus("saving")
        try {
          const updatedForm = await saveDraftRef.current({
            id: formId,
            revision: revisionRef.current,
            ...payload,
          })
          savedSnapshotRef.current = snapshot
          revisionRef.current = updatedForm.draftRevision
          if (draftRef.current) {
            const next = reconcileSavedFormDraft(draftRef.current, updatedForm, snapshot)
            if (next === updatedForm) savedSnapshotRef.current = JSON.stringify(getFormDraftPayload(updatedForm))
            draftRef.current = next
            cardsRef.current = next.sections.flatMap((section) => section.items)
            if (mountedRef.current) setDraft(next)
          }
          queryClient.setQueryData(formOptions.queryKey, updatedForm)
          queryClient.setQueryData(trpc.forms.list.queryOptions().queryKey, (forms) =>
            forms?.map((form) => form.id === formId ? { ...form, title: updatedForm.title } : form),
          )
        } catch (error) {
          setStatus("error")
          if (error instanceof TRPCClientError && error.data?.code === "CONFLICT") {
            conflictRef.current = true
            if (mountedRef.current) setHasConflict(true)
          } else if (mountedRef.current) {
            timerRef.current = setTimeout(() => { void flushRef.current().catch(() => undefined) }, 3000)
          }
          throw error
        }
      }
    })()
    savePromiseRef.current = promise
    try {
      await promise
    } finally {
      savePromiseRef.current = null
    }
  }
  const flushRef = useRef(flushDraft)
  flushRef.current = flushDraft
  const flush = () => flushRef.current()
  const scheduleSave = () => {
    if (conflictRef.current) return
    setStatus("pending")
    clearTimer()
    timerRef.current = setTimeout(() => { void flushRef.current().catch(() => undefined) }, 500)
  }
  const commitCards = (update: (current: FormItem[]) => FormItem[]) => {
    const currentDraft = draftRef.current
    if (savedSnapshotRef.current === null || !currentDraft || conflictRef.current) return
    const next = update(cardsRef.current)
    const itemSections = new Map(currentDraft.sections.flatMap((section) => section.items.map((item) => [item.id, section.id] as const)))
    // New/duplicated cards join the section of the preceding card.
    let sectionId = currentDraft.sections[0].id
    for (const item of next) {
      sectionId = itemSections.get(item.id) ?? sectionId
      itemSections.set(item.id, sectionId)
    }
    const nextDraft = { ...currentDraft, sections: currentDraft.sections.map((section) => ({
      ...section,
      items: next.filter((item) => itemSections.get(item.id) === section.id).map((item, sortOrder) => ({ ...item, sortOrder })),
    })) }
    draftRef.current = nextDraft
    cardsRef.current = nextDraft.sections.flatMap((section) => section.items)
    setDraft(nextDraft)
    scheduleSave()
  }

  useEffect(() => {
    if (!form.data) return
    if (loadedFormIdRef.current === form.data.id) {
      if (form.data.draftRevision > revisionRef.current) {
        conflictRef.current = true
        setHasConflict(true)
        setStatus("error")
        clearTimer()
      } else if (draftRef.current && (
        JSON.stringify(draftRef.current.settings) !== JSON.stringify(form.data.settings)
        || JSON.stringify(draftRef.current.appearance) !== JSON.stringify(form.data.appearance)
      )) {
        const updated = { ...draftRef.current, settings: form.data.settings, appearance: form.data.appearance }
        draftRef.current = updated
        setDraft(updated)
      }
      return
    }
    loadedFormIdRef.current = form.data.id
    savedSnapshotRef.current = JSON.stringify(getFormDraftPayload(form.data))
    draftRef.current = form.data
    revisionRef.current = form.data.draftRevision
    cardsRef.current = form.data.sections.flatMap((section) => section.items)
    setDraft(form.data)
  }, [form.data])

  useEffect(() => {
    mountedRef.current = true
    const unregister = registerSave?.(async () => {
      await flushRef.current()
      return revisionRef.current
    })
    return () => {
      mountedRef.current = false
      clearTimer()
      unregister?.()
      if (!unregister) void flushRef.current().catch(() => undefined)
    }
  }, [registerSave])

  useEffect(() => {
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") void flushRef.current().catch(() => undefined)
    }
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      if (savedSnapshotRef.current === JSON.stringify(draftRef.current ? getFormDraftPayload(draftRef.current) : null)) return
      event.preventDefault()
      event.returnValue = ""
    }
    document.addEventListener("visibilitychange", saveWhenHidden)
    window.addEventListener("beforeunload", warnBeforeLeave)
    return () => {
      document.removeEventListener("visibilitychange", saveWhenHidden)
      window.removeEventListener("beforeunload", warnBeforeLeave)
    }
  }, [])

  const updateHeading = (values: FormHeadingInput) => {
    const current = draftRef.current
    if (savedSnapshotRef.current === null || !current || conflictRef.current) return
    const description = values.description || null
    if (current.title === values.title && current.description === description) return
    const next = { ...current, title: values.title, description }
    draftRef.current = next
    setDraft(next)
    scheduleSave()
  }

  const updateLocalItem = (itemId: string, values: TextFormItemInput | SingleChoiceFormItemInput) => {
    commitCards((current) => current.map((item) => {
      if (item.id !== itemId) return item
      return {
        ...item,
        label: values.label,
        description: values.description || null,
        required: values.required,
        validation: item.type === "SINGLE_CHOICE" || item.type === "MULTIPLE_CHOICE"
          ? { ...(item.validation && typeof item.validation === "object" ? item.validation : {}), minSelections: values.required ? 1 : 0 }
          : { ...(item.validation && typeof item.validation === "object" ? item.validation : {}), minLength: values.required ? Math.max(1, Number(getSetting(item.validation, "minLength") ?? 0)) : Number(getSetting(item.validation, "minLength") ?? 0) === 1 ? 0 : getSetting(item.validation, "minLength") },
        ...("options" in values ? {
          options: values.options.map((option, sortOrder) => ({ ...option, kind: "OPTION" as const, sortOrder })),
          settings: { allowOther: values.allowOther },
        } : {}),
      }
    }))
  }

  const updateTextBlock = (itemId: string, values: { label: string, description: string }) => {
    commitCards((current) => current.map((item) => item.id === itemId ? {
      ...item,
      label: values.label,
      description: values.description || null,
    } : item))
  }

  const updateItemType = (item: FormItem, type: EditableItemType) => {
    const option = {
      id: generateId("option"),
      label: t("field.option", { number: 1 }),
      value: generateId("choice"),
      sortOrder: 0,
      kind: "OPTION" as const,
    }
    commitCards((current) => current.map((card) => card.id === item.id ? {
      ...card,
      type,
      options: type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE"
        ? card.type === "SINGLE_CHOICE" || card.type === "MULTIPLE_CHOICE" ? card.options : [option]
        : [],
      settings: type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE"
        ? { allowOther: getAllowOther(card.settings) }
        : null,
      validation: null,
      defaultValue: null,
    } : card))
  }

  const addItem = (type: "SHORT_TEXT" | "TEXT_BLOCK" = "SHORT_TEXT") => {
    const itemId = generateId("item")
    const afterItemId = activeId
    const item: FormItem = {
      id: itemId,
      label: "",
      description: null,
      required: type === "SHORT_TEXT",
      validation: null,
      settings: null,
      sortOrder: cardsRef.current.length,
      type,
      placeholder: null,
      defaultValue: null,
      row: cardsRef.current.length,
      column: 0,
      width: 12,
      options: [],
    }
    commitCards((current) => {
      const selectedIndex = afterItemId
        ? current.findIndex((card) => card.id === afterItemId)
        : current.length - 1
      const next = [...current]
      next.splice(selectedIndex + 1, 0, item)
      return next
    })
    setActiveId(itemId)
  }

  const duplicateCard = (source: FormItem) => {
    const latest = cardsRef.current.find((card) => card.id === source.id) ?? source
    const duplicate: FormItem = {
      ...latest,
      id: generateId("item"),
      options: latest.options.map((option) => ({ ...option, id: generateId("option") })),
    }
    commitCards((current) => {
      const index = current.findIndex((card) => card.id === source.id)
      const next = [...current]
      next.splice(index + 1, 0, duplicate)
      return next
    })
    setActiveId(duplicate.id)
  }

  const removeCard = (item: FormItem) => {
    commitCards((current) => current.filter((card) => card.id !== item.id))
    setActiveId((current) => current === item.id ? null : current)
  }

  const reorderCards = (initialIndex: number, index: number) => {
    commitCards((current) => {
      const next = [...current]
      const [moved] = next.splice(initialIndex, 1)
      next.splice(index, 0, moved)
      return next
    })
  }

  const reloadDraft = async () => {
    clearTimer()
    const result = await form.refetch()
    if (!result.data) return
    const loaded = result.data
    draftRef.current = loaded
    cardsRef.current = loaded.sections.flatMap((section) => section.items)
    revisionRef.current = loaded.draftRevision
    savedSnapshotRef.current = JSON.stringify(getFormDraftPayload(loaded))
    conflictRef.current = false
    setHasConflict(false)
    setDraft(loaded)
    setEditorSession((current) => current + 1)
    setActiveId(null)
    setStatus("saved")
  }

  return {
    draft,
    editorSession,
    hasConflict,
    reloadDraft,
    cards,
    activeId,
    saveStatus,
    isReady: Boolean(form.data),
    loadError: form.isError,
    retryLoad: form.refetch,
    flush,
    setActiveId,
    updateHeading,
    updateLocalItem,
    updateTextBlock,
    updateItemType,
    addItem,
    duplicateCard,
    removeCard,
    reorderCards,
  }
}
