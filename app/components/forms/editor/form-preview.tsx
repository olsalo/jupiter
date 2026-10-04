import { useTranslation } from "react-i18next"

import { PublicForm } from "~/components/forms/renderer/public-form"
import { FormScrollArea } from "~/components/forms/form-scroll-area"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { buildFormSnapshot } from "~/lib/forms/form-snapshot"
import type { FormEditorDraft } from "~/lib/forms/form-types"
import { toast } from "~/lib/toast"

export function FormPreview({ draft }: { draft: FormEditorDraft | null }) {
  const { t } = useTranslation("forms")
  let snapshot
  try {
    if (draft) snapshot = buildFormSnapshot(draft)
  } catch {
    // Unsupported items or invalid settings cannot be previewed.
  }

  return (
    <FormScrollArea appearance={draft?.appearance} className="absolute inset-0 z-0">
      {snapshot ? (
        <PublicForm preview={true} snapshot={snapshot} submitFn={async () => { toast.success(t("preview.success")) }} />
      ) : (
        <div className="mx-auto w-full max-w-151.75 px-6 pt-8">
          <Alert variant="info"><AlertDescription>{t("workspace.publishInvalid")}</AlertDescription></Alert>
        </div>
      )}
    </FormScrollArea>
  )
}
