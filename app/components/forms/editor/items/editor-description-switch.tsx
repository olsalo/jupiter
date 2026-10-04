import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Switch } from "~/components/ui/switch"

export function useEditorDescription(description: string | null) {
  const [showDescription, setShowDescription] = useState(Boolean(description))
  const descriptionRef = useRef(description ?? "")

  const toggleDescription = (checked: boolean, currentDescription: string) => {
    if (!checked) descriptionRef.current = currentDescription
    setShowDescription(checked)
    return checked ? descriptionRef.current : ""
  }

  return { showDescription, toggleDescription }
}

export function EditorDescriptionSwitch({ checked, onCheckedChange }: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const { t } = useTranslation("forms")

  return (
    <label className="flex h-9 cursor-pointer items-center gap-3 text-xs font-medium text-foreground sm:h-8">
      {t("heading.addDescription")}
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  )
}
