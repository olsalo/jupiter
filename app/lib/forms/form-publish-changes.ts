import { buildFormSnapshot, formSnapshotSchema } from "./form-snapshot"
import type { FormEditorDraft } from "./form-types"
import { getFormDraftPayload } from "./form-editor-save"

export function hasFormEditorChanges(local: FormEditorDraft | null, saved: FormEditorDraft | undefined) {
  if (!saved) return false
  if (!local) return Boolean(saved.hasUnpublishedChanges)
  if (saved.publishedVersion === null) {
    return Boolean(saved.hasUnpublishedChanges)
      || JSON.stringify(getFormDraftPayload(local)) !== JSON.stringify(getFormDraftPayload(saved))
  }
  return hasUnpublishedFormChanges({ ...local, publishedVersion: saved.publishedVersion }, saved.publishedSnapshot)
}

export function applyPublishedForm(current: FormEditorDraft, submitted: FormEditorDraft, version: number): FormEditorDraft {
  if ((current.publishedVersion ?? 0) > version) return current
  const next = {
    ...current,
    status: "PUBLISHED" as const,
    publishedVersion: version,
    publishedSnapshot: buildFormSnapshot(submitted),
  }
  return { ...next, hasUnpublishedChanges: hasUnpublishedFormChanges(next, next.publishedSnapshot) }
}

export function hasUnpublishedFormChanges(draft: FormEditorDraft, published: unknown) {
  if (draft.publishedVersion === null) return draft.draftRevision > 0
  const previous = formSnapshotSchema.safeParse(published)
  if (!previous.success) return true

  try {
    const current = buildFormSnapshot(draft)
    const content = ({ title, description, sections, logicRules }: typeof current) => ({ title, description, sections, logicRules })
    return JSON.stringify(content(current)) !== JSON.stringify(content(previous.data))
  } catch {
    return true
  }
}
