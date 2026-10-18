import type { Ref } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Menu, MenuItem, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "~/components/ui/menu"

export function ServiceCategoryPicker({ categories, value, onChange, onCreate, onBlur, inputRef, disabled, invalid }: {
  categories: { id: string; name: string }[]
  value: string
  onChange: (id: string) => void
  onCreate: () => void
  onBlur: () => void
  inputRef: Ref<HTMLButtonElement>
  disabled: boolean
  invalid: boolean
}) {
  const { t } = useTranslation("services")
  const label = categories.find((category) => category.id === value)?.name ?? t("noCategory")

  return <Menu>
    <MenuTrigger aria-invalid={invalid} aria-label={t("category")} onBlur={onBlur} ref={inputRef} render={<Button className="w-full min-w-0 justify-between font-normal" disabled={disabled} type="button" variant="outline" />}>
      <span className="truncate">{label}</span><Icon aria-hidden={true} name="chevronDown" size={16} />
    </MenuTrigger>
    <MenuPopup align="start" className="w-(--anchor-width) max-w-(--available-width)" sideOffset={6}>
      <MenuRadioGroup value={value} onValueChange={(id) => { if (typeof id === "string") onChange(id) }}>
        <MenuRadioItem closeOnClick={true} value="">{t("noCategory")}</MenuRadioItem>
        {categories.map((category) => <MenuRadioItem className="grid-cols-[.75rem_minmax(0,1fr)]" closeOnClick={true} key={category.id} value={category.id}><span className="break-words">{category.name}</span></MenuRadioItem>)}
      </MenuRadioGroup>
      <MenuSeparator /><MenuItem closeOnClick={true} onClick={onCreate}><Icon aria-hidden={true} name="plus" size={16} />{t("newCategory")}</MenuItem>
    </MenuPopup>
  </Menu>
}
