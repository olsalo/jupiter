import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import type { EditableItemType } from "../form-editor-types"
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "~/components/ui/select"

export function ItemTypeSelect({ onChange, value }: {
  onChange: (value: EditableItemType) => void
  value: EditableItemType
}) {
  const { t } = useTranslation("forms")
  const [popupContainer, setPopupContainer] = useState<HTMLElement | null>(null)
  const triggerRef = useCallback((trigger: HTMLButtonElement | null) => {
    setPopupContainer(trigger?.closest<HTMLElement>("[data-form-editor-scroll-area]") ?? null)
  }, [])
  const items = [
    { label: t("field.types.shortText"), value: "SHORT_TEXT" },
    { label: t("field.types.longText"), value: "LONG_TEXT" },
    { label: t("field.types.singleChoice"), value: "SINGLE_CHOICE" },
    { label: t("field.types.multipleChoice"), value: "MULTIPLE_CHOICE" },
  ]

  return (
    <Select
      items={items}
      modal={false}
      onValueChange={(nextValue) => {
        if (nextValue !== "SHORT_TEXT" && nextValue !== "LONG_TEXT" && nextValue !== "SINGLE_CHOICE" && nextValue !== "MULTIPLE_CHOICE") return
        if (nextValue === value) return
        onChange(nextValue)
      }}
      value={value}
    >
      <SelectTrigger ref={triggerRef}>
        <SelectValue />
      </SelectTrigger>
      <SelectPopup
        collisionBoundary={popupContainer?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? "clipping-ancestors"}
        portalProps={{ container: popupContainer }}
        positionMethod="absolute"
      >
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  )
}
